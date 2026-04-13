import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@9.0.5/+esm';
import { state, showToast } from './utils.js';
import { buildRepertoireTree, parseMultiPgn } from './data.js';
import { saveHistory } from './dashboard.js';

const trainingView = document.getElementById('training-view');
const setupView = document.getElementById('setup-view');

const initializeStats = (node) => {
  state.totalMoves = 0;
  state.learnedMoves = 0;
  state.totalVariations = 0;
  state.learnedVariations = 0;
  state.errorCount = 0;
  state.currentMoveErrorLogged = false;
  const traverse = (n) => {
    if (n.id !== 'root' && n.color === state.playerColor) {
      state.totalMoves++;
    }
    if (n.children.length === 0 && n.id !== 'root') {
      n.isLeaf = true;
      state.totalVariations++;
    }
    n.children.forEach(traverse);
  };
  traverse(node);
  updateStatsUI();
};

const updateStatsUI = () => {
  document.getElementById('statMoves').textContent = `${state.learnedMoves}/${state.totalMoves}`;
  document.getElementById('statVars').textContent =
    `${state.learnedVariations}/${state.totalVariations}`;
  document.getElementById('statErrors').textContent = state.errorCount;

  let progress =
    state.totalMoves > 0 ? Math.round((state.learnedMoves / state.totalMoves) * 100) : 0;
  document.getElementById('trainingProgress').style.width = `${progress}%`;
  document.getElementById('progressText').textContent = `${progress}%`;
};

const updateAnalysisLink = () => {
  const studyUrl = state.currentRepertoire?.chapters[state.currentChapterIndex]?.studyUrl;
  if (studyUrl) {
    const moveNumber = Math.floor((state.viewIndex + 1) / 2);
    document.getElementById('analysisLink').href =
      `${studyUrl}?color=${state.playerColor}#${moveNumber}`;
  } else {
    document.getElementById('analysisLink').href =
      `https://lichess.org/analysis/standard/${state.game.fen().replace(/ /g, '_')}?color=${state.playerColor}`;
  }
};

const renderPgnHtml = () => {
  if (state.currentPath.length <= 1) {
    document.getElementById('activeLineDisplay').innerHTML =
      "<span style='color: var(--text-muted);'>Position initiale</span>";
    document.getElementById('commentBox').innerHTML = '<em>Aucun commentaire.</em>';
    return;
  }

  let html = '';
  const parts = state.rootNode.fen.split(' ');
  let num = parseInt(parts[5]) || 1;
  let turn = parts[1] === 'w' ? 'white' : 'black';

  for (let i = 1; i < state.currentPath.length; i++) {
    if (turn === 'white') {
      html += `<span class="move-number">${num}.</span> `;
    } else if (i === 1) {
      html += `<span class="move-number">${num}...</span> `;
    }

    html += `<span class="pgn-move ${i === state.viewIndex ? 'active-move' : ''}" data-index="${i}">${state.currentPath[i].san}</span> `;

    if (turn === 'black') {
      num++;
      turn = 'white';
    } else {
      turn = 'black';
    }
  }

  const display = document.getElementById('activeLineDisplay');
  display.innerHTML = html.trim();
  const active = display.querySelector('.active-move');

  if (active) {
    display.scrollTop =
      active.offsetTop - display.offsetTop - display.clientHeight / 2 + active.clientHeight / 2;
  }

  const node = state.currentPath[state.viewIndex];
  document.getElementById('commentBox').innerHTML = node?.comment
    ? `<strong>Notes :</strong> ${node.comment}`
    : `<em>Aucun commentaire.</em>`;
};

const updateNavigationButtons = () => {
  document.getElementById('prevBtn').disabled = state.viewIndex <= 0;
  document.getElementById('nextBtn').disabled = state.viewIndex >= state.currentPath.length - 1;
};

const navigateView = (step) => {
  const newIdx = state.viewIndex + step;
  if (!state.isTraining || newIdx < 0 || newIdx >= state.currentPath.length) {
    return;
  }

  state.viewIndex = newIdx;
  renderPgnHtml();
  state.game.load(state.currentPath[state.viewIndex].fen);

  const shapes = [...(state.currentPath[state.viewIndex].shapes || [])];
  state.cg.set({
    fen: state.game.fen(),
    lastMove:
      state.viewIndex > 0
        ? [state.currentPath[state.viewIndex].from, state.currentPath[state.viewIndex].to]
        : null,
    drawable: { autoShapes: shapes },
  });
  updateAnalysisLink();

  if (
    state.viewIndex === state.currentPath.length - 1 &&
    !state.currentPath[state.viewIndex].isCompleted &&
    state.game.turn() === state.playerColor[0]
  ) {
    preparePlayerTurn();
  } else {
    state.cg.set({ movable: { dests: new Map() } });
  }
  updateNavigationButtons();
};

