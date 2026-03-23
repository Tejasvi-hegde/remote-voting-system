const express = require('express');
const router = express.Router();
const { getContract } = require('../fabric/network');
const Voter = require('../models/Voter');

/**
 * GET /api/dashboard/results/:constituencyID
 *
 * Queries the blockchain (CouchDB state DB via chaincode) for vote counts.
 * Returns totals per candidate for a given constituency.
 * No auth required for results — this is publicly readable after voting.
 */
router.get('/results/:constituencyID', async (req, res) => {
  try {
    const contract = await getContract();

    // Calls evaluateTransaction — read-only, no new block created
    const result = await contract.evaluateTransaction(
      'getVoteCounts',
      req.params.constituencyID
    );

    const counts = JSON.parse(result.toString());

    res.json({
      success: true,
      constituencyID: req.params.constituencyID,
      results: counts
    });
  } catch (err) {
    console.error('Results fetch error:', err);
    res.status(500).json({ error: 'Failed to retrieve results.' });
  }
});

/**
 * GET /api/dashboard/stats
 * Aggregate statistics: total registered voters, total votes cast, turnout %
 */
router.get('/stats', async (req, res) => {
  try {
    const totalRegistered = await Voter.countDocuments({ isActive: true });
    const totalVoted = await Voter.countDocuments({ hasVoted: true });

    // Breakdown by constituency
    const constituencyBreakdown = await Voter.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$constituency.id',
          name: { $first: '$constituency.name' },
          state: { $first: '$constituency.state' },
          totalRegistered: { $sum: 1 },
          totalVoted: { $sum: { $cond: ['$hasVoted', 1, 0] } }
        }
      },
      {
        $addFields: {
          turnoutPercent: {
            $multiply: [
              { $divide: ['$totalVoted', '$totalRegistered'] },
              100
            ]
          }
        }
      },
      { $sort: { name: 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalRegistered,
        totalVoted,
        turnoutPercent: totalRegistered > 0
          ? ((totalVoted / totalRegistered) * 100).toFixed(2)
          : 0,
        constituencyBreakdown
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

/**
 * GET /api/dashboard/transaction/:txID
 * Look up a specific transaction on the blockchain by its ID.
 * Voters can use this to verify their vote was recorded.
 */
router.get('/transaction/:txID', async (req, res) => {
  try {
    const contract = await getContract();
    const result = await contract.evaluateTransaction(
      'getTransactionByID',
      req.params.txID
    );
    const tx = JSON.parse(result.toString());
    res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(404).json({ error: 'Transaction not found.' });
  }
});

module.exports = router;
