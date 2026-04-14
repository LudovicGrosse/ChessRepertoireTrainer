const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const { repertoire_id, chapter_id, color, total_moves, errors, is_revision } = req.body;
  const date = new Date().toISOString();

  try {
    await db.query(
      `
            INSERT INTO history (user_id, repertoire_id, chapter_id, color, date, total_moves, errors, is_revision)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, repertoire_id, chapter_id, color) 
            DO UPDATE SET 
              date = EXCLUDED.date, 
              total_moves = EXCLUDED.total_moves, 
              errors = EXCLUDED.errors, 
              is_revision = EXCLUDED.is_revision
        `,
      [
        req.user.id,
        repertoire_id,
        chapter_id,
        color,
        date,
        total_moves,
        errors,
        is_revision ? 1 : 0,
      ]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error('Save history error:', err);
    res.status(500).json({ error: 'Failed to save history' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM history WHERE user_id = $1 ORDER BY date DESC', [
      req.user.id,
    ]);
    res.json(rows);
  } catch (err) {
    console.error('Fetch history error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.put('/chapter/title', authenticateToken, async (req, res) => {
  try {
    const { chapter_id, new_title } = req.body;
    if (!chapter_id || !new_title) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    await db.query(
      `
            UPDATE chapters SET title = $1 
            WHERE id = $2
        `,
      [new_title, chapter_id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('Update chapter title error:', err);
    res.status(500).json({ error: 'Failed to update chapter title' });
  }
});

module.exports = router;
