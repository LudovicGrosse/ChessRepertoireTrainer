import {
  showToast,
  state,
  extractStudyId,
  formatRelativeTime,
  getToggleState,
  initToggles,
} from './utils.js';
import { parseMultiPgn, buildRepertoireTree } from './data.js';
import { startTrainingSessionDirect } from './training.js';

const CACHE_KEY = 'repertoire_cache';
let repertoireCache = {};
try {
  const saved = localStorage.getItem(CACHE_KEY);
  if (saved) {
    repertoireCache = JSON.parse(saved);
  }
} catch (e) {
  console.error('Cache init error', e);
}

const saveToCache = (id, data) => {
  repertoireCache[id] = { ...data, timestamp: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(repertoireCache));
};

export const fetchHistory = async () => {
  if (!state.authToken) {
    return;
  }
  try {
    const [repsRes, histRes] = await Promise.all([
      fetch('/api/repertoires', { headers: { Authorization: `Bearer ${state.authToken}` } }),
      fetch('/api/history', { headers: { Authorization: `Bearer ${state.authToken}` } }),
    ]);

    if (repsRes.ok && histRes.ok) {
      const repertoires = await repsRes.json();
      const history = await histRes.json();
      renderInteractiveDashboard(repertoires, history);
    } else if (
      repsRes.status === 401 ||
      repsRes.status === 403 ||
      histRes.status === 401 ||
      histRes.status === 403
    ) {
      console.warn('Session expired or invalid. Logging out...');
      document.getElementById('logoutBtn').click();
    }
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err);
  }
  fetchPendingInvitations();
};

let currentlyOpenRepId = null;

