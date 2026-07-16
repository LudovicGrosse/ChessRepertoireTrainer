import { showToast, getToggleState } from './utils.js';

let shareStudyForm;
let shareStudentUsernames;
let shareHistoryTableBody;
let unregisteredInvitationBox;
let inviteTextTemplate;
let copyInviteTextBtn;
let shareBtn;
let shareStudiesContainer;
let addStudyRowBtn;

let inviteTemplateContent = '';

// Helper to create study input row dynamically
const createStudyRow = (index) => {
  const row = document.createElement('div');
  row.className = 'share-study-row';
  row.dataset.index = index;
  row.innerHTML = `
    <input type="text" class="share-study-url" placeholder="Lien ou ID de l'étude Lichess" required>
    <div class="share-study-row-controls">
      <div class="toggle-container color-toggle share-color-toggle" id="shareColorToggle_${index}" data-state="left" style="width: 140px; flex-shrink: 0; margin: 0; display: inline-flex;">
        <div class="toggle-slider"></div>
        <div class="toggle-option active" data-val="white" style="flex: 1; text-align: center;">Blancs</div>
        <div class="toggle-option" data-val="black" style="flex: 1; text-align: center;">Noirs</div>
      </div>
      ${
        index > 0
          ? `<button type="button" class="secondary remove-study-row-btn" style="padding: 0; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 4px; cursor: pointer;" title="Supprimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>`
          : `<div style="width: 36px; flex-shrink: 0;"></div>`
      }
    </div>
  `;

  // Attach dynamic toggle events matching utils.js toggle state behavior
  const container = row.querySelector('.toggle-container');
  container.onclick = () => {
    const activeOpt = container.querySelector('.toggle-option.active');
    if (!activeOpt) {
      return;
    }
    const currentVal = activeOpt.dataset.val;
    const options = container.querySelectorAll('.toggle-option');
    const otherOpt = Array.from(options).find((opt) => opt.dataset.val !== currentVal);
    if (otherOpt) {
      options.forEach((opt) => {
        if (opt === otherOpt) {
          opt.classList.add('active');
          container.dataset.state = opt === options[0] ? 'left' : 'right';
        } else {
          opt.classList.remove('active');
        }
      });
    }
  };

  // Remove row handler if button exists
  const removeBtn = row.querySelector('.remove-study-row-btn');
  if (removeBtn) {
    removeBtn.onclick = () => {
      row.remove();
    };
  }

  return row;
};

export const initTeacherSpace = () => {
  shareStudyForm = document.getElementById('shareStudyForm');
  shareStudentUsernames = document.getElementById('shareStudentUsernames');
  shareHistoryTableBody = document.getElementById('shareHistoryTableBody');
  unregisteredInvitationBox = document.getElementById('unregisteredInvitationBox');
  inviteTextTemplate = document.getElementById('inviteTextTemplate');
  copyInviteTextBtn = document.getElementById('copyInviteTextBtn');
  shareBtn = document.getElementById('shareBtn');
  shareStudiesContainer = document.getElementById('shareStudiesContainer');
  addStudyRowBtn = document.getElementById('addStudyRowBtn');

  if (!shareStudyForm) {
    return;
  }

  // Load history
  fetchShareHistory();

  // Initialize dynamic study inputs container
  if (shareStudiesContainer && shareStudiesContainer.children.length === 0) {
    shareStudiesContainer.appendChild(createStudyRow(0));
  }

  // Add study row click handler
  if (addStudyRowBtn && shareStudiesContainer) {
    addStudyRowBtn.onclick = () => {
      const rows = shareStudiesContainer.querySelectorAll('.share-study-row');
      let maxIdx = 0;
      rows.forEach((r) => {
        const idx = parseInt(r.dataset.index, 10);
        if (idx > maxIdx) {
          maxIdx = idx;
        }
      });
      shareStudiesContainer.appendChild(createStudyRow(maxIdx + 1));
    };
  }

  // Form submission handler
  shareStudyForm.onsubmit = async (e) => {
    e.preventDefault();

    const rawUsernames = shareStudentUsernames.value;

    // Parse usernames (split by comma or new lines, trim and filter out empties)
    const target_usernames = rawUsernames
      .split(/[,\n]/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (target_usernames.length === 0) {
      showToast('Veuillez saisir au moins un pseudo élève.', 'error');
      return;
    }

    // Collect each study line input values
    const studies = [];
    const rows = shareStudiesContainer.querySelectorAll('.share-study-row');
    let hasEmptyUrl = false;

    rows.forEach((row) => {
      const index = row.dataset.index;
      const urlInput = row.querySelector('.share-study-url');
      const url = urlInput ? urlInput.value.trim() : '';
      const color = getToggleState(`shareColorToggle_${index}`);

      if (!url) {
        hasEmptyUrl = true;
      } else {
        studies.push({ url, color });
      }
    });

    if (hasEmptyUrl) {
      showToast("Veuillez renseigner le lien de l'étude pour chaque ligne.", 'error');
      return;
    }

    if (studies.length === 0) {
      showToast('Veuillez saisir au moins une étude Lichess.', 'error');
      return;
    }

    shareBtn.disabled = true;
    shareBtn.textContent = 'Partage en cours...';

    try {
      const token = localStorage.getItem('chess_token');
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_usernames,
          studies,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Partage enregistré avec succès !', 'success');
        shareStudentUsernames.value = '';

        // Reset dynamic container studies list to initial state
        shareStudiesContainer.innerHTML = '';
        shareStudiesContainer.appendChild(createStudyRow(0));

        // Always generate and show generic invite message
        const currentOrigin = window.location.origin;
        inviteTemplateContent = `Bonjour !\nJe viens de partager des répertoires d'ouvertures avec vous sur La Boîte à Ouvertures.\nPour y accéder, il vous suffit de vous connecter au site en un clic avec votre compte Lichess :\n👉 ${currentOrigin}`;
        inviteTextTemplate.textContent = inviteTemplateContent;
        unregisteredInvitationBox.classList.remove('hidden');

        fetchShareHistory();
      } else {
        throw new Error(data.error || 'Erreur lors du partage.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = 'Partager les études';
    }
  };

  // Copy invitation text handler
  if (copyInviteTextBtn) {
    copyInviteTextBtn.onclick = () => {
      if (!inviteTemplateContent) {
        return;
      }
      navigator.clipboard
        .writeText(inviteTemplateContent)
        .then(() => {
          showToast("Message d'invitation copié dans le presse-papier !", 'success');
        })
        .catch(() => {
          showToast('Erreur lors de la copie du message.', 'error');
        });
    };
  }
};

