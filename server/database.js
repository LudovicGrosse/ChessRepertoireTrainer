const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Makes the connection secure (necessary for most cloud hosts like Render/Neon)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Initialize tables
const initDB = async () => {
  try {
    await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                is_verified INTEGER DEFAULT 0,
                verification_token VARCHAR(255),
                reset_token VARCHAR(255),
                reset_token_expiry TIMESTAMP,
                lichess_access_token VARCHAR(255),
                lichess_refresh_token VARCHAR(255),
                lichess_token_expiry TIMESTAMP,
                lichess_username VARCHAR(255) UNIQUE,
                is_teacher BOOLEAN DEFAULT FALSE
            );

            DO $$ 
            BEGIN
              IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
                ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_access_token VARCHAR(255);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_refresh_token VARCHAR(255);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_token_expiry TIMESTAMP;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_username VARCHAR(255);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS is_teacher BOOLEAN DEFAULT FALSE;
                ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
                ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_lichess_username_key') THEN
                  ALTER TABLE users ADD CONSTRAINT users_lichess_username_key UNIQUE (lichess_username);
                END IF;
              END IF;
            END $$;

            DO $$ 
            BEGIN
              IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'repertoires') THEN
                IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'old_repertoires') THEN
                  ALTER TABLE repertoires RENAME TO old_repertoires;
                END IF;
              END IF;
              IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'history') THEN
                IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'old_history') THEN
                  ALTER TABLE history RENAME TO old_history;
                END IF;
              END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS repertoires (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chapters (
                id VARCHAR(255) PRIMARY KEY,
                repertoire_id VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                white_moves INTEGER DEFAULT 0,
                black_moves INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (repertoire_id) REFERENCES repertoires(id) ON DELETE CASCADE
            );

            DO $$ 
            BEGIN
              IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chapters') THEN
                ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
              END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS user_repertoires (
                user_id INTEGER NOT NULL,
                repertoire_id VARCHAR(255) NOT NULL,
                color VARCHAR(50) NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, repertoire_id, color),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (repertoire_id) REFERENCES repertoires(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                repertoire_id VARCHAR(255) NOT NULL,
                chapter_id VARCHAR(255) NOT NULL,
                color VARCHAR(50) NOT NULL,
                date TIMESTAMP NOT NULL,
                total_moves INTEGER,
                errors INTEGER,
                is_revision INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (repertoire_id) REFERENCES repertoires(id) ON DELETE CASCADE,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
                UNIQUE(user_id, repertoire_id, chapter_id, color)
            );

            CREATE TABLE IF NOT EXISTS study_shares (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER NOT NULL,
                repertoire_id VARCHAR(255) NOT NULL,
                repertoire_title VARCHAR(255) NOT NULL,
                target_username VARCHAR(255) NOT NULL,
                color VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (repertoire_id) REFERENCES repertoires(id) ON DELETE CASCADE,
                UNIQUE(repertoire_id, target_username, color)
            );

            DO $$
            BEGIN
              IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'old_repertoires') THEN
                INSERT INTO repertoires (id, title, updated_at)
                SELECT repertoire_id, MAX(title), CURRENT_TIMESTAMP
                FROM old_repertoires
                GROUP BY repertoire_id
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO user_repertoires (user_id, repertoire_id, color, added_at)
                SELECT user_id, repertoire_id, color, added_at
                FROM old_repertoires
                ON CONFLICT (user_id, repertoire_id, color) DO NOTHING;
              END IF;

              IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'old_history') THEN
                INSERT INTO chapters (id, repertoire_id, title, white_moves, black_moves)
                SELECT chapter_id, repertoire_id, MAX(chapter_title), 0, 0
                FROM old_history
                GROUP BY chapter_id, repertoire_id
                ON CONFLICT (id) DO NOTHING;

                INSERT INTO history (user_id, repertoire_id, chapter_id, color, date, total_moves, errors, is_revision)
                SELECT user_id, repertoire_id, chapter_id, color, date, total_moves, errors, is_revision
                FROM old_history
                ON CONFLICT (user_id, repertoire_id, chapter_id, color) DO NOTHING;
              END IF;
            END $$;
        `);
    console.log('PostgreSQL Database initialized');
  } catch (err) {
    console.error('Error initializing PostgreSQL database', err);
  }
};

initDB();

module.exports = pool;