const renderInteractiveDashboard = (apiRepertoires, history) => {
  const repertoireListEl = document.getElementById('repertoireList');
  if (apiRepertoires.length === 0) {
    repertoireListEl.innerHTML =
      '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Aucun répertoire configuré.</div>';
    return;
  }

  const histMap = {};
  history.forEach((entry) => {
    const normalizedId = extractStudyId(entry.repertoire_id);
    const repKey = normalizedId + '_' + entry.color;
    if (!histMap[repKey]) {
      histMap[repKey] = {
        last_revision: null,
        chaptersHistory: {},
      };
    }
    const rep = histMap[repKey];

    if (
      entry.is_revision &&
      (!rep.last_revision || new Date(entry.date) > new Date(rep.last_revision))
    ) {
      rep.last_revision = entry.date;
    }
    if (!rep.chaptersHistory[entry.chapter_id]) {
      rep.chaptersHistory[entry.chapter_id] = {
        revisions: [],
        total_revisions: 0,
      };
    }
    if (entry.is_revision) {
      rep.chaptersHistory[entry.chapter_id].revisions.push(entry);
      rep.chaptersHistory[entry.chapter_id].total_revisions++;
    }
  });

  const reps = apiRepertoires.map((dbRep) => {
    const repKey = extractStudyId(dbRep.repertoire_id) + '_' + dbRep.color;
    const historyData = histMap[repKey] || { last_revision: null, chaptersHistory: {} };
    return {
      title: dbRep.title,
      repertoire_id: dbRep.repertoire_id,
      color: dbRep.color,
      total_chapters: dbRep.total_chapters,
      lichess_updated_at: dbRep.lichess_updated_at,
      dbChapters: dbRep.chapters || [],
      last_revision: historyData.last_revision,
      chaptersHistory: historyData.chaptersHistory,
    };
  });

  repertoireListEl.innerHTML = '';

  const allReps = reps.sort(
    (a, b) =>
      (b.last_revision ? new Date(b.last_revision) : 0) -
      (a.last_revision ? new Date(a.last_revision) : 0)
  );
  const whiteReps = allReps.filter(
    (r) =>
      r.color === 'white' &&
      (r.dbChapters.reduce((acc, c) => acc + c.white_moves, 0) > 0 ||
        r.dbChapters.reduce((acc, c) => acc + c.white_moves + c.black_moves, 0) === 0)
  );
  const blackReps = allReps.filter(
    (r) =>
      r.color === 'black' &&
      (r.dbChapters.reduce((acc, c) => acc + c.black_moves, 0) > 0 ||
        r.dbChapters.reduce((acc, c) => acc + c.white_moves + c.black_moves, 0) === 0)
  );

  const createSectionHeader = (title) => {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    h3.style.cssText =
      'font-size: 14px; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 12px 4px; display: flex; align-items: center; gap: 8px;';
    const line = document.createElement('div');
    line.style.cssText = 'flex: 1; height: 1px; background: var(--border-color);';
    h3.appendChild(line);
    return h3;
  };

  const renderRepList = (list) => {
    list.forEach((rep) => {
      const normalizedId = extractStudyId(rep.repertoire_id);
      const repKey = normalizedId + '_' + rep.color;

      let totalSuccessMoves = 0;
      let totalRevisionMoves = 0;

      rep.dbChapters.forEach((chap) => {
        const moveCount = rep.color === 'white' ? chap.white_moves : chap.black_moves;
        totalRevisionMoves += moveCount;

        const hist = rep.chaptersHistory[chap.id];
        const latest = hist && hist.revisions.length > 0 ? hist.revisions[0] : null;
        if (latest && moveCount > 0) {
          totalSuccessMoves += Math.min(moveCount, Math.max(0, latest.total_moves - latest.errors));
        }
      });

      const globalRate =
        totalRevisionMoves > 0 ? Math.round((totalSuccessMoves / totalRevisionMoves) * 100) : 0;

      if (totalRevisionMoves === 0) {
        const hasAnyMoves =
          rep.dbChapters.reduce((acc, c) => acc + c.white_moves + c.black_moves, 0) > 0;
        if (hasAnyMoves) {
          return;
        }
      }

      const rateClass = globalRate >= 80 ? 'high' : globalRate < 50 ? 'low' : 'medium';

      const repItem = document.createElement('div');
      repItem.className = 'repertoire-item fade-in';
      repItem.innerHTML = `
                <div class="repertoire-header">
                    <div style="flex: 1;">
                        <strong style="color: var(--text-main); font-size: 15px;">${rep.title} <span style="color: var(--text-muted); font-weight: normal; font-size: 0.85rem;">(${rep.total_chapters} chapitre${rep.total_chapters > 1 ? 's' : ''})</span></strong>
                        <div class="meta"><span>Dernière révision : ${formatRelativeTime(rep.last_revision)}</span></div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="global-score-badge ${rateClass}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> ${globalRate}%</div>
                        <div class="toggle-icon" style="color: var(--text-muted); font-size: 18px;">${currentlyOpenRepId === repKey ? '−' : '+'}</div>
                    </div>
                </div>
                <div class="chapters-detail ${currentlyOpenRepId === repKey ? 'open' : ''}"></div>
            `;

      const header = repItem.querySelector('.repertoire-header');
      const detail = repItem.querySelector('.chapters-detail');
      const icon = repItem.querySelector('.toggle-icon');

      header.onclick = async () => {
        const isOpen = detail.classList.contains('open');

        document.querySelectorAll('.chapters-detail').forEach((d) => {
          d.classList.remove('open');
        });
        document.querySelectorAll('.toggle-icon').forEach((i) => {
          i.textContent = '+';
        });

        const oneHour = 60 * 60 * 1000;
        const totalMoves = rep.dbChapters.reduce(
          (acc, c) => acc + c.white_moves + c.black_moves,
          0
        );
        const needsSync =
          totalMoves === 0 ||
          !rep.lichess_updated_at ||
          Date.now() - new Date(rep.lichess_updated_at).getTime() > oneHour;

        if (!isOpen) {
          currentlyOpenRepId = repKey;
          detail.classList.add('open');
          icon.textContent = '−';
          expandRepertoire(rep, detail, normalizedId, needsSync);
        } else {
          currentlyOpenRepId = null;
        }
      };

      if (currentlyOpenRepId === repKey) {
        detail.classList.add('open');
        icon.textContent = '−';
        setTimeout(() => {
          expandRepertoire(rep, detail, normalizedId, false);
        }, 0);
      }

      repertoireListEl.appendChild(repItem);
    });
  };

  const expandRepertoire = (rep, detail, normalizedId, autoSync = false) => {
    const renderChapters = () => {
      detail.innerHTML = '';
      rep.dbChapters.forEach((chap) => {
        const hist = rep.chaptersHistory[chap.id];
        const latest = hist && hist.revisions.length > 0 ? hist.revisions[0] : null;
        const hasData = latest !== null;
        const moveCount = rep.color === 'white' ? chap.white_moves : chap.black_moves;

        let finalSuccessRate = 0;
        let isUpdated = false;

        if (hasData) {
          let successfulMoves = Math.max(0, latest.total_moves - latest.errors);
          if (moveCount !== latest.total_moves && latest.total_moves > 0) {
            isUpdated = true;
            finalSuccessRate =
              moveCount > 0
                ? Math.min(100, Math.max(0, Math.round((successfulMoves / moveCount) * 100)))
                : 0;
          } else {
            finalSuccessRate =
              latest.total_moves > 0
                ? Math.max(0, Math.round((successfulMoves / latest.total_moves) * 100))
                : 0;
          }
        }

        const successClass = hasData
          ? finalSuccessRate >= 80
            ? 'success-rate'
            : finalSuccessRate < 50
              ? 'low-success'
              : ''
          : '';
        const chapRow = document.createElement('div');
        chapRow.className = 'chapter-row';

        let progressHtml = hasData
          ? `<div class="mini-progress-bg"><div class="mini-progress-fill" style="width: ${finalSuccessRate}%; background: ${finalSuccessRate >= 80 ? 'var(--success)' : finalSuccessRate < 50 ? 'var(--danger)' : 'var(--warning)'}"></div></div>`
          : '';
        const chapTitleHtml = isUpdated
          ? `<strong>${chap.title.replace(rep.title + ': ', '')} <span style="display: inline-block; line-height: 1; color: var(--warning); font-size: 10px; border: 1px solid var(--warning); padding: 2px 4px; border-radius: 4px; margin-left: 4px; vertical-align: middle;">MAJ</span></strong>`
          : `<strong>${chap.title.replace(rep.title + ': ', '')}</strong>`;

        chapRow.innerHTML = `
            <div class="chapter-info-grid">
                <div class="chapter-name-col">
                    <span class="label">Chapitre</span>
                    <div class="chapter-title-text">${chapTitleHtml}</div>
                </div>
                <div class="chapter-stat-col">
                    <span class="label">Succès</span>
                    <span class="${successClass}">${hasData ? finalSuccessRate + '%' : '-'}</span>
                    ${progressHtml}
                </div>
                <div class="chapter-stat-col">
                    <span class="label">Coups</span>
                    <strong style="color: var(--text-main); font-weight: normal;">${moveCount}</strong>
                </div>
                <div class="chapter-stat-col">
                    <span class="label">Dernière</span>
                    <span style="color: var(--text-muted);">${formatRelativeTime(latest ? latest.date : null)}</span>
                </div>
                <div class="play-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </div>`;

        chapRow.onclick = (e) => {
          e.stopPropagation();
          const existingActions = chapRow.querySelector('.inline-actions');
          if (existingActions) {
            existingActions.remove();
            return;
          }

          document.querySelectorAll('.inline-actions').forEach((el) => el.remove());

          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'inline-actions fade-in';
          actionsDiv.style.cssText =
            'grid-column: 1 / -1; display: flex; gap: 8px; margin-top: 8px; padding: 8px; background: var(--bg-hover); border-radius: 6px;';

          const decBtn = document.createElement('button');
          decBtn.className = 'primary';
          decBtn.style.cssText = 'flex: 1; padding: 8px; font-size: 13px;';
          decBtn.textContent = 'Mode découverte';
          decBtn.onclick = (evt) => {
            evt.stopPropagation();
            startTrainingSessionDirect(normalizedId, rep.title, chap.id, rep.color, 'decouverte');
          };

          const revBtn = document.createElement('button');
          revBtn.className = 'secondary';
          revBtn.style.cssText = 'flex: 1; padding: 8px; font-size: 13px;';
          revBtn.textContent = 'Mode révision';
          revBtn.onclick = (evt) => {
            evt.stopPropagation();
            startTrainingSessionDirect(normalizedId, rep.title, chap.id, rep.color, 'revision');
          };

          actionsDiv.appendChild(decBtn);
          actionsDiv.appendChild(revBtn);
          chapRow.appendChild(actionsDiv);
        };
        detail.appendChild(chapRow);
      });

      const footer = document.createElement('div');
      footer.style.cssText =
        'display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 15px; paddingTop: 12px; borderTop: 1px solid var(--border-color);';

      const lichessBtn = document.createElement('button');
      lichessBtn.className = 'secondary';
      lichessBtn.style.cssText =
        'font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--text-muted); box-shadow: none; border: none; cursor: pointer; transition: color 0.2s;';
      lichessBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 22 3 22 10"></polyline><line x1="14" y1="10" x2="22" y2="2"></line></svg> Lichess`;
      lichessBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open(`https://lichess.org/study/${normalizedId}`, '_blank');
      };
      footer.appendChild(lichessBtn);

      const syncBtn = document.createElement('button');
      syncBtn.className = 'secondary';
      syncBtn.style.cssText =
        'font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--text-muted); box-shadow: none; border: none; cursor: pointer; transition: color 0.2s;';
      syncBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Synchroniser`;
      syncBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        syncFromLichess(true);
      };
      footer.appendChild(syncBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'secondary';
      delBtn.style.cssText =
        'font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--text-muted); box-shadow: none; border: none; cursor: pointer; transition: color 0.2s;';
      delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg> Supprimer`;
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!confirm('Voulez-vous vraiment supprimer ce répertoire ?')) {
          return;
        }
        try {
          const res = await fetch(
            `/api/repertoires?repertoire_id=${encodeURIComponent(normalizedId)}&color=${encodeURIComponent(rep.color)}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${state.authToken}` },
            }
          );
          if (res.ok) {
            currentlyOpenRepId = null;
            showToast('Répertoire supprimé', 'success');
            fetchHistory();
          }
        } catch (err) {
          console.error('Delete repertoire error:', err);
        }
      };
      footer.appendChild(delBtn);
      detail.appendChild(footer);
    };

    const syncFromLichess = async (force = false) => {
      if (!force && !autoSync) {
        renderChapters();
        return;
      }

      detail.innerHTML =
        '<div style="padding: 15px; text-align: center; color: var(--text-muted);">Synchronisation Lichess...</div>';

      try {
        const token = state.authToken || localStorage.getItem('chess_token');
        const response = await fetch(`/api/lichess/study/${normalizedId}.pgn?v=${Date.now()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error('Lichess error');
        }
        const pgnText = await response.text();
        const allChapters = parseMultiPgn(pgnText);
        const currentStudyName = pgnText.match(/\[StudyName "(.*?)"\]/)?.[1] || rep.title;

        const chaptersWithMoves = allChapters.map((chap) => {
          let white_moves = 0;
          let black_moves = 0;
          try {
            const tempRoot = buildRepertoireTree(chap.pgn);
            const countMoves = (n) => {
              if (n.id !== 'root') {
                if (n.color === 'white') white_moves++;
                if (n.color === 'black') black_moves++;
              }
              n.children.forEach(countMoves);
            };
            countMoves(tempRoot);
          } catch (e) {
            console.error('Count moves error:', e);
          }
          return { id: chap.id, title: chap.title, white_moves, black_moves, pgn: chap.pgn };
        });

        if (state.authToken) {
          await fetch('/api/repertoires', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${state.authToken}`,
            },
            body: JSON.stringify({
              repertoire_id: normalizedId,
              title: currentStudyName,
              color: rep.color,
              chapters: chaptersWithMoves.map((c) => ({
                id: c.id,
                title: c.title,
                white_moves: c.white_moves,
                black_moves: c.black_moves,
              })),
            }),
          });
        }

        saveToCache(normalizedId + '_' + rep.color, {
          chapters: chaptersWithMoves,
          title: currentStudyName,
        });

        // Use fetchHistory to re-fetch and render the updated data properly
        fetchHistory();
      } catch (err) {
        console.error('Lichess sync error:', err);
        detail.innerHTML = `<div style="padding: 15px; text-align: center; color: var(--danger);">Erreur lors de la synchronisation.</div>`;
      }
    };
    syncFromLichess();
  };

  if (whiteReps.length > 0) {
    repertoireListEl.appendChild(createSectionHeader('Blancs'));
    renderRepList(whiteReps);
  }
  if (blackReps.length > 0) {
    repertoireListEl.appendChild(createSectionHeader('Noirs'));
    renderRepList(blackReps);
  }
};

