const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { extractFaceEmbedding } = require('../utils/face');

const rpName = 'Remote Voting System';
const rpID = 'localhost';
const origin = 'http://localhost:3000';

// Store challenges temporarily (in production use Redis or DB)
const registrationChallenges = {};

// GET /api/admin/voters
router.get('/voters', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [voters] = await db.query('SELECT id, voter_id, name, constituency, has_voted, face_embedding IS NOT NULL AS has_face FROM voters ORDER BY name ASC');
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
  const formattedVoterID = voterID.toUpperCase();

  // Validate format
  const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
  if (!epicRegex.test(formattedVoterID)) {
    return res.status(400).json({ error: 'Invalid voter ID format. Expected EPIC format (e.g. ABC1234567).' });
  }

  try {
    const [voters] = await db.query('SELECT voter_id, name, dob, address, constituency, fingerprint_template, face_embedding IS NOT NULL AS has_face FROM voters WHERE voter_id = ?', [formattedVoterID]);
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
    `, [String(fingerprintId), voterID.toUpperCase()]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    res.json({ message: 'Voter successfully registered as migrant (fingerprint linked)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/voter/register-face
// Body: { voterID, faceImage }
router.post('/voter/register-face', async (req, res) => {
  const db = req.app.locals.db;
  const { voterID, faceImage } = req.body;

  if (!voterID || !faceImage) {
    return res.status(400).json({ error: 'Missing voterID or faceImage data.' });
  }

  const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
  if (!epicRegex.test(voterID.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid voter ID format. Expected EPIC format (e.g. ABC1234567).' });
  }

  try {
    // 1. Extract 128-d face embedding
    const faceEmbedding = await extractFaceEmbedding(faceImage);

    // 2. Update voter record in database
    const [result] = await db.query(`
      UPDATE voters 
      SET face_embedding = ?, face_image = ? 
      WHERE voter_id = ?
    `, [JSON.stringify(faceEmbedding), faceImage, voterID.toUpperCase()]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Voter not found in national database.' });
    }

    res.json({ message: 'Voter successfully registered (face biometrics linked).' });
  } catch (err) {
    console.error('Face registration error:', err);
    res.status(500).json({ error: 'Face registration failed', detail: err.message });
  }
});

// POST /api/admin/candidate
router.post('/candidate', async (req, res) => {
  const db = req.app.locals.db;
  const { name, party, symbol, constituency, voterID } = req.body;

  if (!name || !party || !constituency || !voterID) {
    return res.status(400).json({ error: 'Missing required fields. Name, party, constituency, and voterID are required.' });
  }

  const formattedVoterID = voterID.toUpperCase();
  const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
  if (!epicRegex.test(formattedVoterID)) {
    return res.status(400).json({ error: 'Invalid candidate voter ID format. Expected EPIC format (e.g. ABC1234567).' });
  }

  try {
    // 1. Verify candidate is registered as a voter in voters table
    const [voters] = await db.query('SELECT name FROM voters WHERE voter_id = ?', [formattedVoterID]);
    if (voters.length === 0) {
      return res.status(404).json({ error: 'Candidate voter ID is not registered in the voters database.' });
    }

    // 2. Verify candidate is not already registered
    const [existing] = await db.query('SELECT id FROM candidates WHERE voter_id = ?', [formattedVoterID]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Voter is already registered as a candidate.' });
    }

    // 3. Add Candidate
    await db.query(`
      INSERT INTO candidates (id, voter_id, name, party, symbol, constituency)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuidv4(), formattedVoterID, name, party, symbol || '', constituency]);

    res.json({ message: 'Candidate added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
