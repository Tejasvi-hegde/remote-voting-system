const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Candidate = require('../models/Candidate');
const Voter = require('../models/Voter');

/**
 * GET /api/voter/ballot
 * Protected — requires valid JWT from /api/auth/login
 *
 * Returns the list of candidates for the voter's constituency.
 */
router.get('/ballot', protect, async (req, res) => {
  try {
    const { constituencyID, constituencyName } = req.voter;

    const candidates = await Candidate.findAll({
      where: { constituencyID, isActive: true },
      attributes: ['candidateID', 'name', 'party', 'partySymbol'],
      order: [['name', 'ASC']]
    });

    if (!candidates || candidates.length === 0) {
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
 */
router.get('/status/:voterID', protect, async (req, res) => {
  try {
    const voter = await Voter.findOne({
      where: { voterID: req.params.voterID.toUpperCase() },
      attributes: ['voterID', 'name', 'constituencyId', 'constituencyName', 'hasVoted', 'votedAt']
    });

    if (!voter) {
      return res.status(404).json({ error: 'Voter not found.' });
    }

    res.json({ success: true, voter });
  } catch (err) {
    console.error('Voter lookup error:', err);
    res.status(500).json({ error: 'Lookup failed.' });
  }
});

module.exports = router;
