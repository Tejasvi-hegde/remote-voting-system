const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { extractFaceEmbedding, getEuclideanDistance } = require('../utils/face');

const rpID = 'localhost';
const origin = 'http://localhost:3000';

const authenticationChallenges = {};

// POST /api/auth/register
// Body: { voterID, name, dob, address, constituency }
router.post('/register', async (req, res) => {
  const db = req.app.locals.db;
  const { voterID, name, dob, address, constituency } = req.body;

  if (!voterID || !name || !constituency) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Voter ID regex validation: 3 letters + 7 digits e.g. ABC1234567
  const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
  if (!epicRegex.test(voterID.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid voter ID format. Expected EPIC format (e.g. ABC1234567).' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM voters WHERE voter_id = ?', [voterID]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Voter already registered' });
    }

    await db.query(`
      INSERT INTO voters (id, voter_id, name, dob, address, constituency)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuidv4(), voterID.toUpperCase(), name, dob || '', address || '', constituency]);

    return res.status(201).json({ message: 'Voter registered successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// POST /api/auth/verify-face
// Body: { faceImage, terminalID }
// faceImage = base64 image data from the camera module
router.post('/verify-face', async (req, res) => {
  const db = req.app.locals.db;
  const { faceImage, terminalID } = req.body;

  if (!faceImage) {
    return res.status(400).json({ error: 'faceImage is required for face verification.' });
  }

  try {
    // 1. Extract 128-d face embedding from captured image
    const capturedEmbedding = await extractFaceEmbedding(faceImage);

    // 2. Fetch all voters who have registered face embeddings
    const [voters] = await db.query(
      'SELECT voter_id, name, constituency, face_embedding, has_voted FROM voters WHERE face_embedding IS NOT NULL'
    );

    if (voters.length === 0) {
      return res.status(404).json({ error: 'No registered face database found.' });
    }

    // 3. Compare captured embedding with each registered embedding to find best match
    let matchedVoter = null;
    let minDistance = Infinity;

    for (const voter of voters) {
      try {
        const storedEmbedding = JSON.parse(voter.face_embedding);
        const distance = getEuclideanDistance(capturedEmbedding, storedEmbedding);
        if (distance < minDistance) {
          minDistance = distance;
          matchedVoter = voter;
        }
      } catch (e) {
        console.error(`Error parsing face embedding for voter ${voter.voter_id}:`, e);
      }
    }

    // 4. Check if a match was found (threshold: 0.6)
    if (!matchedVoter || minDistance >= 0.6) {
      return res.status(401).json({ error: 'Face not recognized. Please stand clearly in front of the camera.' });
    }

    // 5. Check if the matched voter has already voted
    if (matchedVoter.has_voted === 1) {
      return res.status(403).json({ error: `Verification failed: Voter ${matchedVoter.name} has already voted.` });
    }

    // 6. Sign JWT
    const token = jwt.sign(
      {
        voterID: matchedVoter.voter_id,
        name: matchedVoter.name,
        constituency: matchedVoter.constituency,
        terminalID: terminalID || 'RVC-1'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // 7. Fetch ballot candidates for the voter's constituency to return immediately
    const [candidates] = await db.query(
      'SELECT id as candidateID, name, party, symbol as partySymbol FROM candidates WHERE constituency = ? ORDER BY name ASC',
      [matchedVoter.constituency]
    );

    return res.json({
      success: true,
      token,
      voterID: matchedVoter.voter_id,
      name: matchedVoter.name,
      constituency: matchedVoter.constituency,
      candidates
    });
  } catch (err) {
    console.error('Face verification error:', err);
    return res.status(500).json({ error: 'Face verification failed', detail: err.message });
  }
});

// POST /api/auth/verify-face-pi
// Body: { piIp }
router.post('/verify-face-pi', async (req, res) => {
  const db = req.app.locals.db;
  const { piIp } = req.body;

  if (!piIp) {
    return res.status(400).json({ error: 'piIp (Raspberry Pi IP address) is required.' });
  }

  const cleanIp = piIp.replace(/^(http:\/\/|https:\/\/)/, '').trim();
  const piUrl = `http://${cleanIp}:5002`;

  try {
    // 1. Fetch photo from Raspberry Pi camera
    console.log(`[Pi Verify] Contacting Raspberry Pi camera at ${piUrl}/capture`);
    const captureRes = await fetch(`${piUrl}/capture`, { signal: AbortSignal.timeout(10000) });
    if (!captureRes.ok) {
      throw new Error(`Failed to contact Pi camera server (HTTP ${captureRes.status})`);
    }
    const captureData = await captureRes.json();
    if (!captureData.success || !captureData.faceImage) {
      return res.status(502).json({ error: `Pi camera capture error: ${captureData.error || 'No image returned.'}` });
    }

    const { faceImage } = captureData;

    // 2. Extract 128-d face embedding from captured image
    console.log('[Pi Verify] Extracting face embedding from snapshot...');
    const capturedEmbedding = await extractFaceEmbedding(faceImage);

    // 3. Fetch all voters who have registered face embeddings
    const [voters] = await db.query(
      'SELECT voter_id, name, constituency, face_embedding, has_voted FROM voters WHERE face_embedding IS NOT NULL'
    );

    if (voters.length === 0) {
      return res.status(404).json({ error: 'No registered face database found.' });
    }

    // 4. Compare captured embedding with each registered embedding to find best match
    let matchedVoter = null;
    let minDistance = Infinity;

    for (const voter of voters) {
      try {
        const storedEmbedding = JSON.parse(voter.face_embedding);
        const distance = getEuclideanDistance(capturedEmbedding, storedEmbedding);
        if (distance < minDistance) {
          minDistance = distance;
          matchedVoter = voter;
        }
      } catch (e) {
        console.error(`Error parsing face embedding for voter ${voter.voter_id}:`, e);
      }
    }

    // 5. Check if a match was found (threshold: 0.6)
    if (!matchedVoter || minDistance >= 0.6) {
      return res.status(401).json({ error: 'Face not recognized. Please stand clearly in front of the camera.' });
    }

    // 6. Check if the matched voter has already voted
    if (matchedVoter.has_voted === 1) {
      return res.status(403).json({ error: `Verification failed: Voter ${matchedVoter.name} has already voted.` });
    }

    // 7. Sign JWT
    const terminalID = 'RVC-1';
    const token = jwt.sign(
      {
        voterID: matchedVoter.voter_id,
        name: matchedVoter.name,
        constituency: matchedVoter.constituency,
        terminalID
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // 8. Contact Raspberry Pi to showcase candidates
    // Pass laptop's backendUrl so Pi knows where to POST the final vote!
    const host = req.headers.host || `localhost:${process.env.PORT || 5001}`;
    // If it's localhost, fallback to standard http, otherwise infer from headers
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const backendUrl = `${protocol}://${host}`;

    console.log(`[Pi Verify] Sending showcase details to Pi at ${piUrl}/showcase`);
    const showcaseRes = await fetch(`${piUrl}/showcase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        voterID: matchedVoter.voter_id,
        name: matchedVoter.name,
        constituency: matchedVoter.constituency,
        backendUrl
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!showcaseRes.ok) {
      throw new Error(`Failed to send showcase details to Pi (HTTP ${showcaseRes.status})`);
    }

    const showcaseData = await showcaseRes.json();
    if (!showcaseData.success) {
      return res.status(502).json({ error: `Pi showcase error: ${showcaseData.error || 'Failed to start showcase.'}` });
    }

    return res.json({
      success: true,
      voterID: matchedVoter.voter_id,
      name: matchedVoter.name,
      constituency: matchedVoter.constituency,
      message: 'Face verified successfully! Candidates are now showcased on the Pi terminal.'
    });

  } catch (err) {
    console.error('Face verification error via Pi:', err);
    return res.status(500).json({ error: 'Pi face verification flow failed', detail: err.message });
  }
});

module.exports = router;
