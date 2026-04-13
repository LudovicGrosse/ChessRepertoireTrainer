require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: false }, // Force SSL for Neon even locally if needed
});

// Helper to parse PGN and extract chapter IDs and Titles
function parseChapters(rawPgn) {
  const chapters = [];
  const parts = rawPgn.split(/(?=\[Event ")/);

  parts.forEach((part, index) => {
    if (!part.trim()) return;

    let title = `Chapitre ${index + 1}`;
    const chapterNameMatch = part.match(/\[ChapterName\s+"([^"]+)"\]/);
    const eventMatch = part.match(/\[Event\s+"([^"]+)"\]/);

    if (chapterNameMatch && chapterNameMatch[1]) {
      title = chapterNameMatch[1];
    } else if (eventMatch && eventMatch[1] && eventMatch[1] !== '?') {
      title = eventMatch[1];
    }

    const siteMatch = part.match(/\[Site\s+"([^"]+)"\]/);
    const studyUrl = siteMatch ? siteMatch[1] : null;

    let chapter_id = `chap_${Date.now()}_${index}`;
    if (studyUrl) {
      const chapterIdMatch = studyUrl.match(/study\/[a-zA-Z0-9]+\/([a-zA-Z0-9]+)/);
      if (chapterIdMatch && chapterIdMatch[1]) {
        chapter_id = chapterIdMatch[1];
      }
    }

    chapters.push({ title, chapter_id });
  });

  return chapters;
}

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
    await client.query(`
      DELETE FROM history a USING history b
      WHERE a.user_id = b.user_id 
        AND a.repertoire_id = b.repertoire_id 
        AND a.chapter_title = b.chapter_title 
        AND a.color = b.color 
        AND a.date < b.date;
    `);

    console.log('5. Fetching actual chapter IDs from Lichess...');
    const { rows: distinctStudies } = await client.query(
      `SELECT DISTINCT repertoire_id FROM history WHERE repertoire_id IS NOT NULL`
    );

    for (const row of distinctStudies) {
      const repId = row.repertoire_id;
      console.log(`   -> Fetching study: ${repId}`);
      try {
        const response = await fetch(`https://lichess.org/api/study/${repId}.pgn`);
        if (response.ok) {
          const pgnText = await response.text();
          const chapters = parseChapters(pgnText);

          for (const chap of chapters) {
            await client.query(
              `
              UPDATE history 
              SET chapter_id = $1 
              WHERE repertoire_id = $2 AND chapter_title = $3
            `,
              [chap.chapter_id, repId, chap.title]
            );
          }
        } else {
          console.log(
            `      [Warning] Could not fetch study ${repId} (Status: ${response.status})`
          );
        }
      } catch (err) {
        console.log(`      [Error] Failed to fetch study ${repId}: ${err.message}`);
      }
    }

    console.log(
      '5b. Filling chapter_id for any remaining unmatched rows with chapter_title (fallback)'
    );
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
