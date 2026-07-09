import { showToast, getToggleState, initToggles } from './utils.js';

let shareStudyForm;
let shareStudentUsernames;
let shareLichessUrls;
let shareHistoryTableBody;
let unregisteredInvitationBox;
let inviteTextTemplate;
let copyInviteTextBtn;
let shareBtn;

let inviteTemplateContent = '';

export const initTeacherSpace = () => {
  shareStudyForm = document.getElementById('shareStudyForm');
  shareStudentUsernames = document.getElementById('shareStudentUsernames');
  shareLichessUrls = document.getElementById('shareLichessUrls');
  shareHistoryTableBody = document.getElementById('shareHistoryTableBody');
  unregisteredInvitationBox = document.getElementById('unregisteredInvitationBox');
  inviteTextTemplate = document.getElementById('inviteTextTemplate');
  copyInviteTextBtn = document.getElementById('copyInviteTextBtn');
  shareBtn = document.getElementById('shareBtn');

  if (!shareStudyForm) {
    return;
  }

  // Initialize teacher color toggle
  initToggles();

  // Load history
  fetchShareHistory();

  // Form submission handler
  shareStudyForm.onsubmit = async (e) => {
    e.preventDefault();

    const rawUsernames = shareStudentUsernames.value;
    const rawUrls = shareLichessUrls.value;
    const color = getToggleState('shareColorToggle');

    // Parse usernames (split by comma or new lines, trim and filter out empties)
    const target_usernames = rawUsernames
      .split(/[,\n]/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    // Parse urls
    const lichess_study_urls = rawUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (target_usernames.length === 0) {
      showToast('Veuillez saisir au moins un pseudo élève.', 'error');
      return;
    }
    if (lichess_study_urls.length === 0) {
      showToast("Veuillez saisir au moins un lien d'étude Lichess.", 'error');
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
          lichess_study_urls,
          color,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Partage enregistré avec succès !', 'success');
        shareStudentUsernames.value = '';
        shareLichessUrls.value = '';

        // Handle unregistered users invite generation
        if (data.nonExistentUsers && data.nonExistentUsers.length > 0) {
          const userListText = data.nonExistentUsers.join(', ');
          const currentOrigin = window.location.origin;

          inviteTemplateContent = `Bonjour !\nJe viens de partager des répertoires d'ouvertures avec vous sur La Boîte à Ouvertures.\nPour y accéder, il vous suffit de vous connecter au site en un clic avec votre compte Lichess :\n👉 ${currentOrigin}\n\n(Pseudos concernés : ${userListText})`;
          inviteTextTemplate.textContent = inviteTemplateContent;
          unregisteredInvitationBox.classList.remove('hidden');
        } else {
          unregisteredInvitationBox.classList.add('hidden');
        }

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
