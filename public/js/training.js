import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@9.0.5/+esm';
import { state, showToast, showConfirmModal, applyPiecesTheme } from './utils.js';
import { buildRepertoireTree, parseMultiPgn } from './data.js';
import { saveHistory } from './dashboard.js';

const COMMENT_OPEN_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
const COMMENT_CLOSED_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>`;

const trainingView = document.getElementById('training-view');
const setupView = document.getElementById('setup-view');

const initializeStats = (node) => {
  state.totalMoves = 0;
  state.learnedMoves = 0;
  state.errorCount = 0;
  state.currentMoveErrorLogged = false;
  const traverse = (n) => {
    if (n.id !== 'root' && n.color === state.playerColor) {
      state.totalMoves++;
    }
    if (n.children.length === 0 && n.id !== 'root') {
      n.isLeaf = true;
    }
    n.children.forEach(traverse);
  };
  traverse(node);
  updateStatsUI();
};

let expertSession = null;

const isExpertActive = () => {
  return state.trainingMode === 'revision' && localStorage.getItem('chess_expert_mode') === 'on';
};

const collectExpertPositions = (rootNode, playerColor) => {
  const positionsMap = new Map();

  const traverse = (node) => {
    if (!node) {
      return;
    }

    const playerChildren = (node.children || []).filter((c) => c.color === playerColor);
    if (playerChildren.length > 0) {
      const fen = node.fen;
      if (!positionsMap.has(fen)) {
        positionsMap.set(fen, {
          id: `exp_pos_${positionsMap.size}`,
          fen: fen,
          node: node,
          validMovesMap: new Map(),
          solvedMoves: new Set(),
          isSolved: false,
        });
      }
      const item = positionsMap.get(fen);
      playerChildren.forEach((child) => {
        item.validMovesMap.set(child.san, child);
      });
    }

    (node.children || []).forEach(traverse);
  };

  traverse(rootNode);

  return Array.from(positionsMap.values()).map((item) => ({
    ...item,
    validMoves: Array.from(item.validMovesMap.values()),
  }));
};

const startExpertNextPosition = () => {
  if (!expertSession) {
    return;
  }

  state.cg.set({ drawable: { autoShapes: [] } });

  const unsolved = expertSession.positions.filter((p) => !p.isSolved);
  if (unsolved.length === 0) {
    state.rootNode.isCompleted = true;
    handleEnd();
    return;
  }

  const randomIndex = Math.floor(Math.random() * unsolved.length);
  const currentPosItem = unsolved[randomIndex];
  expertSession.currentPosItem = currentPosItem;

  state.currentNode = currentPosItem.node;
  state.game.load(currentPosItem.fen);

  state.cg.set({
    fen: state.game.fen(),
    lastMove: null,
    drawable: { autoShapes: [] },
  });

  updateStatsUI();
  renderPgnHtml();
  updateAnalysisLink();
  updateNavigationButtons();

  preparePlayerTurn();
};

const handleExpertUserMove = (orig, dest) => {
  const currentPosItem = expertSession?.currentPosItem;
  if (!currentPosItem) {
    return;
  }

  const move = state.game.moves({ verbose: true }).find((m) => m.from === orig && m.to === dest);
  const matchedChild = move ? currentPosItem.validMoves.find((c) => c.san === move.san) : null;

  if (!move || !matchedChild) {
    if (!state.currentMoveErrorLogged) {
      state.errorCount++;
      state.currentMoveErrorLogged = true;
      updateStatsUI();
    }
    showToast('Coup incorrect !', 'error', 1500);
    setTimeout(() => {
      state.game.load(currentPosItem.fen);
      state.cg.set({ fen: currentPosItem.fen, lastMove: null });
      preparePlayerTurn();
    }, 600);
    return;
  }

  if (currentPosItem.solvedMoves.has(matchedChild.san)) {
    showToast('Coup déjà trouvé ! Trouvez l’autre variante.', 'info', 2000);
    setTimeout(() => {
      state.game.load(currentPosItem.fen);
      state.cg.set({ fen: currentPosItem.fen, lastMove: null });
      preparePlayerTurn();
    }, 600);
    return;
  }

  state.currentMoveErrorLogged = false;
  currentPosItem.solvedMoves.add(matchedChild.san);

  state.game.move(matchedChild.san);
  state.cg.set({
    fen: state.game.fen(),
    lastMove: null,
    movable: { dests: new Map() },
    drawable: { autoShapes: [] },
  });

  const totalMovesCount = currentPosItem.validMoves.length;
  const remainingCount = totalMovesCount - currentPosItem.solvedMoves.size;

  if (remainingCount > 0) {
    showToast(`Bon coup ! Il reste ${remainingCount} autre(s) coup(s) à trouver.`, 'success', 2000);
    setTimeout(() => {
      state.game.load(currentPosItem.fen);
      state.cg.set({ fen: currentPosItem.fen, lastMove: null });
      renderPgnHtml();
      preparePlayerTurn();
    }, 800);
  } else {
    currentPosItem.isSolved = true;
    expertSession.solvedCount++;
    currentPosItem.validMoves.forEach((c) => markCompleted(c));
    updateStatsUI();
    showToast('Position résolue !', 'success', 1500);

    setTimeout(() => {
      startExpertNextPosition();
    }, 800);
  }
};

const updateStatsUI = () => {
  if (isExpertActive() && expertSession) {
    document.getElementById('statMoves').textContent =
      `${expertSession.solvedCount}/${expertSession.totalPositions}`;
    document.getElementById('statErrors').textContent = state.errorCount;

    let progress =
      expertSession.totalPositions > 0
        ? Math.round((expertSession.solvedCount / expertSession.totalPositions) * 100)
        : 0;
    document.getElementById('trainingProgress').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${progress}%`;
    return;
  }

  document.getElementById('statMoves').textContent = `${state.learnedMoves}/${state.totalMoves}`;
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
  const existingBtn = document.getElementById('continueBtn');
  if (existingBtn) {
    existingBtn.remove();
  }

  if (isExpertActive() && expertSession) {
    const currentPos = expertSession.currentPosItem;
    const display = document.getElementById('activeLineDisplay');
    if (currentPos) {
      const totalMovesCount = currentPos.validMoves.length;
      const foundCount = currentPos.solvedMoves.size;
      let extraInfo = '';
      if (totalMovesCount > 1) {
        extraInfo = ` (${foundCount}/${totalMovesCount})`;
      }
      display.innerHTML = `<span style="color: var(--primary); font-weight: 600;">Position isolée${extraInfo}</span>`;
    } else {
      display.innerHTML = `<span style="color: var(--text-muted);">Mode Expert</span>`;
    }

    const node = currentPos?.node;
    document.getElementById('commentBox').innerHTML = node?.comment
      ? `<strong>Notes :</strong> ${node.comment}`
      : `<em>Aucun commentaire.</em>`;
    return;
  }

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
    display.scrollLeft =
      active.offsetLeft - display.offsetLeft - display.clientWidth / 2 + active.clientWidth / 2;
  }

  const node = state.currentPath[state.viewIndex];
  document.getElementById('commentBox').innerHTML = node?.comment
    ? `<strong>Notes :</strong> ${node.comment}`
    : `<em>Aucun commentaire.</em>`;
};

