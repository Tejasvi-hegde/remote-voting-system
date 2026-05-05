const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { generateRegistrationOptions, verifyRegistrationResponse } = require('@simplewebauthn/server');

const rpName = 'Remote Voting System';
const rpID = 'localhost';
const origin = 'http://localhost:3000';

// Store challenges temporarily (in production use Redis or DB)
const registrationChallenges = {};

// GET /api/admin/voters
router.get('/voters', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [voters] = await db.query('SELECT id, voter_id, name, constituency, has_voted FROM voters ORDER BY name ASC');
    res.json(voters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/candidates
router.get('/candidates', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [candidates] = await db.query('SELECT * FROM candidates ORDER BY name ASC');
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// POST /api/admin/voter
router.post('/voter', async (req, res) => {
  const db = req.app.locals.db;
  const { voterID, name, dob, address, constituency, fingerprintAscii } = req.body;

  if (!voterID || !name || !constituency || !fingerprintAscii) {
    return res.status(400).json({ error: 'Missing required fields or fingerprint' });
  }

  try {
    await db.query(`
      INSERT INTO voters (id, voter_id, name, dob, address, constituency, fingerprint_template)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), voterID, name, dob || '', address || '', constituency, fingerprintAscii]);
    
    res.json({ message: 'Voter added successfully with fingerprint' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/candidate
router.post('/candidate', async (req, res) => {
  const db = req.app.locals.db;
  const { name, party, symbol, constituency } = req.body;

  if (!name || !party || !constituency) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await db.query(`
      INSERT INTO candidates (id, name, party, symbol, constituency)
      VALUES (?, ?, ?, ?, ?)
    `, [uuidv4(), name, party, symbol || '', constituency]);
    res.json({ message: 'Candidate added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
