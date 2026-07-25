import { initAuth, updateAuthUI } from './auth.js';
import { initDashboard } from './dashboard.js';
import { initTraining } from './training.js';
import {
  setToggleState,
  getToggleState,
  showToast,
  applyBoardTheme,
  applyPiecesTheme,
} from './utils.js';

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

    const applyLocalFallbacks = () => {
      const savedRandomMode = localStorage.getItem('chess_random_mode') || 'off';
      const savedExpertMode = localStorage.getItem('chess_expert_mode') || 'off';
      const savedBoardTheme = localStorage.getItem('chess_board_theme') || 'classic';
      const savedPiecesTheme = localStorage.getItem('chess_pieces_theme') || 'cburnett';

      setToggleState('randomModeToggle', savedRandomMode);
      setToggleState('expertModeToggle', savedExpertMode);
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
        const mode = data.random_mode ? 'on' : 'off';
        const expertMode = data.expert_mode ? 'on' : 'off';
        const boardTheme = data.board_theme || 'classic';
        const piecesTheme = data.pieces_theme || 'cburnett';

        localStorage.setItem('chess_random_mode', mode);
        localStorage.setItem('chess_expert_mode', expertMode);
        localStorage.setItem('chess_board_theme', boardTheme);
        localStorage.setItem('chess_pieces_theme', piecesTheme);

        setToggleState('randomModeToggle', mode);
        setToggleState('expertModeToggle', expertMode);
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

    const currentMode = getToggleState('randomModeToggle');
    const currentExpertMode = getToggleState('expertModeToggle');
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
          random_mode: currentMode === 'on',
          expert_mode: currentExpertMode === 'on',
          board_theme: boardTheme,
          pieces_theme: piecesTheme,
        }),
      });
    } catch (e) {
      console.error('Error saving preferences:', e);
    }
  };

  // Save Random Mode on change
  const randomToggle = document.getElementById('randomModeToggle');
  if (randomToggle) {
    randomToggle.addEventListener('click', () => {
      setTimeout(async () => {
        const currentMode = getToggleState('randomModeToggle');
        localStorage.setItem('chess_random_mode', currentMode);
        showToast(
          `Mode aléatoire : ${currentMode === 'on' ? 'activé' : 'désactivé'}`,
          'info',
          3000,
          'toast-random-mode'
        );
        await savePreferencesCloud();
      }, 0);
    });
  }

  // Save Expert Mode on change
  const expertToggle = document.getElementById('expertModeToggle');
  if (expertToggle) {
    expertToggle.addEventListener('click', () => {
      setTimeout(async () => {
        const currentMode = getToggleState('expertModeToggle');
        localStorage.setItem('chess_expert_mode', currentMode);
        showToast(
          `Mode expert : ${currentMode === 'on' ? 'activé' : 'désactivé'}`,
          'info',
          3000,
          'toast-expert-mode'
        );
        await savePreferencesCloud();
      }, 0);
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
