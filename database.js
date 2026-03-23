const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
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
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
`);

module.exports = db;
