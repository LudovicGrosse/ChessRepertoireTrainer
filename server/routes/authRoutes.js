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
    const { rows } = await db.query('SELECT random_mode FROM user_preferences WHERE user_id = $1', [
      req.user.id,
    ]);
    if (rows.length === 0) {
      return res.json({ random_mode: false });
    }
    res.json({ random_mode: rows[0].random_mode });
  } catch (err) {
    console.error('GET PREFERENCES ERROR:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des préférences.' });
  }
});

// Enregistrer les préférences de l'utilisateur connecté
router.post('/preferences', authenticateToken, async (req, res) => {
  const { random_mode } = req.body;
  if (random_mode === undefined) {
    return res.status(400).json({ error: 'Paramètre random_mode manquant.' });
  }
  try {
    await db.query(
      `INSERT INTO user_preferences (user_id, random_mode)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET random_mode = EXCLUDED.random_mode`,
      [req.user.id, random_mode]
    );
    res.json({ success: true, random_mode });
  } catch (err) {
    console.error('POST PREFERENCES ERROR:', err);
    res.status(500).json({ error: "Erreur serveur lors de l'enregistrement des préférences." });
  }
});

module.exports = router;