const preparePlayerTurn = () => {
  const dests = new Map();
  state.game.moves({ verbose: true }).forEach((m) => {
    if (!dests.has(m.from)) {
      dests.set(m.from, []);
    }
    dests.get(m.from).push(m.to);
  });

  state.cg.set({
    turnColor: state.playerColor,
    movable: {
      color: state.playerColor,
      free: false,
      showDests: true,
      dests,
      events: { after: onUserMove },
    },
  });

  if (state.trainingMode === 'decouverte') {
    const shapes = [...(state.currentNode.shapes || [])];
    const next = state.currentNode.children.find((c) => !c.isCompleted);
    if (next) {
      shapes.push({ orig: next.from, dest: next.to, brush: 'hint' });
    }
    state.cg.set({ drawable: { autoShapes: shapes } });
  }
};

const onUserMove = (orig, dest) => {
  const move = state.game.moves({ verbose: true }).find((m) => m.from === orig && m.to === dest);

  const childNodeIfAny = state.currentNode.children.find((c) => c.san === move?.san);
  if (childNodeIfAny && childNodeIfAny.isCompleted) {
    showToast('Variante déjà couverte', 'info', 1500);
    setTimeout(() => {
      state.cg.set({ fen: state.game.fen() });
      preparePlayerTurn();
    }, 600);
    return;
  }

  const child = state.currentNode.children.find((c) => c.san === move?.san && !c.isCompleted);

  if (!move || !child) {
    if (state.trainingMode === 'revision' && !state.currentMoveErrorLogged) {
      state.errorCount++;
      state.currentMoveErrorLogged = true;
      updateStatsUI();
    }
    showToast(
      state.trainingMode === 'revision' ? 'Coup incorrect !' : 'Suivez la flèche !',
      'error',
      1500
    );
    setTimeout(() => {
      state.cg.set({ fen: state.game.fen() });
      preparePlayerTurn();
    }, 600);
    return;
  }

  state.currentMoveErrorLogged = false;
  state.game.move(move.san);
  state.cg.set({
    fen: state.game.fen(),
    lastMove: [orig, dest],
    movable: { dests: new Map() },
    drawable: { autoShapes: [] },
  });

  state.currentNode = child;
  if (!state.currentNode.isVisited) {
    state.currentNode.isVisited = true;
    state.learnedMoves++;
    updateStatsUI();
  }

  state.currentPath.push(state.currentNode);
  state.viewIndex = state.currentPath.length - 1;
  renderPgnHtml();
  updateAnalysisLink();
  updateNavigationButtons();

  if (state.trainingMode === 'decouverte') {
    const shapes = [...(state.currentNode.shapes || [])];
    state.cg.set({ drawable: { autoShapes: shapes } });
  }

  if (state.currentNode.isLeaf) {
    markCompleted(state.currentNode);
    handleEnd();
  } else {
    setTimeout(() => {
      playOpponent();
    }, 300);
  }
};

const playOpponent = () => {
  const next = state.currentNode.children.find((c) => !c.isCompleted);
  if (next) {
    state.game.move(next.san);
    state.cg.set({ fen: state.game.fen(), lastMove: [next.from, next.to] });

    state.currentNode = next;
    state.currentNode.isVisited = true;
    state.currentPath.push(state.currentNode);
    state.viewIndex = state.currentPath.length - 1;

    renderPgnHtml();
    updateAnalysisLink();
    updateNavigationButtons();

    if (state.currentNode.isLeaf) {
      markCompleted(state.currentNode);
      handleEnd();
    } else {
      preparePlayerTurn();
    }
  }
};

const markCompleted = (node) => {
  node.isCompleted = true;
  if (node.isLeaf) {
    state.learnedVariations++;
  }

  let p = node.parent;
  while (p && p.id !== 'root') {
    if (p.children.every((c) => c.isCompleted)) {
      p.isCompleted = true;
    }
    p = p.parent;
  }

  if (state.rootNode.children.every((c) => c.isCompleted)) {
    state.rootNode.isCompleted = true;
  }

  updateStatsUI();
};

