const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/auth');
const Voter = require('../models/Voter');
const Vote = require('../models/Vote');

/**
 * Encrypt a vote using AES-256.
 */
function encryptVote(candidateID, voterID) {
  const payload = JSON.stringify({
    candidateID,
    voterID,
    timestamp: Date.now()
  });
  return CryptoJS.AES.encrypt(payload, process.env.VOTE_ENCRYPTION_KEY || 'mock_key').toString();
}

/**
 * POST /api/vote/cast
 * Protected — requires valid JWT
 */
router.post('/cast', protect, async (req, res) => {
  const { voterID, constituencyID, terminalID } = req.voter;
  const { candidateID } = req.body;

  if (!candidateID) {
    return res.status(400).json({ error: 'candidateID is required.' });
  }

  try {
    // 1. Double-check voter hasn't already voted
    const voter = await Voter.findOne({ where: { voterID } });
    if (!voter) {
      return res.status(404).json({ error: 'Voter not found.' });
    }
    if (voter.hasVoted) {
      return res.status(403).json({ error: 'Duplicate vote detected.' });
    }

    // 2. Encrypt the vote
    const encryptedVote = encryptVote(candidateID, voterID);

    // 3. Simulate Blockchain Commit (Save to Vote table)
    const transactionID = uuidv4();
    await Vote.create({
      transactionID,
      voterID,
      candidateID,
      constituencyID,
      encryptedVote
    });

    // 4. Update Voter status
    await voter.update({
      hasVoted: true,
      votedAt: new Date(),
      votedAtTerminal: terminalID
    });

    console.log(`✅ Vote cast mock ledger: voterID=${voterID} candidate=${candidateID} txID=${transactionID}`);

    res.json({
      success: true,
      message: 'Your vote has been recorded securely in the mock ledger.',
      transactionID,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Vote cast error:', err);
    res.status(500).json({ error: 'Vote submission failed. Please try again.' });
  }
});

module.exports = router;
