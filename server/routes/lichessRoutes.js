const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const LICHESS_CLIENT_ID = process.env.LICHESS_CLIENT_ID;
const LICHESS_REDIRECT_URI = process.env.LICHESS_REDIRECT_URI;

const lichessLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per `window`
  message: { error: 'Trop de requêtes vers Lichess, veuillez ralentir.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// PKCE Helper Functions
const base64URLEncode = (str) => {
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest();

const createVerifier = () => base64URLEncode(crypto.randomBytes(32));

const createChallenge = (verifier) => base64URLEncode(sha256(verifier));

// Public route to initiate Lichess Login (OAuth PKCE)
router.get('/login-url', (req, res) => {
  const verifier = createVerifier();
  const challenge = createChallenge(verifier);

  // Generate a stateless token for the 'state' parameter to securely pass the PKCE verifier
  const stateToken = jwt.sign({ codeVerifier: verifier }, SECRET_KEY, {
    expiresIn: '15m',
  });

  const authUrl = new URL('https://lichess.org/oauth');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', LICHESS_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', LICHESS_REDIRECT_URI);
  authUrl.searchParams.append('scope', 'study:read');
  authUrl.searchParams.append('state', stateToken);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('code_challenge', challenge);

  res.json({ url: authUrl.toString() });
});

// OAuth Callback from Lichess
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/?lichess_error=' + encodeURIComponent(error));
  }

  if (!code || !state) {
    return res.redirect('/?lichess_error=missing_params');
  }

  let codeVerifier;
  try {
    const decoded = jwt.verify(state, SECRET_KEY);
    codeVerifier = decoded.codeVerifier;
  } catch (err) {
    console.error('Invalid state token:', err);
    return res.redirect('/?lichess_error=invalid_state');
  }

  try {
    // Exchange code for token using PKCE
    const tokenResponse = await fetch('https://lichess.org/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: LICHESS_REDIRECT_URI,
        client_id: LICHESS_CLIENT_ID,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Lichess token error:', errorText);
      return res.redirect('/?lichess_error=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in || 25920000; // Default 300 days

    const expiryDate = new Date(Date.now() + expiresIn * 1000);

    // Fetch user profile to get username
    const profileResponse = await fetch('https://lichess.org/api/account', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      return res.redirect('/?lichess_error=profile_fetch_failed');
    }

    const profileData = await profileResponse.json();
    const username = profileData.username;

    // Check if user already exists
    let { rows } = await db.query('SELECT * FROM users WHERE lichess_username = $1', [username]);
    let user = rows[0];

    if (!user) {
      // Create user automatically
      const insertResult = await db.query(
        `INSERT INTO users (username, lichess_username, lichess_access_token, lichess_refresh_token, lichess_token_expiry) 
         VALUES ($1, $1, $2, $3, $4) 
         RETURNING id, username`,
        [username, accessToken, refreshToken, expiryDate]
      );
      user = insertResult.rows[0];
    } else {
      // Update Lichess tokens
      await db.query(
        `UPDATE users 
         SET lichess_access_token = $1, 
             lichess_refresh_token = $2, 
             lichess_token_expiry = $3
         WHERE id = $4`,
        [accessToken, refreshToken, expiryDate, user.id]
      );
    }

    // Generate session JWT
    const sessionToken = jwt.sign(
      { id: user.id, username: user.username, is_teacher: !!user.is_teacher },
      SECRET_KEY,
      {
        expiresIn: '7d',
      }
    );

    // Redirect to frontend with token and username in URL (plus the is_teacher flag)
    res.redirect(
      `/?token=${sessionToken}&username=${encodeURIComponent(user.username)}&is_teacher=${user.is_teacher ? '1' : '0'}`
    );
  } catch (err) {
    console.error('Lichess callback processing error:', err);
    res.redirect('/?lichess_error=internal_error');
  }
});

// Proxy route for fetching PGN from Lichess Study
router.get('/study/:id.pgn', authenticateToken, lichessLimiter, async (req, res) => {
  const studyId = req.params.id;

  try {
    const { rows } = await db.query('SELECT lichess_access_token FROM users WHERE id = $1', [
      req.user.id,
    ]);

    let token = null;
    if (rows.length > 0 && rows[0].lichess_access_token) {
      token = rows[0].lichess_access_token;
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const lichessRes = await fetch(`https://lichess.org/api/study/${studyId}.pgn`, {
      headers: headers,
    });

    if (!lichessRes.ok) {
      if (lichessRes.status === 401 || lichessRes.status === 403 || lichessRes.status === 404) {
        return res.status(lichessRes.status).json({
          error: 'Study not found or access denied. Check Lichess connection.',
        });
      }
      return res.status(lichessRes.status).json({ error: 'Failed to fetch from Lichess' });
    }

    const pgnData = await lichessRes.text();
    res.set('Content-Type', 'text/plain');
    res.send(pgnData);
  } catch (err) {
    console.error('Lichess proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
});

module.exports = router;
