const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const {
    repertoire_title,
    chapter_title,
    study_id,
    color,
    moves_learned,
    total_moves,
    errors,
    total_chapters,
    is_revision,
  } = req.body;
  const date = new Date().toISOString();

  try {
    if (study_id && repertoire_title) {
      await db.query(
        `
                UPDATE history SET repertoire_title = $1 
                WHERE user_id = $2 AND study_id = $3
            `,
        [repertoire_title, req.user.id, study_id]
      );
    }

    await db.query(
      `
            INSERT INTO history (user_id, repertoire_title, chapter_title, study_id, color, date, moves_learned, total_moves, errors, total_chapters, is_revision)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
      [
        req.user.id,
        repertoire_title,
        chapter_title,
        study_id,
        color,
        date,
        moves_learned,
        total_moves,
        errors,
        total_chapters,
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
    const { study_id, old_title, new_title } = req.body;
    if (!study_id || !old_title || !new_title) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    await db.query(
      `
            UPDATE history SET chapter_title = $1 
            WHERE user_id = $2 AND (study_id = $3 OR study_id LIKE '%' || $3) AND chapter_title = $4
        `,
      [new_title, req.user.id, study_id, old_title]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('Update chapter title error:', err);
    res.status(500).json({ error: 'Failed to update chapter title' });
  }
});

module.exports = router;
