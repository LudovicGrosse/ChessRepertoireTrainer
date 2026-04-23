require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const historyRoutes = require('./routes/historyRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');
const lichessRoutes = require('./routes/lichessRoutes');

const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://lichess1.org'],
        connectSrc: ["'self'", 'https://lichess.org', 'https://cdn.jsdelivr.net'],
      },
    },
  })
);

app.use(cors());
app.use(express.json());

// Global Rate Limiter for API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiLimiter); // Apply global limiter to all /api routes
app.use('/api', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/repertoires', repertoireRoutes);
app.use('/api/lichess', lichessRoutes);

// Fallback to index.html for SPA (Single Page Application) behavior
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
