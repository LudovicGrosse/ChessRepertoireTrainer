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
  row.style.cssText =
    'display: flex; gap: 12px; align-items: center; margin-bottom: 8px; width: 100%;';

  row.innerHTML = `
    <input type="text" class="share-study-url" placeholder="Lien ou ID de l'étude Lichess" required style="flex: 1; min-width: 100px;">
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
  `;

  // Attach dynamic toggle events matching utils.js toggle state behavior
  const container = row.querySelector('.toggle-container');
  container.querySelectorAll('.toggle-option').forEach((option) => {
    option.onclick = (e) => {
      const val = e.currentTarget.dataset.val;
      const options = container.querySelectorAll('.toggle-option');
      options.forEach((opt) => {
        if (opt.dataset.val === val) {
          opt.classList.add('active');
          container.dataset.state = opt === options[0] ? 'left' : 'right';
        } else {
          opt.classList.remove('active');
        }
      });
    };
  });

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

  shareHistoryTableBody.innerHTML = shares
    .map((share) => {
      const formattedDate = new Date(share.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const colorText = share.color === 'white' ? 'Blancs' : 'Noirs';

      let statusBadge;
      if (share.status === 'pending') {
        statusBadge =
          '<span style="background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 12px; font-size: 12px;">En attente</span>';
      } else if (share.status === 'accepted') {
        statusBadge =
          '<span style="background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Accepté</span>';
      } else {
        statusBadge =
          '<span style="background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 12px; font-size: 12px;">Refusé</span>';
      }

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 10px 8px;"><strong>${share.repertoire_title}</strong><br><span style="font-size: 11px; color: var(--text-muted)">ID: ${share.repertoire_id}</span></td>
          <td style="padding: 10px 8px;">${share.target_username}</td>
          <td style="padding: 10px 8px;">${colorText}</td>
          <td style="padding: 10px 8px;">${statusBadge}</td>
          <td style="padding: 10px 8px; color: var(--text-muted);">${formattedDate}</td>
        </tr>
      `;
    })
    .join('');
};
