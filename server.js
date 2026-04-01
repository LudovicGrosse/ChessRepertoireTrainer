require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');
const { sendEmail } = require('./mailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// ============================================================================
// MIDDLEWARE & SECURITY
// ============================================================================

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/**
 * Rate limiting for Auth routes to prevent brute force
 */
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: 'Too many requests, please try again after 5 minutes.' }
});

/**
 * Middleware to verify JWT token
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(401); // 401 for expired or invalid tokens
        req.user = user;
        next();
    });
};

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * POST /api/register
 * Handles new user registration and sends verification email
 */
app.post('/api/register', authLimiter, async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1d' });

        await db.query(`
            INSERT INTO users (username, email, password, verification_token)
            VALUES ($1, $2, $3, $4)
        `, [username, email, hashedPassword, verificationToken]);

        const verifyLink = `${APP_URL}/api/verify-email/${verificationToken}`;
        await sendEmail(
            email,
            'Verify your account - La Boîte à Ouvertures',
            `Welcome! Please verify your account by clicking: ${verifyLink}`,
            `<h1>Welcome to La Boîte à Ouvertures!</h1>
             <p>Please click the button below to verify your email address:</p>
             <a href="${verifyLink}" style="padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px;">Verify my account</a>`
        );

        res.status(201).json({ message: 'Account created. Please check your email to verify.' });
    } catch (err) {
        console.error("REGISTRATION ERROR:", err);
        res.status(400).json({ error: 'Username or email already exists.' });
    }
});

/**
 * GET /api/verify-email/:token
 * Verifies user account via email token
 */
app.get('/api/verify-email/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const { rowCount } = await db.query(
            'UPDATE users SET is_verified = true, verification_token = NULL WHERE email = $1',
            [decoded.email]
        );

        if (rowCount === 0) return res.status(400).json({ error: 'Invalid token.' });
        res.redirect('/?verify=success');
    } catch (err) {
        res.status(400).json({ error: 'Invalid or expired token.' });
    }
});

/**
 * POST /api/login
 * Authenticates user and returns JWT token
 */
app.post('/api/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await db.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email before logging in.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ error: 'Server error.' });
    }
});

/**
 * POST /api/forgot-password
 * Generates and sends a password reset link
 */
app.post('/api/forgot-password', authLimiter, async (req, res) => {
    const { email } = req.body;
    try {
        const resetToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });
        const expires = new Date(Date.now() + 3600000); // 1 hour

        const { rowCount } = await db.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
            [resetToken, expires, email]
        );

        if (rowCount > 0) {
            const resetLink = `${APP_URL}/?reset=${resetToken}`;
            await sendEmail(
                email,
                'Password Reset - La Boîte à Ouvertures',
                `Reset your password here: ${resetLink}`,
                `<p>You requested a password reset. Click below to continue:</p>
                 <a href="${resetLink}">Reset Password</a>`
            );
        }
        res.json({ message: 'If this email exists, a reset link has been sent.' });
    } catch (err) {
        res.status(500).json({ error: 'Error processing request.' });
    }
});

/**
 * POST /api/reset-password
 * Handles password update using reset token
 */
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { rowCount } = await db.query(`
            UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL 
            WHERE email = $2 AND reset_token = $3 AND reset_token_expires > NOW()
        `, [hashedPassword, decoded.email, token]);

        if (rowCount === 0) return res.status(400).json({ error: 'Invalid or expired token.' });
        res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        res.status(400).json({ error: 'Invalid token.' });
    }
});

// ============================================================================
// TRAINING HISTORY ROUTES
// ============================================================================

/**
 * GET /api/history
 * Retrieves full training history for the authenticated user
 */
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM history WHERE user_id = $1 ORDER BY date DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error("Fetch history error:", err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * POST /api/history
 * Saves a new training session or updates titles if they changed
 */
app.post('/api/history', authenticateToken, async (req, res) => {
    const { 
        repertoire_title, chapter_title, study_id, color, 
        moves_learned, total_moves, errors, total_chapters, is_revision 
    } = req.body;
    const date = new Date().toISOString();

    try {
        // Update all previous entries for this study to reflect the latest title from Lichess
        if (study_id && repertoire_title) {
            await db.query(`
                UPDATE history SET repertoire_title = $1 
                WHERE user_id = $2 AND (study_id = $3 OR study_id LIKE '%' || $3)
            `, [repertoire_title, req.user.id, study_id]);
        }

        await db.query(`
            INSERT INTO history (
                user_id, repertoire_title, chapter_title, study_id, color, 
                date, moves_learned, total_moves, errors, total_chapters, is_revision
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            req.user.id, repertoire_title, chapter_title, study_id, color, 
            date, moves_learned, total_moves, errors, total_chapters, is_revision ? 1 : 0
        ]);
        
        res.sendStatus(201);
    } catch (err) {
        console.error("Save history error:", err);
        res.status(500).json({ error: 'Failed to save history' });
    }
});

/**
 * PUT /api/history/repertoire/title
 * Renames a repertoire globally in the history records
 */
app.put('/api/history/repertoire/title', authenticateToken, async (req, res) => {
    try {
        const { study_id, new_title } = req.body;
        if (!study_id || !new_title) return res.status(400).json({ error: 'Missing study_id or new_title' });
        
        await db.query(`
            UPDATE history SET repertoire_title = $1 
            WHERE user_id = $2 AND (study_id = $3 OR study_id LIKE '%' || $3)
        `, [new_title, req.user.id, study_id]);
        
        res.sendStatus(200);
    } catch (err) {
        console.error("Update title error:", err);
        res.status(500).json({ error: 'Failed to update repertoire title' });
    }
});

/**
 * PUT /api/history/chapter/title
 * Renames a specific chapter globally in the history records
 */
app.put('/api/history/chapter/title', authenticateToken, async (req, res) => {
    try {
        const { study_id, old_title, new_title } = req.body;
        if (!study_id || !old_title || !new_title) return res.status(400).json({ error: 'Missing parameters' });
        
        await db.query(`
            UPDATE history SET chapter_title = $1 
            WHERE user_id = $2 AND (study_id = $3 OR study_id LIKE '%' || $3) AND chapter_title = $4
        `, [new_title, req.user.id, study_id, old_title]);
        
        res.sendStatus(200);
    } catch (err) {
        console.error("Update chapter title error:", err);
        res.status(500).json({ error: 'Failed to update chapter title' });
    }
});

/**
 * DELETE /api/history/repertoire
 * Deletes all history records for a specific repertoire and color
 */
app.delete('/api/history/repertoire', authenticateToken, async (req, res) => {
    try {
        const { study_id, color } = req.query;
        await db.query(`
            DELETE FROM history 
            WHERE user_id = $1 AND (study_id = $2 OR study_id LIKE '%' || $2) AND color = $3
        `, [req.user.id, study_id, color]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Delete history error:", err);
        res.status(500).json({ error: 'Failed to delete history' });
    }
});

// ============================================================================
// DEFAULT ROUTE
// ============================================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chess.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 La Boîte à Ouvertures Server started at port ${PORT}`);
});