const showContinueButton = (callback) => {
  const existing = document.getElementById('continueBtn');
  if (existing) {
    existing.remove();
  }

  const btn = document.createElement('button');
  btn.id = 'continueBtn';
  btn.className = 'primary';
  btn.innerHTML =
    'Continuer <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; display: inline-block; vertical-align: middle;"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  btn.style.width = '100%';
  btn.style.marginTop = '10px';
  btn.style.marginBottom = '4px';
  btn.style.padding = '10px';
  btn.style.fontSize = '14px';
  btn.style.fontWeight = '600';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.backgroundColor = 'var(--primary)';
  btn.style.color = '#fff';
  btn.style.border = 'none';

  // Bloquer temporairement le déplacement sur l'échiquier
  state.cg.set({ movable: { dests: new Map() } });

  btn.onclick = () => {
    btn.remove();
    callback();
  };

  const commentBox = document.getElementById('commentBox');
  commentBox.parentNode.insertBefore(btn, commentBox);
};

const updateNavigationButtons = () => {
  if (isExpertActive()) {
    document.getElementById('prevBtn').disabled = true;
    document.getElementById('prevBtnMobile').disabled = true;
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('nextBtnMobile').disabled = true;
    return;
  }

  const isAtStart = state.viewIndex <= 0;
  const isAtEnd = state.viewIndex >= state.currentPath.length - 1;
  document.getElementById('prevBtn').disabled = isAtStart;
  document.getElementById('prevBtnMobile').disabled = isAtStart;
  document.getElementById('nextBtn').disabled = isAtEnd;
  document.getElementById('nextBtnMobile').disabled = isAtEnd;
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
  if (isExpertActive() && expertSession && expertSession.currentPosItem) {
    handleExpertUserMove(orig, dest);
    return;
  }

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
    const hasComment = state.currentNode.comment && state.currentNode.comment.trim() !== '';
    const commentsVisible = document.getElementById('commentBox').style.display !== 'none';

    if (hasComment && commentsVisible) {
      showContinueButton(() => {
        playOpponent();
      });
    } else {
      setTimeout(() => {
        playOpponent();
      }, 300);
    }
  }
};

