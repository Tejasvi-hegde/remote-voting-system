const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Candidate = require('../models/Candidate');

/**
 * GET /api/voter/ballot
 * Protected — requires valid JWT from /api/auth/verify
 *
 * Returns the list of candidates for the voter's constituency.
 * The constituency is extracted from the JWT, not from query params
 * — so a voter cannot see another constituency's ballot.
 */
router.get('/ballot', protect, async (req, res) => {
  try {
    const { constituencyID, constituencyName } = req.voter;

    const candidates = await Candidate.find(
      { constituencyID, isActive: true },
      { _id: 0, candidateID: 1, name: 1, party: 1, partySymbol: 1 }
    ).sort({ name: 1 });

    if (!candidates.length) {
      return res.status(404).json({
        error: `No candidates found for constituency: ${constituencyName}`
      });
    }

    res.json({
      success: true,
      constituency: { id: constituencyID, name: constituencyName },
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
 * Used by EC admin to look up a voter.
 */
router.get('/status/:voterID', protect, async (req, res) => {
  try {
    const voter = await require('../models/Voter').findOne(
      { voterID: req.params.voterID.toUpperCase() },
      { _id: 0, voterID: 1, name: 1, constituency: 1, hasVoted: 1, votedAt: 1 }
    );

    if (!voter) {
      return res.status(404).json({ error: 'Voter not found.' });
    }

    res.json({ success: true, voter });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed.' });
  }
});

module.exports = router;
