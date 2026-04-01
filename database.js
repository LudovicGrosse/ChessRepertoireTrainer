const { Pool } = require('pg');
require('dotenv').config();

/**
 * Database connection configuration
 * Uses DATABASE_URL from environment variables
 */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Enable SSL for cloud hosting providers (like Render/Heroku)
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Initializes the database schema if tables don't exist
 */
const initDB = async () => {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                verification_token TEXT,
                reset_token TEXT,
                reset_token_expires TIMESTAMP
            );
        `);

        // Create history table for tracking training sessions
        // chapter_title and repertoire_title are updated dynamically via sync
        await pool.query(`
            CREATE TABLE IF NOT EXISTS history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                repertoire_title TEXT NOT NULL,
                chapter_title TEXT NOT NULL,
                study_id TEXT,
                color TEXT NOT NULL,
                date TIMESTAMP NOT NULL,
                moves_learned INTEGER DEFAULT 0,
                total_moves INTEGER DEFAULT 0,
                errors INTEGER DEFAULT 0,
                total_chapters INTEGER DEFAULT 0,
                is_revision INTEGER DEFAULT 0 -- 0 for Discovery, 1 for Revision
            );
        `);

        console.log("✅ PostgreSQL Database initialized successfully");
    } catch (err) {
        console.error("❌ Error initializing PostgreSQL database:", err);
    }
};

initDB();

module.exports = pool;