const handleEnd = () => {
  if (state.rootNode.isCompleted) {
    showToast(`Entraînement terminé ! Erreurs : ${state.errorCount}`, 'success', 5000);
    if (state.authToken && state.trainingMode === 'revision') {
      saveHistory({
        repertoire_title: state.currentRepertoire.title,
        chapter_title: state.currentRepertoire.chapters[state.currentChapterIndex].title,
        chapter_id: state.currentRepertoire.chapters[state.currentChapterIndex].id,
        repertoire_id: state.currentStudyId,
        total_chapters: state.currentRepertoire.chapters.length,
        moves_learned: state.learnedMoves,
        total_moves: state.totalMoves,
        errors: state.errorCount,
        is_revision: true,
      });
    }
    const actions = document.getElementById('trainingActions');
    actions.innerHTML = '';
    actions.classList.remove('hidden');

    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent =
      state.trainingMode === 'decouverte' ? 'Passer en mode Révision' : 'Refaire ce chapitre';
    btn.style.width = '100%';
    btn.style.padding = '12px';
    btn.onclick = () => {
      if (state.trainingMode === 'decouverte') {
        state.trainingMode = 'revision';
      }
      launchTrainingUI();
    };
    actions.appendChild(btn);

    if (state.currentRepertoire && state.currentRepertoire.chapters.length > 1) {
      let nextChapIdx = state.currentChapterIndex + 1;
      let isLast = nextChapIdx >= state.currentRepertoire.chapters.length;
      if (isLast) {
        nextChapIdx = 0;
      }

      const nextBtn = document.createElement('button');
      nextBtn.style.width = '100%';
      nextBtn.style.padding = '12px';
      nextBtn.style.marginTop = '8px';
      nextBtn.textContent = isLast ? 'Premier chapitre' : 'Chapitre suivant';
      nextBtn.onclick = () => {
        state.currentChapterIndex = nextChapIdx;
        state.selectedChapterPgn = state.currentRepertoire.chapters[nextChapIdx].pgn;
        launchTrainingUI();
      };
      actions.appendChild(nextBtn);
    }
  } else {
    setTimeout(startNextVariation, 800);
  }
};

const startNextVariation = () => {
  state.cg.set({ drawable: { autoShapes: [] } });

  const getPath = (n) => {
    if (n.isLeaf && !n.isCompleted) {
      return [n];
    }
    const next = n.children.find((c) => !c.isCompleted);
    return next ? [n, ...getPath(next)] : null;
  };

  const path = getPath(state.rootNode);
  if (!path) {
    return;
  }

  let common = path[0];
  for (let i = 1; i < path.length; i++) {
    if (path[i].isVisited) {
      common = path[i];
    } else {
      break;
    }
  }

  state.currentNode = common.id === 'root' ? state.rootNode : common;
  state.currentPath = [];
  let curr = state.currentNode;
  while (curr) {
    state.currentPath.unshift(curr);
    curr = curr.parent;
  }

  state.viewIndex = state.currentPath.length - 1;
  state.game.load(state.currentNode.fen);
  state.cg.set({ fen: state.game.fen(), lastMove: null });
  renderPgnHtml();
  updateAnalysisLink();

  const next = path[path.indexOf(common) + 1];
  if (next) {
    if (next.color !== state.playerColor) {
      setTimeout(() => {
        playOpponent();
      }, 500);
    } else {
      preparePlayerTurn();
    }
  }
};

