import { showToast, state } from './utils.js';
import { fetchHistory, updateLichessStatus } from './dashboard.js';

const setupView = document.getElementById('setup-view');
const mainSetupContent = document.getElementById('main-setup-content');
const topBar = document.getElementById('top-bar');
const authSection = document.getElementById('auth-section');
const loginView = document.getElementById('login-view');
const resetView = document.getElementById('reset-view');
const displayUsername = document.getElementById('displayUsername');
const trainingView = document.getElementById('training-view');

export const updateAuthUI = () => {
  if (state.authToken) {
    const user = JSON.parse(localStorage.getItem('chess_user'));
    if (!user) {
      state.authToken = null;
      localStorage.removeItem('chess_token');
      updateAuthUI();
      return;
    }
    authSection.classList.add('hidden');
    document.getElementById('main-title').classList.add('hidden');
    mainSetupContent.classList.remove('hidden');
    mainSetupContent.classList.add('fade-in');
    topBar.classList.remove('hidden');
    displayUsername.textContent = user.username || 'Utilisateur';
    fetchHistory();
    updateLichessStatus();
  } else {
    authSection.classList.remove('hidden');
    document.getElementById('main-title').classList.remove('hidden');
    mainSetupContent.classList.add('hidden');
    topBar.classList.add('hidden');
  }
};

export const switchView = (hideId, showId) => {
  document.getElementById(hideId).classList.add('hidden');
  const showEl = document.getElementById(showId);
  showEl.classList.remove('hidden');
  showEl.classList.add('fade-in');
};

export const initAuth = () => {
  document.querySelectorAll('.password-toggle').forEach((toggle) => {
    toggle.onclick = (e) => {
      e.preventDefault();
      const input = toggle.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
      } else {
        input.type = 'password';
        toggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      }
    };
  });

  document.getElementById('showRegisterBtn').onclick = () => {
    switchView('login-view', 'register-view');
  };
  document.getElementById('showLoginBtn').onclick = () => {
    switchView('register-view', 'login-view');
  };
  document.getElementById('showForgotBtn').onclick = () => {
    switchView('login-view', 'forgot-view');
  };
  document.getElementById('backToLoginBtn').onclick = () => {
    switchView('forgot-view', 'login-view');
  };

  const urlParams = new URLSearchParams(window.location.search);
  const verifyToken = urlParams.get('verify');
  const resetToken = urlParams.get('reset');

  if (verifyToken) {
    fetch(`/api/verify-email/${verifyToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message) {
          showToast(data.message, 'success');
        } else {
          showToast(data.error, 'error');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      });
  }

  if (resetToken) {
    loginView.classList.add('hidden');
    resetView.classList.remove('hidden');
  }

  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        state.authToken = data.token;
        localStorage.setItem('chess_token', data.token);
        localStorage.setItem('chess_user', JSON.stringify(data.user));
        showToast('Connexion réussie', 'success');
        updateAuthUI();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  document.getElementById('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        switchView('register-view', 'login-view');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  document.getElementById('forgotForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  document.getElementById('resetForm').onsubmit = async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value.trim();
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        switchView('reset-view', 'login-view');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  document.getElementById('logoutBtn').onclick = () => {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) settingsModal.classList.remove('show');

    state.isTraining = false;
    trainingView.classList.add('hidden');
    setupView.classList.remove('hidden');
    setupView.classList.add('fade-in');
    state.game.reset();
    if (state.cg) {
      state.cg.set({ drawable: { autoShapes: [] } });
    }

    state.authToken = null;
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_user');
    showToast('Déconnexion réussie', 'info');
    updateAuthUI();
  };

  const showDeleteAccountBtn = document.getElementById('showDeleteAccountBtn');
  const cancelDeleteAccountBtn = document.getElementById('cancelDeleteAccountBtn');
  const deleteAccountConfirmArea = document.getElementById('deleteAccountConfirmArea');
  const deleteAccountForm = document.getElementById('deleteAccountForm');
  const settingsModal = document.getElementById('settingsModal');

  if (showDeleteAccountBtn) {
    showDeleteAccountBtn.onclick = () => {
      showDeleteAccountBtn.classList.add('hidden');
      deleteAccountConfirmArea.classList.remove('hidden');
    };
  }

  if (cancelDeleteAccountBtn) {
    cancelDeleteAccountBtn.onclick = () => {
      deleteAccountConfirmArea.classList.add('hidden');
      showDeleteAccountBtn.classList.remove('hidden');
      document.getElementById('deleteAccountPassword').value = '';
    };
  }

  if (deleteAccountForm) {
    deleteAccountForm.onsubmit = async (e) => {
      e.preventDefault();
      const password = document.getElementById('deleteAccountPassword').value;
      if (!password) return;

      try {
        const res = await fetch('/api/account', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.authToken}`,
          },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();

        if (res.ok) {
          showToast(data.message, 'success');
          // Hide modal
          if (settingsModal) settingsModal.classList.remove('show');
          // Trigger logout logic
          document.getElementById('logoutBtn').click();
        } else {
          throw new Error(data.error || 'Erreur lors de la suppression du compte.');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
};
