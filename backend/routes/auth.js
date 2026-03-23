const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Voter = require('../models/Voter');

/**
 * POST /api/auth/verify
 * 
 * Called by the Raspberry Pi after capturing the fingerprint.
 * Body: { voterID, biometricHash, terminalID }
 * 
 * Steps:
 * 1. Find voter by voterID
 * 2. Compare biometricHash (SHA-256 of fingerprint template)
 * 3. Check voter hasn't already voted
 * 4. Return JWT token + constituency info
 */
router.post('/verify', async (req, res) => {
  try {
    const { voterID, biometricHash, terminalID } = req.body;

    // Input validation
    if (!voterID || !biometricHash || !terminalID) {
      return res.status(400).json({
        error: 'voterID, biometricHash, and terminalID are required.'
      });
    }

    // Find voter
    const voter = await Voter.findOne({ voterID: voterID.toUpperCase() });

    if (!voter) {
      // Return same message whether voter not found or biometric mismatch
      // — prevents user enumeration attacks
      return res.status(401).json({ error: 'Authentication failed. Voter not recognized.' });
    }

    if (!voter.isActive) {
      return res.status(403).json({ error: 'Voter account is inactive.' });
    }

    // Compare biometric hash (constant-time comparison to prevent timing attacks)
    const crypto = require('crypto');
    const providedHash = Buffer.from(biometricHash, 'hex');
    const storedHash = Buffer.from(voter.biometricHash, 'hex');

    if (
      providedHash.length !== storedHash.length ||
      !crypto.timingSafeEqual(providedHash, storedHash)
    ) {
      console.warn(`⚠️  Biometric mismatch for voterID: ${voterID} at terminal: ${terminalID}`);
      return res.status(401).json({ error: 'Authentication failed. Voter not recognized.' });
    }

    // Check for duplicate voting
    if (voter.hasVoted) {
      return res.status(403).json({
        error: 'This voter has already cast their vote.',
        votedAt: voter.votedAt
      });
    }

    // Issue JWT — expires in 15 minutes (voter must cast vote within this window)
    const token = jwt.sign(
      {
        voterID: voter.voterID,
        constituencyID: voter.constituency.id,
        constituencyName: voter.constituency.name,
        voterName: voter.name,
        terminalID
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    console.log(`✅ Voter ${voter.voterID} authenticated at terminal ${terminalID}`);

    res.json({
      success: true,
      token,
      voter: {
        name: voter.name,
        voterID: voter.voterID,
        constituency: voter.constituency
      }
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication service error.' });
  }
});

/**
 * POST /api/auth/register
 * 
 * Pre-register a voter (called during migration voter portal setup).
 * In production this would be done by Election Commission admins only.
 * Body: { voterID, name, biometricHash, constituency }
 */
router.post('/register', async (req, res) => {
  try {
    const { voterID, name, biometricHash, constituency } = req.body;

    if (!voterID || !name || !biometricHash || !constituency) {
      return res.status(400).json({ error: 'All fields required.' });
    }

    const existing = await Voter.findOne({ voterID: voterID.toUpperCase() });
    if (existing) {
      return res.status(409).json({ error: 'Voter ID already registered.' });
    }

    const voter = await Voter.create({
      voterID: voterID.toUpperCase(),
      name,
      biometricHash,
      constituency
    });

    res.status(201).json({
      success: true,
      message: 'Voter pre-registered successfully.',
      voterID: voter.voterID
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Voter ID already exists.' });
    }
    res.status(500).json({ error: 'Registration failed.' });
  }
});

module.exports = router;
