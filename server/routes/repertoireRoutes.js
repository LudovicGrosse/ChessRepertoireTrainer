const express = require('express');
const db = require('../database');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const { repertoire_id, title, color, chapters } = req.body;

  if (!repertoire_id || !title || !color || !chapters || !Array.isArray(chapters)) {
    return res.status(400).json({ error: 'Missing required fields or invalid chapters' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Upsert global repertoire
    await client.query(
      `
      INSERT INTO repertoires (id, title, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (id) 
      DO UPDATE SET title = EXCLUDED.title, updated_at = CURRENT_TIMESTAMP
      `,
      [repertoire_id, title]
    );

    // 2. Upsert chapters
    for (const [index, chap] of chapters.entries()) {
      await client.query(
        `
        INSERT INTO chapters (id, repertoire_id, title, white_moves, black_moves, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) 
        DO UPDATE SET title = EXCLUDED.title, white_moves = EXCLUDED.white_moves, black_moves = EXCLUDED.black_moves, sort_order = EXCLUDED.sort_order
        `,
        [chap.id, repertoire_id, chap.title, chap.white_moves || 0, chap.black_moves || 0, index]
      );
    }

    // 3. Link to user
    await client.query(
      `
      INSERT INTO user_repertoires (user_id, repertoire_id, color, added_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, repertoire_id, color) DO NOTHING
      `,
      [req.user.id, repertoire_id, color]
    );

    await client.query('COMMIT');
    res.sendStatus(201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save repertoire error:', err);
    res.status(500).json({ error: 'Failed to save repertoire' });
  } finally {
    client.release();
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT 
          ur.repertoire_id, 
          ur.color, 
          r.title, 
          r.updated_at as lichess_updated_at,
          (
              SELECT json_agg(
                  json_build_object(
                      'id', c.id, 
                      'title', c.title, 
                      'white_moves', c.white_moves, 
                      'black_moves', c.black_moves
                  ) ORDER BY c.sort_order ASC
              ) 
              FROM chapters c 
              WHERE c.repertoire_id = r.id
          ) as chapters,
          ur.added_at
      FROM user_repertoires ur
      JOIN repertoires r ON ur.repertoire_id = r.id
      WHERE ur.user_id = $1
      ORDER BY ur.added_at DESC
      `,
      [req.user.id]
    );

    // Fallback logic for empty chapters (JSON agg can return null)
    rows.forEach((row) => {
      if (!row.chapters) row.chapters = [];
      row.total_chapters = row.chapters.length;
    });

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

    // Update global repertoire title (will apply to all users sharing it)
    await db.query(
      `
      UPDATE repertoires SET title = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [new_title, repertoire_id]
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

    // Remove user link
    await db.query(
      `
      DELETE FROM user_repertoires 
      WHERE user_id = $1 AND repertoire_id = $2 AND color = $3
      `,
      [req.user.id, repertoire_id, color]
    );

    // Delete personal history
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
