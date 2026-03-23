const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

// RESET DATABASE (Requested by user to start fresh)
db.exec(`
    DROP TABLE IF EXISTS history;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expiry DATETIME
    );

    CREATE TABLE history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        repertoire_title TEXT,
        chapter_title TEXT,
        study_id TEXT,
        color TEXT,
        date TEXT NOT NULL,
        moves_learned INTEGER,
        total_moves INTEGER,
        errors INTEGER,
        total_chapters INTEGER,
        is_revision INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
`);

module.exports = db;
