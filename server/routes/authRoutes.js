const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Supprimer le compte de l'utilisateur connecté (sans mot de passe local requis)
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ message: 'Compte supprimé avec succès.' });
  } catch (err) {
    console.error('DELETE ACCOUNT ERROR:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
  }
});

// Récupérer les préférences de l'utilisateur connecté
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT revision_mode, board_theme, pieces_theme FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.json({
        revision_mode: 'normal',
        board_theme: 'classic',
        pieces_theme: 'cburnett',
      });
    }

    res.json({
      revision_mode: rows[0].revision_mode || 'normal',
      board_theme: rows[0].board_theme || 'classic',
      pieces_theme: rows[0].pieces_theme || 'cburnett',
    });
  } catch (err) {
    console.error('GET PREFERENCES ERROR:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des préférences.' });
  }
});

// Enregistrer les préférences de l'utilisateur connecté
router.post('/preferences', authenticateToken, async (req, res) => {
  const { revision_mode, board_theme, pieces_theme } = req.body;
  if (revision_mode === undefined) {
    return res.status(400).json({ error: 'Paramètre revision_mode manquant.' });
  }

  const revMode = revision_mode || 'normal';
  const bTheme = board_theme || 'classic';
  const pTheme = pieces_theme || 'cburnett';

  try {
    await db.query(
      `INSERT INTO user_preferences (user_id, revision_mode, board_theme, pieces_theme)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET revision_mode = EXCLUDED.revision_mode,
                     board_theme = EXCLUDED.board_theme,
                     pieces_theme = EXCLUDED.pieces_theme`,
      [req.user.id, revMode, bTheme, pTheme]
    );
    res.json({
      success: true,
      revision_mode: revMode,
      board_theme: bTheme,
      pieces_theme: pTheme,
    });
  } catch (err) {
    console.error('POST PREFERENCES ERROR:', err);
    res.status(500).json({ error: "Erreur serveur lors de l'enregistrement des préférences." });
  }
});

module.exports = router;
