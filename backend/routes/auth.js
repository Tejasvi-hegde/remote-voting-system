const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { isMatch } = require('../utils/fingerprintMatch');
const { generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');

const rpID = 'localhost';
const origin = 'http://localhost:3000';

const authenticationChallenges = {};

// POST /api/auth/register
// Body: { voterID, name, dob, address, constituency, fingerprintAscii }
router.post('/register', async (req, res) => {
  const db = req.app.locals.db;
  const { voterID, name, dob, address, constituency, fingerprintAscii } = req.body;

  if (!voterID || !name || !constituency || !fingerprintAscii) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM voters WHERE voter_id = ?', [voterID]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Voter already registered' });
    }

    await db.query(`
      INSERT INTO voters (id, voter_id, name, dob, address, constituency, fingerprint_template)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), voterID, name, dob || '', address || '', constituency, fingerprintAscii]);

    return res.status(201).json({ message: 'Voter registered successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// POST /api/auth/verify
// Body: { voterID, fingerprintAscii, terminalID }
// fingerprintAscii = raw ASCII string content from fingerprint sensor .txt output file
router.post('/verify', async (req, res) => {
  const db = req.app.locals.db;
  const { voterID, fingerprintAscii, terminalID } = req.body;

  if (!voterID || !fingerprintAscii) {
    return res.status(400).json({ error: 'voterID and fingerprintAscii are required' });
  }

  try {
    const [voters] = await db.query('SELECT * FROM voters WHERE voter_id = ?', [voterID]);
    if (voters.length === 0) {
      return res.status(404).json({ error: 'Voter not found' });
    }
    const voter = voters[0];

    if (voter.has_voted === 1) {
      return res.status(403).json({ error: 'Voter has already voted' });
    }

    const matched = isMatch(fingerprintAscii, voter.fingerprint_template);
    if (!matched) {
      return res.status(401).json({ error: 'Fingerprint does not match' });
    }

    const token = jwt.sign(
      { voterID: voter.voter_id, name: voter.name, constituency: voter.constituency, terminalID: terminalID || 'UNKNOWN' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({ token, constituency: voter.constituency, name: voter.name });
  } catch (err) {
    return res.status(500).json({ error: 'Verification failed', detail: err.message });
  }
});

module.exports = router;
