const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = require('./database');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_secret_key_here'; // In production, use environment variables

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Middleware for JWT verification
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ENDPOINTS ---

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);

    try {
        const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        const result = insertUser.run(username, hash);
        res.status(201).json({ id: result.lastInsertRowid, username });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (user && bcrypt.compareSync(password, user.password_hash)) {
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, username: user.username } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// --- HISTORY ENDPOINTS ---

app.post('/api/history', authenticateToken, (req, res) => {
    const { repertoire_title, chapter_title, study_id, color, moves_learned, total_moves, errors, total_chapters, is_revision } = req.body;
    const date = new Date().toISOString();

    try {
        const insertHistory = db.prepare(`
            INSERT INTO history (user_id, repertoire_title, chapter_title, study_id, color, date, moves_learned, total_moves, errors, total_chapters, is_revision)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertHistory.run(req.user.id, repertoire_title, chapter_title, study_id, color, date, moves_learned, total_moves, errors, total_chapters, is_revision ? 1 : 0);
        res.sendStatus(201);
    } catch (err) {
        console.error("Save history error:", err);
        res.status(500).json({ error: 'Failed to save history' });
    }
});

app.get('/api/history', authenticateToken, (req, res) => {
    try {
        const history = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY date DESC').all(req.user.id);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chess.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Chess Repertoire Trainer Server started at http://localhost:${PORT}`);
});
