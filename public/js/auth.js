import { showToast, state } from './utils.js';
import { fetchHistory } from './dashboard.js';

const setupView = document.getElementById('setup-view');
const mainSetupContent = document.getElementById('main-setup-content');
const topBar = document.getElementById('top-bar');
const authSection = document.getElementById('auth-section');
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const forgotView = document.getElementById('forgot-view');
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
        fetch(`/api/verify-email/${verifyToken}`).then(r => r.json()).then(data => {
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
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                state.authToken = data.token;
                localStorage.setItem('chess_token', data.token);
                localStorage.setItem('chess_user', JSON.stringify(data.user));
                showToast("Connexion réussie", 'success');
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
                body: JSON.stringify({ username, email, password })
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
                body: JSON.stringify({ email })
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
                body: JSON.stringify({ token: resetToken, newPassword })
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
        showToast("Déconnexion réussie", 'info');
        updateAuthUI();
    };
};
