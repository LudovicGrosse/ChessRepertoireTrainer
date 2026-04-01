const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Rend la connexion sécurisée (nécessaire pour la plupart des hébergeurs cloud comme Render/Neon)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialisation des tables
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_verified INTEGER DEFAULT 0,
                verification_token VARCHAR(255),
                reset_token VARCHAR(255),
                reset_token_expiry TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                repertoire_title VARCHAR(255),
                chapter_title VARCHAR(255),
                study_id VARCHAR(255),
                color VARCHAR(50),
                date TIMESTAMP NOT NULL,
                moves_learned INTEGER,
                total_moves INTEGER,
                errors INTEGER,
                total_chapters INTEGER,
                is_revision INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log("PostgreSQL Database initialized");
    } catch (err) {
        console.error("Error initializing PostgreSQL database", err);
    }
};

initDB();

module.exports = pool;
