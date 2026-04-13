import { initAuth, updateAuthUI } from './auth.js';
import { initDashboard } from './dashboard.js';
import { initTraining } from './training.js';

document.addEventListener('DOMContentLoaded', () => {
  // Top bar buttons
  const helpModal = document.getElementById('helpModal');
  const helpBtn = document.getElementById('helpBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

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

  document.getElementById('homeBtn').onclick = () => {
    // check if training is active by checking class
    if (!document.getElementById('training-view').classList.contains('hidden')) {
      document.getElementById('stopBtn').click();
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
