const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const { protect } = require('../middleware/auth');
const Voter = require('../models/Voter');
const { getContract } = require('../fabric/network');

/**
 * Encrypt a vote using AES-256.
 * The encrypted vote is what gets stored on the blockchain ledger —
 * making the ledger publicly verifiable but vote-secret.
 */
function encryptVote(candidateID, voterID) {
  const payload = JSON.stringify({
    candidateID,
    voterID,
    timestamp: Date.now()
  });
  return CryptoJS.AES.encrypt(payload, process.env.VOTE_ENCRYPTION_KEY).toString();
}

/**
 * POST /api/vote/cast
 * Protected — requires valid JWT
 *
 * Body: { candidateID }
 *
 * Flow:
 * 1. Validate JWT (middleware)
 * 2. Check voter hasn't voted (double-check in MongoDB)
 * 3. Encrypt the vote
 * 4. Submit to Hyperledger Fabric via castVote chaincode function
 * 5. Mark voter as hasVoted=true in MongoDB
 * 6. Return transaction ID
 */
router.post('/cast', protect, async (req, res) => {
  const { voterID, constituencyID, terminalID } = req.voter;
  const { candidateID } = req.body;

  if (!candidateID) {
    return res.status(400).json({ error: 'candidateID is required.' });
  }

  try {
    // 1. Double-check voter hasn't already voted (race condition guard)
    const voter = await Voter.findOne({ voterID });
    if (!voter) {
      return res.status(404).json({ error: 'Voter not found.' });
    }
    if (voter.hasVoted) {
      return res.status(403).json({ error: 'Duplicate vote detected.' });
    }

    // 2. Encrypt the vote
    const encryptedVote = encryptVote(candidateID, voterID);

    // 3. Submit transaction to Hyperledger Fabric
    const contract = await getContract();

    // castVote(voterID, encryptedVote, candidateID, constituencyID)
    // The chaincode also checks for duplicate votes on-chain
    const result = await contract.submitTransaction(
      'castVote',
      voterID,
      encryptedVote,
      candidateID,
      constituencyID
    );

    const txResult = JSON.parse(result.toString());

    // 4. Update MongoDB — mark voter as voted
    // This runs AFTER successful blockchain commit
    await Voter.findOneAndUpdate(
      { voterID },
      {
        hasVoted: true,
        votedAt: new Date(),
        votedAtTerminal: terminalID
      }
    );

    console.log(`✅ Vote cast: voterID=${voterID} candidate=${candidateID} txID=${txResult.transactionID}`);

    res.json({
      success: true,
      message: 'Your vote has been recorded securely.',
      transactionID: txResult.transactionID,
      timestamp: txResult.timestamp
    });
  } catch (err) {
    // Handle chaincode-level rejections (e.g. duplicate vote on-chain)
    if (err.message && err.message.includes('already voted')) {
      return res.status(403).json({ error: 'Duplicate vote detected on blockchain.' });
    }
    console.error('Vote cast error:', err);
    res.status(500).json({ error: 'Vote submission failed. Please try again.' });
  }
});

module.exports = router;