export const saveHistory = async (stats) => {
  if (!state.authToken) {
    return;
  }
  try {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.authToken}` },
      body: JSON.stringify({
        ...stats,
        color: state.playerColor,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      document.getElementById('logoutBtn').click();
    } else {
      fetchHistory();
    }
  } catch (err) {
    console.error('Save history error:', err);
  }
};

export const updateChapterList = () => {
  if (!state.currentRepertoire) {
    return;
  }
  const chapterListEl = document.getElementById('chapterList');
  const chapterSelectionArea = document.getElementById('chapter-selection-area');

  state.playerColor = getToggleState('colorToggle');
  chapterListEl.innerHTML = '';

  if (state.currentRepertoire.chapters.length === 1) {
    chapterSelectionArea.classList.add('hidden');
  } else {
    chapterSelectionArea.classList.remove('hidden');
    state.currentRepertoire.chapters.forEach((chap) => {
      let moveCount = 0;
      try {
        const tempRoot = buildRepertoireTree(chap.pgn);
        const countMoves = (n) => {
          if (n.id !== 'root' && n.color === state.playerColor) {
            moveCount++;
          }
          n.children.forEach(countMoves);
        };
        countMoves(tempRoot);
      } catch (e) {
        console.error('Count moves error:', e);
      }
      const btn = document.createElement('div');
      btn.className = 'chapter-btn';
      btn.style.cursor = 'default';
      btn.innerHTML = `<span>${chap.title}</span><span class="chapter-count">${moveCount} coups</span>`;
      chapterListEl.appendChild(btn);
    });
  }
};

export const loadLichessStudy = async (input) => {
  document.getElementById('config-card').style.display = 'none';
  if (!input) {
    return;
  }
  const repertoireId = extractStudyId(input);
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.disabled = true;
  loadBtn.textContent = 'Chargement...';
  try {
    const token = state.authToken || localStorage.getItem('chess_token');
    const response = await fetch(`/api/lichess/study/${repertoireId}.pgn?v=${Date.now()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error('Étude non trouvée ou accès refusé.');
    }
    const pgnText = await response.text();
    const studyName =
      pgnText.match(/\[StudyName "(.*?)"\]/)?.[1] || `Étude Lichess (${repertoireId})`;
    state.currentRepertoire = { title: studyName, chapters: parseMultiPgn(pgnText) };
    document.getElementById('config-title').textContent = `Répertoire : ${studyName}`;
    document.getElementById('config-card').style.display = 'flex';
    updateChapterList();
    showToast("Étude chargée avec succès, vous pouvez maintenant l'ajouter.", 'success');
    document.getElementById('config-card').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Charger l'étude";
  }
};

