const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const {
    repertoire_title,
    chapter_title,
    repertoire_id,
    chapter_id,
    color,
    moves_learned,
    total_moves,
    errors,
    total_chapters,
    is_revision,
  } = req.body;
  const date = new Date().toISOString();

  try {
    if (repertoire_id && repertoire_title) {
      await db.query(
        `
                UPDATE history SET repertoire_title = $1 
                WHERE user_id = $2 AND repertoire_id = $3
            `,
        [repertoire_title, req.user.id, repertoire_id]
      );
    }

    await db.query(
      `
            INSERT INTO history (user_id, repertoire_title, chapter_title, repertoire_id, chapter_id, color, date, moves_learned, total_moves, errors, total_chapters, is_revision)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (user_id, repertoire_id, chapter_id, color) 
            DO UPDATE SET 
              date = EXCLUDED.date, 
              moves_learned = EXCLUDED.moves_learned, 
              total_moves = EXCLUDED.total_moves, 
              errors = EXCLUDED.errors, 
              is_revision = EXCLUDED.is_revision, 
              total_chapters = EXCLUDED.total_chapters,
              repertoire_title = EXCLUDED.repertoire_title,
              chapter_title = EXCLUDED.chapter_title
        `,
      [
        req.user.id,
        repertoire_title,
        chapter_title,
        repertoire_id,
        chapter_id,
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
    const { repertoire_id, chapter_id, new_title } = req.body;
    if (!repertoire_id || !chapter_id || !new_title) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    await db.query(
      `
            UPDATE history SET chapter_title = $1 
            WHERE user_id = $2 AND repertoire_id = $3 AND chapter_id = $4
        `,
      [new_title, req.user.id, repertoire_id, chapter_id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('Update chapter title error:', err);
    res.status(500).json({ error: 'Failed to update chapter title' });
  }
});

module.exports = router;
