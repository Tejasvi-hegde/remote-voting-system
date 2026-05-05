const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Voter = require('../models/Voter');

/**
 * POST /api/auth/register
 * Mock Drill: Register a new migrant voter.
 */
router.post('/register', async (req, res) => {
  try {
    const { voterID, name, password, constituencyID, constituencyName } = req.body;

    if (!voterID || !name || !password || !constituencyID || !constituencyName) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const existing = await Voter.findOne({ where: { voterID: voterID.toUpperCase() } });
    if (existing) {
      return res.status(409).json({ error: 'Voter ID already registered.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const voter = await Voter.create({
      voterID: voterID.toUpperCase(),
      name,
      password: hashedPassword,
      constituencyId: constituencyID,
      constituencyName,
      constituencyState: 'Mock State'
    });

    res.status(201).json({
      success: true,
      message: 'Voter pre-registered successfully.',
      voterID: voter.voterID
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Registration failed.' });
  }
});

/**
 * POST /api/auth/login
 * Mock Drill: Login with voter ID and password.
 */
router.post('/login', async (req, res) => {
  try {
    const { voterID, password } = req.body;

    if (!voterID || !password) {
      return res.status(400).json({ error: 'Voter ID and password are required.' });
    }

    const voter = await Voter.findOne({ where: { voterID: voterID.toUpperCase() } });

    if (!voter) {
      return res.status(401).json({ error: 'Authentication failed. Voter not recognized.' });
    }

    if (!voter.isActive) {
      return res.status(403).json({ error: 'Voter account is inactive.' });
    }

    const isMatch = await bcrypt.compare(password, voter.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Authentication failed. Invalid password.' });
    }

    if (voter.hasVoted) {
      return res.status(403).json({
        error: 'This voter has already cast their vote.',
        votedAt: voter.votedAt
      });
    }

    const token = jwt.sign(
      {
        voterID: voter.voterID,
        constituencyID: voter.constituencyId,
        constituencyName: voter.constituencyName,
        voterName: voter.name,
        terminalID: 'MOCK-TERMINAL-01'
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    console.log(`✅ Voter ${voter.voterID} logged in mock terminal`);

    res.json({
      success: true,
      token,
      voter: {
        name: voter.name,
        voterID: voter.voterID,
        constituency: {
          id: voter.constituencyId,
          name: voter.constituencyName
        }
      }
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication service error.' });
  }
});

module.exports = router;
