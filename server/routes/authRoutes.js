const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../database');
const { sendEmail } = require('../mailer');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de tentatives. Veuillez réessayer dans 5 minutes.' },
});

router.post('/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');

  try {
    await db.query(
      'INSERT INTO users (username, email, password_hash, verification_token) VALUES ($1, $2, $3, $4)',
      [username, email, hash, verificationToken]
    );

    const verificationLink = `${APP_URL}/?verify=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: 'Vérifiez votre compte La Boîte à Ouvertures',
      html: `
                <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
                    <h2 style="color: #4caf50;">Votre compte a été créé avec succès !</h2>
                    <p>Merci de vous être inscrit sur La Boîte à Ouvertures.</p>
                    <p><strong>Identifiant :</strong> ${username}</p>
                    <p>Pour finaliser votre inscription et activer votre compte, cliquez sur le bouton ci-dessous :</p>
                    <div style="margin: 25px 0;">
                        <a href="${verificationLink}" style="background: #4caf50; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold;">Activer mon compte</a>
                    </div>
                    <p style="font-size: 13px; color: #777;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${verificationLink}</p>
                </div>
            `,
    });

    res.status(201).json({ message: 'Compte créé ! Veuillez vérifier votre boîte mail.' });
  } catch (err) {
    console.error('REGISTRATION ERROR:', err);
    if (err.code === '23505') {
      const field = err.constraint.includes('email') ? "L'email" : "Le nom d'utilisateur";
      res.status(400).json({ error: `${field} existe déjà.` });
    } else {
      res.status(500).json({ error: 'Erreur serveur: ' + (err.message || 'Détails inconnus') });
    }
  }
});

router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE verification_token = $1', [token]);
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ error: 'Token de vérification invalide.' });
    }

    await db.query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = $1', [
      user.id,
    ]);
    res.json({ message: 'Compte vérifié avec succès !' });
  } catch (err) {
    console.error('VERIFY ERROR:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1 OR email = $1', [
      username,
    ]);
    const user = rows[0];

    if (user && bcrypt.compareSync(password, user.password_hash)) {
      if (user.is_verified === 0) {
        return res
          .status(403)
          .json({ error: 'Veuillez vérifier votre email avant de vous connecter.' });
      }
      const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
        expiresIn: '1d',
      });
      res.json({ token, user: { id: user.id, username: user.username } });
    } else {
      res.status(401).json({ error: 'Identifiants invalides.' });
    }
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Aucun compte associé à cet email.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();

    await db.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3', [
      resetToken,
      expiry,
      user.id,
    ]);

    const resetLink = `${APP_URL}/?reset=${resetToken}`;
    await sendEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
                <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
                    <h2 style="color: #4caf50;">Réinitialisation de mot de passe</h2>
                    <p>Bonjour <strong>${user.username}</strong>,</p>
                    <p>Vous avez demandé la réinitialisation du mot de passe pour votre compte La Boîte à Ouvertures.</p>
                    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe (ce lien est valable 1 heure) :</p>
                    <div style="margin: 25px 0;">
                        <a href="${resetLink}" style="background: #4caf50; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold;">Réinitialiser mon mot de passe</a>
                    </div>
                    <p style="font-size: 13px; color: #777;">Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email.</p>
                </div>
            `,
    });

    res.json({ message: 'Lien de réinitialisation envoyé !' });
  } catch (err) {
    console.error('FORGOT PWD ERROR:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE reset_token = $1', [token]);
    const user = rows[0];

    if (!user || new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Lien invalide ou expiré.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [hash, user.id]
    );
    res.json({ message: 'Mot de passe réinitialisé avec succès !' });
  } catch (err) {
    console.error('RESET PWD ERROR:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/account', authenticateToken, authLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression.' });
  }

  try {
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(403).json({ error: 'Mot de passe incorrect.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ message: 'Compte supprimé avec succès.' });
  } catch (err) {
    console.error('DELETE ACCOUNT ERROR:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
  }
});

module.exports = router;
