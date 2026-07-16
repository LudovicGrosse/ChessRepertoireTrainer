import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm';

export const state = {
  game: new Chess(),
  cg: null,
  rootNode: null,
  currentNode: null,
  playerColor: 'white',
  trainingMode: 'decouverte',
  isTraining: false,
  currentRepertoire: null,
  currentChapterIndex: -1,
  selectedChapterPgn: null,
  currentPath: [],
  viewIndex: 0,
  totalMoves: 0,
  learnedMoves: 0,
  totalVariations: 0,
  learnedVariations: 0,
  errorCount: 0,
  currentMoveErrorLogged: false,
  authToken: localStorage.getItem('chess_token'),
};

export const showToast = (message, type = 'info', duration = 3000, toastId = null) => {
  const container = document.getElementById('toast-container');

  if (toastId) {
    const existing = document.getElementById(toastId);
    if (existing) {
      existing.remove();
    }
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  if (toastId) {
    toast.id = toastId;
  }

  let icon = 'ℹ️';
  if (type === 'success') {
    icon = '✅';
  }
  if (type === 'error') {
    icon = '❌';
  }
  if (type === 'warning') {
    icon = '⚠️';
  }

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }
  }, duration);
};

export const extractStudyId = (input) => {
  if (!input) {
    return null;
  }
  if (input.includes('lichess.org/study/')) {
    const match = input.match(/lichess\.org\/study\/([a-zA-Z0-9]{8})/);
    return match ? match[1] : input;
  }
  if (input.includes('/')) {
    return input.split('/')[0];
  }
  return input.trim();
};

export const getToggleState = (id) => {
  const activeOpt = document.getElementById(id).querySelector('.toggle-option.active');
  return activeOpt ? activeOpt.dataset.val : null;
};

export const setToggleState = (id, value) => {
  const container = document.getElementById(id);
  const options = container.querySelectorAll('.toggle-option');
  options.forEach((opt) => {
    if (opt.dataset.val === value) {
      opt.classList.add('active');
      container.dataset.state = opt === options[0] ? 'left' : 'right';
    } else {
      opt.classList.remove('active');
    }
  });
};

export const initToggles = () => {
  document.querySelectorAll('.toggle-container').forEach((container) => {
    if (container.classList.contains('share-color-toggle')) {
      return;
    }
    container.addEventListener('click', () => {
      const activeOpt = container.querySelector('.toggle-option.active');
      if (!activeOpt) {
        return;
      }
      const currentVal = activeOpt.dataset.val;
      const otherOpt = Array.from(container.querySelectorAll('.toggle-option')).find(
        (opt) => opt.dataset.val !== currentVal
      );
      if (otherOpt) {
        setToggleState(container.id, otherOpt.dataset.val);
      }
    });
  });
};

export const formatRelativeTime = (date) => {
  if (!date) {
    return 'Jamais';
  }
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return "À l'instant";
  }
  if (minutes < 60) {
    return `Il y a ${minutes} min`;
  }
  if (hours < 24) {
    return `Il y a ${hours} ${hours > 1 ? 'heures' : 'heure'}`;
  }
  if (days < 30) {
    return `Il y a ${days} ${days > 1 ? 'jours' : 'jour'}`;
  }
  if (months < 12) {
    return `Il y a ${months} mois`;
  }
  return `Il y a ${years} ${years > 1 ? 'ans' : 'an'}`;
};

export const showConfirmModal = (title, message) => {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYesBtn');
    const noBtn = document.getElementById('confirmNoBtn');

    titleEl.textContent = title;
    messageEl.textContent = message;

    if (title === 'Quitter') {
      titleEl.style.color = 'var(--danger)';
      yesBtn.className = 'danger';
    } else {
      titleEl.style.color = 'var(--primary)';
      yesBtn.className = 'primary';
    }

    modal.classList.add('show');

    const cleanUp = (result) => {
      modal.classList.remove('show');
      yesBtn.onclick = null;
      noBtn.onclick = null;
      resolve(result);
    };

    yesBtn.onclick = () => cleanUp(true);
    noBtn.onclick = () => cleanUp(false);
  });
};

export const applyBoardTheme = (theme) => {
  const themes = {
    classic: { light: '#f0d9b5', dark: '#b58863' },
    blue: { light: '#dee3e6', dark: '#8ca2ad' },
    green: { light: '#eeeed2', dark: '#769656' },
    wood: { light: '#dca06c', dark: '#8b4c2b' },
    grey: { light: '#e1e1e1', dark: '#a0a0a0' },
  };
  const colors = themes[theme] || themes.classic;
  document.documentElement.style.setProperty('--light-sq', colors.light);
  document.documentElement.style.setProperty('--dark-sq', colors.dark);
};

export const applyPiecesTheme = (theme) => {
  const wrappers = document.querySelectorAll('.cg-wrap');
  wrappers.forEach((wrap) => {
    const toRemove = [];
    wrap.classList.forEach((className) => {
      if (className.startsWith('theme-pieces-')) {
        toRemove.push(className);
      }
    });
    toRemove.forEach((className) => wrap.classList.remove(className));
    wrap.classList.add(`theme-pieces-${theme}`);
  });
};
