require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting database migration...');
    await client.query('BEGIN');

    console.log('1. Renaming columns: study_id -> repertoire_id');
    await client
      .query(
        `
      ALTER TABLE IF EXISTS history RENAME COLUMN study_id TO repertoire_id;
    `
      )
      .catch(() => console.log('history.study_id might already be renamed or not exist.'));

    await client
      .query(
        `
      ALTER TABLE IF EXISTS repertoires RENAME COLUMN study_id TO repertoire_id;
    `
      )
      .catch(() => console.log('repertoires.study_id might already be renamed or not exist.'));

    console.log('2. Cleaning full URLs to keep only IDs');
    await client.query(`
      UPDATE history 
      SET repertoire_id = SUBSTRING(repertoire_id FROM 'study/([a-zA-Z0-9]+)') 
      WHERE repertoire_id LIKE 'http%';
    `);

    await client.query(`
      UPDATE repertoires 
      SET repertoire_id = SUBSTRING(repertoire_id FROM 'study/([a-zA-Z0-9]+)') 
      WHERE repertoire_id LIKE 'http%';
    `);

    console.log('3. Adding chapter_id to history table');
    await client.query(`
      ALTER TABLE history ADD COLUMN IF NOT EXISTS chapter_id VARCHAR(255);
    `);

    console.log('4. Deduplicating history entries to keep only the latest per chapter');
    // We delete older rows for the same user, repertoire, chapter_title, and color.
    await client.query(`
      DELETE FROM history a USING history b
      WHERE a.user_id = b.user_id 
        AND a.repertoire_id = b.repertoire_id 
        AND a.chapter_title = b.chapter_title 
        AND a.color = b.color 
        AND a.date < b.date;
    `);

    console.log('5. Filling chapter_id for existing rows with chapter_title');
    await client.query(`
      UPDATE history SET chapter_id = chapter_title WHERE chapter_id IS NULL;
    `);

    console.log('6. Adding UNIQUE constraint on history table');
    await client
      .query(
        `
      ALTER TABLE history ADD CONSTRAINT unique_history_chapter UNIQUE(user_id, repertoire_id, chapter_id, color);
    `
      )
      .catch(() => console.log('UNIQUE constraint might already exist.'));

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
