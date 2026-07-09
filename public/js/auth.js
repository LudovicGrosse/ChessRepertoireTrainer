import { showToast, state } from './utils.js';
import { fetchHistory } from './dashboard.js';

const setupView = document.getElementById('setup-view');
const mainSetupContent = document.getElementById('main-setup-content');
const topBar = document.getElementById('top-bar');
const authSection = document.getElementById('auth-section');
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
  } else {
    authSection.classList.remove('hidden');
    document.getElementById('main-title').classList.remove('hidden');
    mainSetupContent.classList.add('hidden');
    topBar.classList.add('hidden');
  }
};

export const initAuth = () => {
  // Check URL parameters for Lichess authentication redirection
  const urlParams = new URLSearchParams(window.location.search);
  const lichessToken = urlParams.get('token');
  const lichessUsername = urlParams.get('username');

  if (lichessToken && lichessUsername) {
    state.authToken = lichessToken;
    localStorage.setItem('chess_token', lichessToken);
    localStorage.setItem('chess_user', JSON.stringify({ username: lichessUsername }));
    showToast('Connexion réussie', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
    updateAuthUI();
  }

  // Handle Lichess Login redirection
  const lichessLoginBtn = document.getElementById('lichessLoginBtn');
  if (lichessLoginBtn) {
    lichessLoginBtn.onclick = async () => {
      try {
        const res = await fetch('/api/lichess/login-url');
        const data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || 'Impossible de démarrer la connexion avec Lichess.');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  document.getElementById('logoutBtn').onclick = () => {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
      settingsModal.classList.remove('show');
    }

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
    };
  }

  if (deleteAccountForm) {
    deleteAccountForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/account', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.authToken}`,
          },
        });
        const data = await res.json();

        if (res.ok) {
          showToast(data.message, 'success');
          if (settingsModal) {
            settingsModal.classList.remove('show');
          }
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
