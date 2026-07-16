import { initAuth, updateAuthUI } from './auth.js';
import { initDashboard } from './dashboard.js';
import { initTraining } from './training.js';
import { setToggleState, getToggleState, showToast } from './utils.js';

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

  // Initialize Random Mode toggle from localStorage
  const savedRandomMode = localStorage.getItem('chess_random_mode') || 'off';
  setToggleState('randomModeToggle', savedRandomMode);

  // Save Random Mode on change
  const randomToggle = document.getElementById('randomModeToggle');
  if (randomToggle) {
    randomToggle.addEventListener('click', () => {
      setTimeout(() => {
        const currentMode = getToggleState('randomModeToggle');
        localStorage.setItem('chess_random_mode', currentMode);
        showToast(`Mode aléatoire : ${currentMode === 'on' ? 'activé' : 'désactivé'}`, 'info');
      }, 0);
    });
  }
});