const playOpponent = () => {
  const nextOptions = state.currentNode.children.filter((c) => !c.isCompleted);
  if (nextOptions.length === 0) {
    return;
  }

  let next;
  const isRandom = localStorage.getItem('chess_random_mode') === 'on';
  if (isRandom) {
    const randomIndex = Math.floor(Math.random() * nextOptions.length);
    next = nextOptions[randomIndex];
  } else {
    next = nextOptions[0];
  }

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
};

const markCompleted = (node) => {
  node.isCompleted = true;

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
    btn.style.flex = '1';
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
      nextBtn.style.flex = '1';
      nextBtn.style.padding = '12px';
      nextBtn.textContent = isLast ? 'Premier chapitre' : 'Chapitre suivant';
      nextBtn.onclick = () => {
        state.currentChapterIndex = nextChapIdx;
        state.selectedChapterPgn = state.currentRepertoire.chapters[nextChapIdx].pgn;
        launchTrainingUI();
      };
      actions.appendChild(nextBtn);
    }
  } else {
    const hasComment = state.currentNode.comment && state.currentNode.comment.trim() !== '';
    const commentsVisible = document.getElementById('commentBox').style.display !== 'none';

    if (hasComment && commentsVisible) {
      showContinueButton(() => {
        startNextVariation();
      });
    } else {
      setTimeout(startNextVariation, 800);
    }
  }
};

