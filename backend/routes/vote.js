const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect: authMiddleware } = require('../middleware/auth');   // keep existing JWT middleware

function encryptVote(candidateID, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(candidateID, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// POST /api/vote/cast
// Body: { candidateID }
// Header: Authorization: Bearer <JWT>
router.post('/cast', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const blockchain = req.app.locals.blockchain;
  const { candidateID } = req.body;
  const { voterID, constituency, terminalID } = req.voter; // from JWT middleware

  if (!candidateID) {
    return res.status(400).json({ error: 'candidateID is required' });
  }

  // Double-check: has this voter already voted in blockchain?
  if (blockchain.hasVoted(voterID)) {
    return res.status(403).json({ error: 'Vote already recorded on blockchain' });
  }

  try {
    // Double-check in MySQL
    const [voters] = await db.query('SELECT has_voted FROM voters WHERE voter_id = ?', [voterID]);
    if (voters.length === 0) return res.status(404).json({ error: 'Voter not found' });
    const voter = voters[0];
    if (voter.has_voted === 1) return res.status(403).json({ error: 'Already voted' });

    // Encrypt the vote
    const encryptionKey = process.env.VOTE_ENCRYPTION_KEY;
    const encryptedVote = encryptVote(candidateID, encryptionKey);

    // 1. Add Voter Status Block to blockchain (no candidate info to protect secrecy)
    blockchain.addBlock({
      voterID,
      hasVoted: true,
      constituency,
      terminalID,
      timestamp: new Date().toISOString()
    });

    // 2. Add Anonymous Vote Block to blockchain (no voter ID to protect secrecy)
    const block = blockchain.addBlock({
      candidateID,
      encryptedVote,
      constituency,
      terminalID,
      timestamp: new Date().toISOString()
    });

    // Mark voter as voted in MySQL
    await db.query('UPDATE voters SET has_voted = 1 WHERE voter_id = ?', [voterID]);

    return res.json({
      message: 'Vote cast successfully',
      transactionID: block.hash,
      blockIndex: block.index,
      timestamp: block.timestamp
    });
  } catch (err) {
    return res.status(500).json({ error: 'Vote processing failed', detail: err.message });
  }
});

// POST /api/vote/cast-pi
// Body: { clickedNumber }
// Header: Authorization: Bearer <JWT>
router.post('/cast-pi', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const blockchain = req.app.locals.blockchain;
  const { clickedNumber } = req.body;
  const { voterID, constituency, terminalID } = req.voter; // from JWT middleware

  if (clickedNumber === undefined) {
    return res.status(400).json({ error: 'clickedNumber is required' });
  }

  // Double-check: has this voter already voted in blockchain?
  if (blockchain.hasVoted(voterID)) {
    return res.status(403).json({ error: 'Vote already recorded on blockchain' });
  }

  try {
    // Double-check in MySQL
    const [voters] = await db.query('SELECT has_voted FROM voters WHERE voter_id = ?', [voterID]);
    if (voters.length === 0) return res.status(404).json({ error: 'Voter not found' });
    const voter = voters[0];
    if (voter.has_voted === 1) return res.status(403).json({ error: 'Already voted' });

    // Query candidates for the voter's constituency sorted alphabetically by name
    const [candidates] = await db.query(
      'SELECT id as candidateID, name, party, symbol as partySymbol FROM candidates WHERE constituency = ? ORDER BY name ASC',
      [constituency]
    );

    let candidateID;
    if (clickedNumber === 8 || clickedNumber === 'NOTA') {
      candidateID = 'NOTA';
    } else {
      const candIdx = Number(clickedNumber) - 1; // Convert 1-based index to 0-based
      if (candIdx >= 0 && candIdx < candidates.length) {
        candidateID = candidates[candIdx].candidateID;
      } else {
        return res.status(400).json({ error: `Invalid candidate clicked index ${clickedNumber} for constituency ${constituency}` });
      }
    }

    // Encrypt the vote
    const encryptionKey = process.env.VOTE_ENCRYPTION_KEY;
    const encryptedVote = encryptVote(candidateID, encryptionKey);

    // 1. Add Voter Status Block to blockchain (no candidate info to protect secrecy)
    blockchain.addBlock({
      voterID,
      hasVoted: true,
      constituency,
      terminalID,
      timestamp: new Date().toISOString()
    });

    // 2. Add Anonymous Vote Block to blockchain (no voter ID to protect secrecy)
    const block = blockchain.addBlock({
      candidateID,
      encryptedVote,
      constituency,
      terminalID,
      timestamp: new Date().toISOString()
    });

    // Mark voter as voted in MySQL
    await db.query('UPDATE voters SET has_voted = 1 WHERE voter_id = ?', [voterID]);

    return res.json({
      message: 'Vote cast successfully via Pi',
      transactionID: block.hash,
      blockIndex: block.index,
      timestamp: block.timestamp
    });
  } catch (err) {
    return res.status(500).json({ error: 'Vote processing failed', detail: err.message });
  }
});

module.exports = router;