export const fetchShareHistory = async () => {
  shareHistoryTableBody = document.getElementById('shareHistoryTableBody');
  if (!shareHistoryTableBody) {
    return;
  }

  try {
    const token = localStorage.getItem('chess_token');
    const res = await fetch('/api/shares/history', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      renderShareHistory(data);
    }
  } catch (err) {
    console.error('Failed to fetch share history:', err);
  }
};

const renderShareHistory = (shares) => {
  if (shares.length === 0) {
    shareHistoryTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">
          Aucun partage enregistré.
        </td>
      </tr>
    `;
    return;
  }

  const calculateExpirationText = (expiresAt) => {
    const diffMs = new Date(expiresAt) - Date.now();
    if (diffMs <= 0) {
      return 'Expiré';
    }
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (diffDays > 0) {
      return `${diffDays}j ${diffHours}h`;
    }
    return `${diffHours}h`;
  };

  shareHistoryTableBody.innerHTML = shares
    .map((share) => {
      const colorDot =
        share.color === 'white'
          ? '<span class="share-color-dot" style="background: #ffffff; border: 1.5px solid #ffffff;" title="Blancs"></span>'
          : '<span class="share-color-dot" style="background: #090f19; border: 1.5px solid #94a3b8;" title="Noirs"></span>';

      let statusBadge;
      let actionButtons = '';

      if (share.status === 'pending') {
        statusBadge =
          '<span style="background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 12px; font-size: 12px;">En attente</span>';
        actionButtons = `
          <button class="secondary renew-btn" data-id="${share.id}" style="padding: 0; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px;" title="Renouveler pour 7 jours">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
          <button class="danger-btn cancel-share-btn" data-id="${share.id}" style="padding: 0; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: var(--danger); color: white; border: none; border-radius: 4px;" title="Annuler l'invitation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        `;
      } else {
        statusBadge =
          '<span style="background: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Traité</span>';
      }

      const expirationText = calculateExpirationText(share.expires_at);

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td data-label="Étude" style="padding: 10px 8px; display: flex; align-items: center; gap: 8px;">
            ${colorDot}
            <div style="min-width: 0; flex: 1; text-align: left;">
              <strong class="share-study-title" style="font-size: 14px; font-weight: 600;">${share.repertoire_title}</strong>
              <span class="share-study-id" style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px;">ID: ${share.repertoire_id}</span>
            </div>
          </td>
          <td data-label="Élève" style="padding: 10px 8px;">${share.target_username}</td>
          <td data-label="Statut" style="padding: 10px 8px;">${statusBadge}</td>
          <td data-label="Expiration" style="padding: 10px 8px; color: var(--text-muted);">${expirationText}</td>
          <td style="padding: 10px 8px; text-align: right; padding-right: 12px;">
            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; width: 100%;">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Attach action buttons event listeners
  shareHistoryTableBody.querySelectorAll('.renew-btn').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      try {
        const token = localStorage.getItem('chess_token');
        const res = await fetch(`/api/shares/${id}/renew`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          showToast('Invitation renouvelée pour 7 jours !', 'success');
          fetchShareHistory();
        } else {
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors du renouvellement.');
        }
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    };
  });

  shareHistoryTableBody.querySelectorAll('.cancel-share-btn').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Voulez-vous vraiment annuler et supprimer cette invitation ?')) {
        return;
      }
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      try {
        const token = localStorage.getItem('chess_token');
        const res = await fetch(`/api/shares/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          showToast('Invitation annulée avec succès.', 'success');
          fetchShareHistory();
        } else {
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors de la suppression.');
        }
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    };
  });
};