const startNextVariation = () => {
  state.cg.set({ drawable: { autoShapes: [] } });

  const getPath = (n) => {
    if (n.isLeaf && !n.isCompleted) {
      return [n];
    }
    const nextOptions = n.children.filter((c) => !c.isCompleted);
    if (nextOptions.length === 0) {
      return null;
    }

    let next;
    const isRandom = localStorage.getItem('chess_random_mode') === 'on';
    if (isRandom) {
      const randomIndex = Math.floor(Math.random() * nextOptions.length);
      next = nextOptions[randomIndex];
    } else {
      next = nextOptions[0];
    }

    const subPath = getPath(next);
    return subPath ? [n, ...subPath] : null;
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
  chapterId,
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
        const chap = entry.chapters.find((c) => c.id === chapterId);
        if (chap) {
          pgnText = chap.pgn;
          state.currentRepertoire = {
            title: entry.title || repertoireTitle,
            chapters: entry.chapters,
          };
          state.currentChapterIndex = entry.chapters.findIndex((c) => c.id === chapterId);
        }
      }
    }
  } catch (e) {
    console.error('Cache error', e);
  }

  if (!pgnText) {
    showToast("Chargement de l'étude...", 'info');
    try {
      const token = state.authToken || localStorage.getItem('chess_token');
      const response = await fetch(`/api/lichess/study/${studyId}.pgn?v=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Étude non trouvée.');
      const fullPgnText = await response.text();
      const studyName = fullPgnText.match(/\[StudyName "(.*?)"\]/)?.[1] || repertoireTitle;
      const chapters = parseMultiPgn(fullPgnText);
      state.currentRepertoire = { title: studyName, chapters: chapters };
      const idx = chapters.findIndex((c) => c.id === chapterId);
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
  if (!state.selectedChapterPgn) {
    return;
  }
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
    state.trainingMode === 'decouverte' ? '1fr' : '1fr 1fr';
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
  document.body.classList.add('training-active');
  setupView.classList.add('hidden');
  trainingView.classList.remove('hidden');
  trainingView.classList.add('fade-in');

  // Hide comments by default in revision mode to optimize vertical space
  const commentBox = document.getElementById('commentBox');
  const toggleCommentsBtn = document.getElementById('toggleCommentsBtn');
  if (state.trainingMode === 'revision') {
    commentBox.style.display = 'none';
    toggleCommentsBtn.innerHTML = COMMENT_CLOSED_SVG;
    toggleCommentsBtn.title = 'Afficher Notes';
  } else {
    commentBox.style.display = 'block';
    toggleCommentsBtn.innerHTML = COMMENT_OPEN_SVG;
    toggleCommentsBtn.title = 'Masquer Notes';
  }

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
    applyPiecesTheme(localStorage.getItem('chess_pieces_theme') || 'cburnett');
    state.cg.set({ orientation: state.playerColor });
    state.game.load(state.rootNode.fen);

    if (isExpertActive()) {
      const positions = collectExpertPositions(state.rootNode, state.playerColor);
      expertSession = {
        positions,
        currentPosItem: null,
        totalPositions: positions.length,
        solvedCount: 0,
      };

      if (positions.length === 0) {
        showToast('Aucune position à réviser pour cette couleur.', 'warning', 3000);
        setTimeout(() => {
          handleEnd();
        }, 1000);
        return;
      }

      showToast('Mode Expert activé (Positions isolées)', 'info');
      startExpertNextPosition();
    } else {
      expertSession = null;
      showToast(
        state.trainingMode === 'decouverte' ? 'Mode Découverte activé' : 'Mode Révision activé',
        'info'
      );
      startNextVariation();
    }
  }, 50);
};

export const initTraining = () => {
  document.getElementById('restartBtn').onclick = async () => {
    if (state.isTraining) {
      const confirm = await showConfirmModal(
        'Recommencer',
        'Voulez-vous vraiment recommencer ce chapitre ?'
      );
      if (confirm) {
        launchTrainingUI();
      }
    }
  };

  document.getElementById('stopBtn').onclick = async () => {
    if (state.isTraining && !state.rootNode.isCompleted) {
      const confirm = await showConfirmModal(
        'Quitter',
        "Voulez-vous vraiment quitter l'entraînement en cours ?"
      );
      if (!confirm) {
        return;
      }
    }
    state.isTraining = false;
    document.body.classList.remove('training-active');
    trainingView.classList.add('hidden');
    setupView.classList.remove('hidden');
    setupView.classList.add('fade-in');
    state.game.reset();
    state.cg.set({ drawable: { autoShapes: [] } });
  };

  document.getElementById('toggleCommentsBtn').onclick = () => {
    const box = document.getElementById('commentBox');
    const btn = document.getElementById('toggleCommentsBtn');
    if (box.style.display === 'none') {
      box.style.display = 'block';
      btn.innerHTML = COMMENT_OPEN_SVG;
      btn.title = 'Masquer Notes';
    } else {
      box.style.display = 'none';
      btn.innerHTML = COMMENT_CLOSED_SVG;
      btn.title = 'Afficher Notes';

      const continueBtn = document.getElementById('continueBtn');
      if (continueBtn) {
        continueBtn.click();
      }
    }
  };

  document.getElementById('hintBtn').onclick = () => {
    if (!state.isTraining || state.trainingMode === 'decouverte') {
      return;
    }

    if (isExpertActive() && expertSession && expertSession.currentPosItem) {
      const currentPosItem = expertSession.currentPosItem;
      const nextUnsolvedChild = currentPosItem.validMoves.find(
        (c) => !currentPosItem.solvedMoves.has(c.san)
      );
      if (nextUnsolvedChild) {
        state.cg.set({
          drawable: {
            autoShapes: [
              { orig: nextUnsolvedChild.from, dest: nextUnsolvedChild.to, brush: 'hint' },
            ],
          },
        });
        showToast('Solution affichée !', 'info', 1500);
        if (!state.currentMoveErrorLogged) {
          state.errorCount++;
          state.currentMoveErrorLogged = true;
          updateStatsUI();
        }
      }
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

  const prevAction = () => {
    navigateView(-1);
  };
  document.getElementById('prevBtn').onclick = prevAction;
  document.getElementById('prevBtnMobile').onclick = prevAction;

  const nextAction = () => {
    navigateView(1);
  };
  document.getElementById('nextBtn').onclick = nextAction;
  document.getElementById('nextBtnMobile').onclick = nextAction;

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
