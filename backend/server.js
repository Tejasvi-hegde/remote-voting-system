require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const db = require('./db/mysql');
const blockchain = require('./blockchain/chain');

const authRoutes = require('./routes/auth');
const voterRoutes = require('./routes/voter');
const voteRoutes = require('./routes/vote');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');

const app = express();

app.locals.db = db;
app.locals.blockchain = blockchain;

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

// Configure CORS to support local network access in development
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
      if (origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());

// Global rate limiter — max 100 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Try again later.' }
});
app.use(globalLimiter);

// Auth endpoints get a tighter limiter (prevents brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 10,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/voter', voterRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(process.env.PORT || 5001, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 5001}`);
});

module.exports = app;
