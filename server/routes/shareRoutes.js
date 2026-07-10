const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Helper to extract study ID from Lichess URL or ID
const extractStudyId = (urlOrId) => {
  if (!urlOrId) {
    return '';
  }
  const clean = urlOrId.trim();
  if (clean.includes('/study/')) {
    const parts = clean.split('/study/');
    if (parts[1]) {
      return parts[1].split('/')[0].split('#')[0].split('?')[0];
    }
  }
  return clean.split('/')[0].split('#')[0].split('?')[0];
};

// Helper to parse chapters from PGN raw text
const parseChaptersFromPgn = (rawPgn) => {
  const chapters = [];
  const parts = rawPgn.split(/(?=\[Event ")/);
  parts.forEach((part, index) => {
    if (!part.trim()) {
      return;
    }
    let title = `Chapitre ${index + 1}`;
    const chapterNameMatch = part.match(/\[ChapterName\s+"([^"]+)"\]/);
    const eventMatch = part.match(/\[Event\s+"([^"]+)"\]/);
    if (chapterNameMatch && chapterNameMatch[1]) {
      title = chapterNameMatch[1];
    } else if (eventMatch && eventMatch[1] && eventMatch[1] !== '?') {
      title = eventMatch[1];
    }

    let chapter_id = `chap_${Date.now()}_${index}`;
    const siteMatch = part.match(/\[Site\s+"([^"]+)"\]/);
    const chapterUrlMatch = part.match(/\[ChapterURL\s+"([^"]+)"\]/);
    const studyUrl =
      (chapterUrlMatch ? chapterUrlMatch[1] : null) || (siteMatch ? siteMatch[1] : null);
    if (studyUrl) {
      const chapterIdMatch = studyUrl.match(/study\/[a-zA-Z0-9]+\/([a-zA-Z0-9]+)/);
      if (chapterIdMatch && chapterIdMatch[1]) {
        chapter_id = chapterIdMatch[1];
      }
    }
    chapters.push({ id: chapter_id, title });
  });
  return chapters;
};

// POST /api/shares - Shared study with students (Teacher only)
router.post('/', authenticateToken, async (req, res) => {
  const { target_usernames, studies } = req.body;

  if (!target_usernames || !Array.isArray(target_usernames) || target_usernames.length === 0) {
    return res.status(400).json({ error: 'La liste des pseudos cibles est requise.' });
  }
  if (!studies || !Array.isArray(studies) || studies.length === 0) {
    return res.status(400).json({ error: 'La liste des études est requise.' });
  }

  // 1. Check if requester is a teacher
  try {
    const userRes = await db.query(
      'SELECT is_teacher, lichess_access_token FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userRes.rows[0];
    if (!user || !user.is_teacher) {
      return res.status(403).json({ error: 'Accès réservé aux professeurs.' });
    }

    const token = user.lichess_access_token;
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const nonExistentUsers = [];
      // Verify which targeted students exist on the platform
      for (const rawUsername of target_usernames) {
        const cleanName = rawUsername.trim();
        if (!cleanName) {
          continue;
        }
        const studentRes = await client.query(
          'SELECT username FROM users WHERE LOWER(lichess_username) = LOWER($1)',
          [cleanName]
        );
        if (studentRes.rows.length === 0) {
          nonExistentUsers.push(cleanName);
        }
      }

      // Process each study URL/ID
      for (const studyObj of studies) {
        const { url, color } = studyObj;
        if (!url || (color !== 'white' && color !== 'black')) {
          throw new Error(
            'Chaque étude doit comporter un lien valide et une couleur (Blancs ou Noirs).'
          );
        }

        const studyId = extractStudyId(url);
        if (!studyId) {
          continue;
        }

        // Fetch PGN using teacher's Lichess token to authenticate private studies
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`https://lichess.org/api/study/${studyId}.pgn`, { headers });

        if (!response.ok) {
          throw new Error(
            `Impossible de récupérer l'étude Lichess ${studyId}. Vérifiez qu'elle existe et est accessible.`
          );
        }

        const pgnText = await response.text();
        const studyTitle =
          pgnText.match(/\[StudyName "(.*?)"\]/)?.[1] || `Étude Partagée (${studyId})`;
        const chapters = parseChaptersFromPgn(pgnText);

        // Upsert Repertoire globally
        await client.query(
          `INSERT INTO repertoires (id, title, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = CURRENT_TIMESTAMP`,
          [studyId, studyTitle]
        );

        // Upsert Chapters
        for (const [index, chap] of chapters.entries()) {
          await client.query(
            `INSERT INTO chapters (id, repertoire_id, title, white_moves, black_moves, sort_order)
             VALUES ($1, $2, $3, 0, 0, $4)
             ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order`,
            [chap.id, studyId, chap.title, index]
          );
        }

        // Insert Study Shares for target users
        for (const rawUsername of target_usernames) {
          const cleanName = rawUsername.trim();
          if (!cleanName) {
            continue;
          }

          // Case-insensitive mapping: store invitation with the exact target username matching
          await client.query(
            `INSERT INTO study_shares (teacher_id, repertoire_id, repertoire_title, target_username, color, status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             ON CONFLICT (repertoire_id, target_username, color) DO UPDATE SET status = 'pending'`,
            [req.user.id, studyId, studyTitle, cleanName, color]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({
        message: 'Études partagées avec succès.',
        nonExistentUsers: nonExistentUsers,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('SHARE ERROR:', err);
    res.status(500).json({ error: err.message || 'Erreur interne du serveur lors du partage.' });
  }
});

// GET /api/shares/pending - Get pending study sharing invitations (Student only)
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    // Get student's lichess_username from users
    const userRes = await db.query('SELECT lichess_username FROM users WHERE id = $1', [
      req.user.id,
    ]);
    const user = userRes.rows[0];
    if (!user || !user.lichess_username) {
      return res.json([]);
    }

    const sharesRes = await db.query(
      `SELECT s.id, s.repertoire_id, s.repertoire_title, s.color, s.created_at, u.username as teacher_username
       FROM study_shares s
       JOIN users u ON s.teacher_id = u.id
       WHERE LOWER(s.target_username) = LOWER($1) AND s.status = 'pending'`,
      [user.lichess_username]
    );

    res.json(sharesRes.rows);
  } catch (err) {
    console.error('GET PENDING SHARES ERROR:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des invitations.' });
  }
});

// GET /api/shares/history - Get share history (Teacher only)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.query('SELECT is_teacher FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];
    if (!user || !user.is_teacher) {
      return res.status(403).json({ error: 'Accès réservé aux professeurs.' });
    }

    const historyRes = await db.query(
      `SELECT id, repertoire_id, repertoire_title, target_username, color, status, created_at
       FROM study_shares
       WHERE teacher_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(historyRes.rows);
  } catch (err) {
    console.error('GET SHARE HISTORY ERROR:', err);
    res.status(500).json({ error: "Erreur lors du chargement de l'historique des partages." });
  }
});

// POST /api/shares/:id/accept - Accept study sharing invitation
router.post('/:id/accept', authenticateToken, async (req, res) => {
  const shareId = req.params.id;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch share invitation
    const shareRes = await client.query('SELECT * FROM study_shares WHERE id = $1', [shareId]);
    const share = shareRes.rows[0];
    if (!share) {
      return res.status(404).json({ error: 'Invitation introuvable.' });
    }

    // Verify it is indeed for this user
    const userRes = await client.query('SELECT lichess_username FROM users WHERE id = $1', [
      req.user.id,
    ]);
    const user = userRes.rows[0];
    if (!user || user.lichess_username.toLowerCase() !== share.target_username.toLowerCase()) {
      return res.status(403).json({ error: 'Cette invitation ne vous est pas destinée.' });
    }

    // 2. Link repertoire to user
    await client.query(
      `INSERT INTO user_repertoires (user_id, repertoire_id, color, added_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, repertoire_id, color) DO NOTHING`,
      [req.user.id, share.repertoire_id, share.color]
    );

    // 3. Mark share as accepted
    await client.query(`UPDATE study_shares SET status = 'accepted' WHERE id = $1`, [shareId]);

    await client.query('COMMIT');
    res.json({ message: 'Invitation acceptée avec succès !' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ACCEPT SHARE ERROR:', err);
    res.status(500).json({ error: "Impossible d'accepter l'invitation." });
  } finally {
    client.release();
  }
});

// POST /api/shares/:id/decline - Decline study sharing invitation
router.post('/:id/decline', authenticateToken, async (req, res) => {
  const shareId = req.params.id;

  try {
    // Verify it is for this user
    const shareRes = await db.query('SELECT * FROM study_shares WHERE id = $1', [shareId]);
    const share = shareRes.rows[0];
    if (!share) {
      return res.status(404).json({ error: 'Invitation introuvable.' });
    }

    const userRes = await db.query('SELECT lichess_username FROM users WHERE id = $1', [
      req.user.id,
    ]);
    const user = userRes.rows[0];
    if (!user || user.lichess_username.toLowerCase() !== share.target_username.toLowerCase()) {
      return res.status(403).json({ error: 'Cette invitation ne vous est pas destinée.' });
    }

    // Update status to declined
    await db.query(`UPDATE study_shares SET status = 'declined' WHERE id = $1`, [shareId]);

    res.json({ message: 'Invitation déclinée.' });
  } catch (err) {
    console.error('DECLINE SHARE ERROR:', err);
    res.status(500).json({ error: "Impossible de refuser l'invitation." });
  }
});

module.exports = router;