export const initDashboard = () => {
  initToggles();
  document.getElementById('colorToggle').onclick = () => {
    setTimeout(updateChapterList, 50);
  };

  document.getElementById('loadBtn').onclick = () => {
    loadLichessStudy(document.getElementById('lichessInput').value.trim());
  };

  document.getElementById('addRepertoireBtn').onclick = async () => {
    if (!state.currentRepertoire || !state.authToken) return;

    const repertoireId = extractStudyId(document.getElementById('lichessInput').value.trim());
    const color = getToggleState('colorToggle');

    const chaptersWithMoves = state.currentRepertoire.chapters.map((chap) => {
      let white_moves = 0;
      let black_moves = 0;
      try {
        const tempRoot = buildRepertoireTree(chap.pgn);
        const countMoves = (n) => {
          if (n.id !== 'root') {
            if (n.color === 'white') white_moves++;
            if (n.color === 'black') black_moves++;
          }
          n.children.forEach(countMoves);
        };
        countMoves(tempRoot);
      } catch (e) {
        console.error('Count moves error:', e);
      }
      return { id: chap.id, title: chap.title, white_moves, black_moves };
    });

    try {
      const res = await fetch('/api/repertoires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.authToken}` },
        body: JSON.stringify({
          repertoire_id: repertoireId,
          title: state.currentRepertoire.title,
          color: color,
          chapters: chaptersWithMoves,
        }),
      });
      if (res.ok) {
        showToast('Répertoire ajouté avec succès', 'success');
        document.getElementById('config-card').style.display = 'none';
        document.getElementById('lichessInput').value = '';
        fetchHistory(); // Refresh dashboard
      } else {
        const data = await res.json();
        showToast(data.error || "Erreur lors de l'ajout", 'error');
      }
    } catch (err) {
      console.error('Add repertoire error:', err);
      showToast('Erreur de connexion', 'error');
    }
  };

  // Lichess OAuth Callbacks and Button setup
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('lichess_error')) {
    setTimeout(() => showToast('Erreur Lichess : ' + urlParams.get('lichess_error'), 'error'), 500);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

const fetchPendingInvitations = async () => {
  if (!state.authToken) {
    return;
  }
  const container = document.getElementById('sharesNotifications');
  if (!container) {
    return;
  }

  try {
    const res = await fetch('/api/shares/pending', {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });

    if (res.ok) {
      const invitations = await res.json();
      renderPendingInvitations(invitations);
    }
  } catch (err) {
    console.error('Failed to fetch pending share invitations:', err);
  }
};

const renderPendingInvitations = (invitations) => {
  const container = document.getElementById('sharesNotifications');
  if (!container) {
    return;
  }

  if (invitations.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = invitations
    .map((inv) => {
      const colorText = inv.color === 'white' ? 'Blancs' : 'Noirs';
      return `
        <div class="setup-card" style="border-left: 4px solid var(--primary); display: flex; flex-direction: column; gap: 12px; padding: 16px;">
          <div style="font-size: 14px; line-height: 1.4;">
            <strong>${inv.teacher_username}</strong> vous propose d'ajouter l'étude : 
            <strong style="color: var(--primary);">${inv.repertoire_title}</strong> (${colorText}).
          </div>
          <div style="display: flex; gap: 8px; align-self: flex-start;">
            <button class="primary accept-share-btn" data-id="${inv.id}" style="padding: 6px 12px; font-size: 12px;">
              Accepter
            </button>
            <button class="secondary decline-share-btn" data-id="${inv.id}" style="padding: 6px 12px; font-size: 12px;">
              Refuser
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach click handlers
  container.querySelectorAll('.accept-share-btn').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.textContent = 'Acceptation...';
      try {
        const res = await fetch(`/api/shares/${id}/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.authToken}` },
        });
        if (res.ok) {
          showToast('Étude acceptée et ajoutée à vos répertoires !', 'success');
          fetchHistory();
        } else {
          const err = await res.json();
          throw new Error(err.error || "Erreur lors de l'acceptation.");
        }
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Accepter';
      }
    };
  });

  container.querySelectorAll('.decline-share-btn').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.textContent = 'Refus...';
      try {
        const res = await fetch(`/api/shares/${id}/decline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.authToken}` },
        });
        if (res.ok) {
          showToast('Invitation déclinée.', 'info');
          fetchHistory();
        } else {
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors du refus.');
        }
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Refuser';
      }
    };
  });
};