export const startTrainingSessionDirect = async (
  studyId,
  repertoireTitle,
  chapterTitle,
  color,
  mode
) => {
  let pgnText = null;
  const CACHE_KEY = 'repertoire_cache';
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      const cache = JSON.parse(saved);
      const entry = cache[studyId + '_' + color];
      if (entry && Date.now() - entry.timestamp <= 60 * 60 * 1000) {
        const chap = entry.chapters.find((c) => c.title === chapterTitle);
        if (chap) {
          pgnText = chap.pgn;
          state.currentRepertoire = {
            title: entry.title || repertoireTitle,
            chapters: entry.chapters,
          };
          state.currentChapterIndex = entry.chapters.findIndex((c) => c.title === chapterTitle);
        }
      }
    }
  } catch (e) {
    console.error('Cache error', e);
  }

  if (!pgnText) {
    showToast("Chargement de l'étude...", 'info');
    try {
      const response = await fetch(`https://lichess.org/api/study/${studyId}.pgn?v=${Date.now()}`);
      if (!response.ok) throw new Error('Étude non trouvée.');
      const fullPgnText = await response.text();
      const studyName = fullPgnText.match(/\[StudyName "(.*?)"\]/)?.[1] || repertoireTitle;
      const chapters = parseMultiPgn(fullPgnText);
      state.currentRepertoire = { title: studyName, chapters: chapters };
      const idx = chapters.findIndex((c) => c.title === chapterTitle);
      if (idx === -1) throw new Error('Chapitre introuvable');
      state.currentChapterIndex = idx;
      pgnText = chapters[idx].pgn;

      // Also update cache if we fetched it
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cache[studyId + '_' + color] = {
          title: studyName,
          chapters: chapters,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        console.error('Cache save error', e);
      }
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  state.selectedChapterPgn = pgnText;
  state.playerColor = color;
  state.trainingMode = mode;
  state.currentStudyId = studyId;

  launchTrainingUI();
};

const launchTrainingUI = () => {
  if (!state.selectedChapterPgn) return;
  try {
    state.rootNode = buildRepertoireTree(state.selectedChapterPgn);
  } catch (e) {
    console.error('PGN parse error:', e);
    showToast('Erreur lors de la lecture du PGN', 'error');
    return;
  }
  initializeStats(state.rootNode);
  if (state.totalMoves === 0) {
    showToast('Pas de coups pour cette couleur dans ce chapitre.', 'warning');
    return;
  }

  const chap = state.currentRepertoire.chapters[state.currentChapterIndex];
  document.getElementById('trainingHeader').innerHTML =
    `<div style="color: var(--primary);">${state.currentRepertoire.title}</div><div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500; margin-top: 4px;">${chap.title.replace(state.currentRepertoire.title + ': ', '')}</div>`;
  document.getElementById('trainingActions').classList.add('hidden');

  document.getElementById('errorStatRow').parentElement.style.gridTemplateColumns =
    state.trainingMode === 'decouverte' ? '1fr 1fr' : '1fr 1fr 1fr';
  document
    .getElementById('errorStatRow')
    .classList.toggle('hidden', state.trainingMode === 'decouverte');
  document
    .getElementById('hintBtn')
    .classList.toggle('hidden', state.trainingMode === 'decouverte');
  document
    .getElementById('analysisLink')
    .classList.toggle('hidden', state.trainingMode === 'revision');
  document.getElementById('restartBtn').classList.remove('hidden');

  state.isTraining = true;
  setupView.classList.add('hidden');
  trainingView.classList.remove('hidden');
  trainingView.classList.add('fade-in');

  setTimeout(() => {
    if (!state.cg) {
      state.cg = Chessground(document.getElementById('board'), {
        coordinates: true,
        movable: { color: undefined, dests: new Map() },
        drawable: {
          brushes: {
            green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
            red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
            blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
            yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
            paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
            paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
            paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
            paleGrey: { key: 'pgr', color: '#4a4a4a', opacity: 0.35, lineWidth: 15 },
            hint: { key: 'h', color: '#cbd5e1', opacity: 0.9, lineWidth: 15 },
          },
        },
      });
    }
    state.cg.set({ orientation: state.playerColor });
    state.game.load(state.rootNode.fen);
    showToast(
      state.trainingMode === 'decouverte' ? 'Mode Découverte activé' : 'Mode Révision activé',
      'info'
    );
    startNextVariation();
  }, 50);
};

export const initTraining = () => {
  document.getElementById('restartBtn').onclick = () => {
    if (state.isTraining) {
      launchTrainingUI();
    }
  };

  document.getElementById('stopBtn').onclick = () => {
    state.isTraining = false;
    trainingView.classList.add('hidden');
    setupView.classList.remove('hidden');
    setupView.classList.add('fade-in');
    state.game.reset();
    state.cg.set({ drawable: { autoShapes: [] } });
  };

  document.getElementById('toggleCommentsBtn').onclick = () => {
    const box = document.getElementById('commentBox');
    if (box.style.display === 'none') {
      box.style.display = 'block';
      document.getElementById('toggleCommentsBtn').textContent = 'Masquer Notes';
    } else {
      box.style.display = 'none';
      document.getElementById('toggleCommentsBtn').textContent = 'Afficher Notes';
    }
  };

  document.getElementById('hintBtn').onclick = () => {
    if (!state.isTraining || state.trainingMode === 'decouverte') {
      return;
    }

    if (state.viewIndex !== state.currentPath.length - 1) {
      navigateView(state.currentPath.length - 1 - state.viewIndex);
    }

    const next = state.currentNode.children.find((c) => !c.isCompleted);
    if (next) {
      state.cg.set({
        drawable: { autoShapes: [{ orig: next.from, dest: next.to, brush: 'hint' }] },
      });
      showToast('Solution affichée !', 'info', 1500);
      if (!state.currentMoveErrorLogged) {
        state.errorCount++;
        state.currentMoveErrorLogged = true;
        updateStatsUI();
      }
    }
  };

  document.getElementById('prevBtn').onclick = () => {
    navigateView(-1);
  };

  document.getElementById('nextBtn').onclick = () => {
    navigateView(1);
  };

  document.getElementById('activeLineDisplay').addEventListener('click', (e) => {
    const moveSpan = e.target.closest('.pgn-move');
    if (moveSpan && state.isTraining) {
      const index = parseInt(moveSpan.dataset.index);
      if (!isNaN(index)) {
        navigateView(index - state.viewIndex);
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!state.isTraining) {
      return;
    }
    if (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA'
    ) {
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateView(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateView(1);
    }
  });
};
