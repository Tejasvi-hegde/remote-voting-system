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

// GET /api/admin/voter/lookup/:voterID
router.get('/voter/lookup/:voterID', async (req, res) => {
  const db = req.app.locals.db;
  const { voterID } = req.params;

  try {
    const [voters] = await db.query('SELECT voter_id, name, dob, address, constituency, fingerprint_template FROM voters WHERE voter_id = ?', [voterID]);
    if (voters.length === 0) {
      return res.status(404).json({ error: 'Voter not found in national database' });
    }
    res.json(voters[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST /api/admin/voter/register-migrant
router.post('/voter/register-migrant', async (req, res) => {
  const db = req.app.locals.db;
  const { voterID, fingerprintId } = req.body;

  if (!voterID || !fingerprintId) {
    return res.status(400).json({ error: 'Missing voterID or fingerprint ID' });
  }

  try {
    const [result] = await db.query(`
      UPDATE voters 
      SET fingerprint_template = ? 
      WHERE voter_id = ?
    `, [String(fingerprintId), voterID]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    res.json({ message: 'Voter successfully registered as migrant (fingerprint linked)' });
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
