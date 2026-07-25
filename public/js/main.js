import { initAuth, updateAuthUI } from './auth.js';
import { initDashboard } from './dashboard.js';
import { initTraining } from './training.js';
import { showToast, applyBoardTheme, applyPiecesTheme } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  // Top bar buttons
  const helpModal = document.getElementById('helpModal');
  const helpBtn = document.getElementById('helpBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

  const settingsModal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');

  helpBtn.onclick = () => {
    helpModal.classList.add('show');
    const body = helpModal.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
  };
  closeHelpBtn.onclick = () => {
    helpModal.classList.remove('show');
  };
  helpModal.onclick = (e) => {
    if (e.target === helpModal) {
      helpModal.classList.remove('show');
    }
  };

  settingsBtn.onclick = () => {
    settingsModal.classList.add('show');
    const body = settingsModal.querySelector('.modal-body');
    if (body) body.scrollTop = 0;

    const showBtn = document.getElementById('showDeleteAccountBtn');
    const area = document.getElementById('deleteAccountConfirmArea');
    const form = document.getElementById('deleteAccountForm');
    if (showBtn && area && form) {
      showBtn.classList.remove('hidden');
      area.classList.add('hidden');
      form.reset();
    }
  };
  closeSettingsBtn.onclick = () => {
    settingsModal.classList.remove('show');
  };
  settingsModal.onclick = (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('show');
    }
  };

  document.getElementById('homeBtn').onclick = () => {
    // check if training is active
    if (!document.getElementById('training-view').classList.contains('hidden')) {
      const stopBtn = document.getElementById('stopBtn');
      if (stopBtn) {
        stopBtn.click();
      }
    } else if (!document.getElementById('teacher-view').classList.contains('hidden')) {
      // Return to main setup if teacher space is open
      const backBtn = document.getElementById('backToDashboardBtn');
      if (backBtn) {
        backBtn.click();
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Initialize modules
  initAuth();
  initDashboard();
  initTraining();

  // Initial UI update
  updateAuthUI();

  // Initialize preferences (DB with localStorage fallback)
  const syncPreferences = async () => {
    const boardSelect = document.getElementById('boardThemeSelect');
    const piecesSelect = document.getElementById('piecesThemeSelect');
    const revisionSelect = document.getElementById('revisionModeSelect');

    const applyLocalFallbacks = () => {
      let savedRevisionMode = localStorage.getItem('chess_revision_mode');
      if (!savedRevisionMode) {
        if (localStorage.getItem('chess_expert_mode') === 'on') {
          savedRevisionMode = 'positions_expert';
        } else if (localStorage.getItem('chess_random_mode') === 'on') {
          savedRevisionMode = 'random_variations';
        } else {
          savedRevisionMode = 'normal';
        }
      }
      const savedBoardTheme = localStorage.getItem('chess_board_theme') || 'classic';
      const savedPiecesTheme = localStorage.getItem('chess_pieces_theme') || 'cburnett';

      if (revisionSelect) revisionSelect.value = savedRevisionMode;
      if (boardSelect) boardSelect.value = savedBoardTheme;
      if (piecesSelect) piecesSelect.value = savedPiecesTheme;

      applyBoardTheme(savedBoardTheme);
      applyPiecesTheme(savedPiecesTheme);
    };

    const token = localStorage.getItem('chess_token');
    if (!token) {
      applyLocalFallbacks();
      return;
    }
    try {
      const res = await fetch('/api/preferences', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const revMode =
          data.revision_mode ||
          (data.expert_mode
            ? 'positions_expert'
            : data.random_mode
              ? 'random_variations'
              : 'normal');
        const boardTheme = data.board_theme || 'classic';
        const piecesTheme = data.pieces_theme || 'cburnett';

        localStorage.setItem('chess_revision_mode', revMode);
        localStorage.setItem('chess_board_theme', boardTheme);
        localStorage.setItem('chess_pieces_theme', piecesTheme);

        if (revisionSelect) revisionSelect.value = revMode;
        if (boardSelect) boardSelect.value = boardTheme;
        if (piecesSelect) piecesSelect.value = piecesTheme;

        applyBoardTheme(boardTheme);
        applyPiecesTheme(piecesTheme);
      } else {
        applyLocalFallbacks();
      }
    } catch (e) {
      console.error('Error fetching preferences:', e);
      applyLocalFallbacks();
    }
  };
  syncPreferences();

  // Save Preferences to API helper
  const savePreferencesCloud = async () => {
    const token = localStorage.getItem('chess_token');
    if (!token) return;

    const revisionSelect = document.getElementById('revisionModeSelect');
    const revMode = revisionSelect
      ? revisionSelect.value
      : localStorage.getItem('chess_revision_mode') || 'normal';
    const boardSelect = document.getElementById('boardThemeSelect');
    const piecesSelect = document.getElementById('piecesThemeSelect');

    const boardTheme = boardSelect ? boardSelect.value : 'classic';
    const piecesTheme = piecesSelect ? piecesSelect.value : 'cburnett';

    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          revision_mode: revMode,
          random_mode: revMode === 'random_variations',
          expert_mode: revMode === 'positions_expert',
          board_theme: boardTheme,
          pieces_theme: piecesTheme,
        }),
      });
    } catch (e) {
      console.error('Error saving preferences:', e);
    }
  };

  // Save Revision Mode on change
  const revisionSelect = document.getElementById('revisionModeSelect');
  if (revisionSelect) {
    revisionSelect.addEventListener('change', async () => {
      const val = revisionSelect.value;
      localStorage.setItem('chess_revision_mode', val);
      let label = 'Normal (Séquentiel)';
      if (val === 'random_variations') {
        label = 'Variantes aléatoires';
      } else if (val === 'positions_expert') {
        label = 'Positions aléatoires (Expert)';
      }
      showToast(`Mode de révision : ${label}`, 'info', 2500, 'toast-revision-mode');
      await savePreferencesCloud();
    });
  }

  // Save Board Theme on change
  const boardSelect = document.getElementById('boardThemeSelect');
  if (boardSelect) {
    boardSelect.addEventListener('change', async () => {
      const theme = boardSelect.value;
      localStorage.setItem('chess_board_theme', theme);
      applyBoardTheme(theme);
      showToast("Thème de l'échiquier mis à jour", 'success', 2000, 'toast-theme');
      await savePreferencesCloud();
    });
  }

  // Save Pieces Theme on change
  const piecesSelect = document.getElementById('piecesThemeSelect');
  if (piecesSelect) {
    piecesSelect.addEventListener('change', async () => {
      const theme = piecesSelect.value;
      localStorage.setItem('chess_pieces_theme', theme);
      applyPiecesTheme(theme);
      showToast('Style des pièces mis à jour', 'success', 2000, 'toast-theme');
      await savePreferencesCloud();
    });
  }
});
