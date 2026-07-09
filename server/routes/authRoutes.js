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

module.exports = router;
