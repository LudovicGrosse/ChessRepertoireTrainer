const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const LICHESS_CLIENT_ID = process.env.LICHESS_CLIENT_ID;
const LICHESS_REDIRECT_URI = process.env.LICHESS_REDIRECT_URI;

// PKCE Helper Functions
const base64URLEncode = (str) => {
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest();

const createVerifier = () => base64URLEncode(crypto.randomBytes(32));

const createChallenge = (verifier) => base64URLEncode(sha256(verifier));

router.get('/login-url', authenticateToken, (req, res) => {
  const verifier = createVerifier();
  const challenge = createChallenge(verifier);

  // Generate a stateless token for the 'state' parameter to link the callback to this user
  // and securely pass the PKCE verifier without needing sessions.
  const stateToken = jwt.sign({ userId: req.user.id, codeVerifier: verifier }, SECRET_KEY, {
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

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // If Lichess returns an error (user denied)
  if (error) {
    return res.redirect('/?lichess_error=' + encodeURIComponent(error));
  }

  if (!code || !state) {
    return res.redirect('/?lichess_error=missing_params');
  }

  let userId;
  let codeVerifier;
  try {
    const decoded = jwt.verify(state, SECRET_KEY);
    userId = decoded.userId;
    codeVerifier = decoded.codeVerifier;
  } catch (err) {
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

    // Save to database
    await db.query(
      `UPDATE users 
       SET lichess_access_token = $1, 
           lichess_refresh_token = $2, 
           lichess_token_expiry = $3, 
           lichess_username = $4
       WHERE id = $5`,
      [accessToken, refreshToken, expiryDate, username, userId]
    );

    res.redirect('/?lichess_success=1');
  } catch (err) {
    console.error('Lichess callback processing error:', err);
    res.redirect('/?lichess_error=internal_error');
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT lichess_username FROM users WHERE id = $1', [
      req.user.id,
    ]);
    if (rows.length > 0 && rows[0].lichess_username) {
      res.json({ isConnected: true, username: rows[0].lichess_username });
    } else {
      res.json({ isConnected: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    await db.query(
      `UPDATE users 
       SET lichess_access_token = NULL, 
           lichess_refresh_token = NULL, 
           lichess_token_expiry = NULL, 
           lichess_username = NULL
       WHERE id = $1`,
      [req.user.id]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Proxy route for fetching PGN
// Note: This needs to support optional authentication (public studies)
router.get('/study/:id.pgn', authenticateToken, async (req, res) => {
  const studyId = req.params.id;

  try {
    const { rows } = await db.query(
      'SELECT lichess_access_token, lichess_token_expiry, lichess_refresh_token FROM users WHERE id = $1',
      [req.user.id]
    );

    let token = null;

    if (rows.length > 0 && rows[0].lichess_access_token) {
      token = rows[0].lichess_access_token;
      // In a more complex setup, we'd handle refresh_token here if expiry is past.
      // Given Lichess tokens last 300 days, simple implementation is usually fine,
      // or we can prompt user to reconnect if fetch fails with 401.
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
        // If it's a private study and we got 401/404, token might be invalid or no access
        return res.status(lichessRes.status).json({
          error: 'Study not found or access denied. If private, check Lichess connection.',
        });
      }
      return res.status(lichessRes.status).json({ error: 'Failed to fetch from Lichess' });
    }

    const pgnData = await lichessRes.text();
    // Return plain text
    res.set('Content-Type', 'text/plain');
    res.send(pgnData);
  } catch (err) {
    console.error('Lichess proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
});

module.exports = router;
