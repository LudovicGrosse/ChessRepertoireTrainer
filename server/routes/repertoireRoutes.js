const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const { repertoire_id, title, color, total_chapters } = req.body;
  if (!repertoire_id || !title || !color) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await db.query(
      `
            INSERT INTO repertoires (user_id, repertoire_id, color, title, total_chapters)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, repertoire_id, color) 
            DO UPDATE SET title = EXCLUDED.title, total_chapters = EXCLUDED.total_chapters
            `,
      [req.user.id, repertoire_id, color, title, total_chapters || 0]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error('Save repertoire error:', err);
    res.status(500).json({ error: 'Failed to save repertoire' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM repertoires WHERE user_id = $1 ORDER BY added_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch repertoires error:', err);
    res.status(500).json({ error: 'Failed to fetch repertoires' });
  }
});

router.put('/title', authenticateToken, async (req, res) => {
  try {
    const { repertoire_id, new_title } = req.body;
    if (!repertoire_id || !new_title) {
      return res.status(400).json({ error: 'Missing repertoire_id or new_title' });
    }

    await db.query(
      `
            UPDATE repertoires SET title = $1 
            WHERE user_id = $2 AND repertoire_id = $3
        `,
      [new_title, req.user.id, repertoire_id]
    );

    await db.query(
      `
            UPDATE history SET repertoire_title = $1 
            WHERE user_id = $2 AND repertoire_id = $3
        `,
      [new_title, req.user.id, repertoire_id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('Update title error:', err);
    res.status(500).json({ error: 'Failed to update repertoire title' });
  }
});

router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { repertoire_id, color } = req.query;
    if (!repertoire_id || !color) {
      return res.status(400).json({ error: 'Missing repertoire_id or color' });
    }

    await db.query(
      `
            DELETE FROM repertoires 
            WHERE user_id = $1 AND repertoire_id = $2 AND color = $3
        `,
      [req.user.id, repertoire_id, color]
    );

    await db.query(
      `
            DELETE FROM history 
            WHERE user_id = $1 AND repertoire_id = $2 AND color = $3
        `,
      [req.user.id, repertoire_id, color]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('Delete repertoire error:', err);
    res.status(500).json({ error: 'Failed to delete repertoire' });
  }
});

module.exports = router;
