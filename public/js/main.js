import { initAuth, updateAuthUI } from './auth.js';
import { initDashboard } from './dashboard.js';
import { initTraining } from './training.js';

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
});
