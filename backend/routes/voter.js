const express = require('express');
const router = express.Router();
const { protect: authMiddleware } = require('../middleware/auth');

/**
 * GET /api/voter/ballot
 * Protected — requires valid JWT from /api/auth/verify
 *
 * Returns the list of candidates for the voter's constituency.
 */
router.get('/ballot', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { constituency } = req.voter;

    const [candidates] = await db.query(
      'SELECT id as candidateID, name, party, symbol as partySymbol FROM candidates WHERE constituency = ? ORDER BY name ASC',
      [constituency]
    );

    if (!candidates.length) {
      return res.status(404).json({
        error: `No candidates found for constituency: ${constituency}`
      });
    }

    res.json({
      success: true,
      constituency: { name: constituency },
      candidates
    });
  } catch (err) {
    console.error('Ballot fetch error:', err);
    res.status(500).json({ error: 'Failed to load ballot.' });
  }
});

/**
 * GET /api/voter/status/:voterID
 * Check if a voter ID exists and their voting status.
 */
router.get('/status/:voterID', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [voters] = await db.query(
      'SELECT voter_id as voterID, name, constituency, has_voted as hasVoted FROM voters WHERE voter_id = ?',
      [req.params.voterID.toUpperCase()]
    );

    if (voters.length === 0) {
      return res.status(404).json({ error: 'Voter not found.' });
    }

    res.json({ success: true, voter: voters[0] });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed.' });
  }
});

module.exports = router;
