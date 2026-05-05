const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const Voter = require('../models/Voter');
const Vote = require('../models/Vote');

/**
 * GET /api/dashboard/results/:constituencyID
 *
 * Queries the mock SQLite ledger (Vote table) for vote counts.
 */
router.get('/results/:constituencyID', async (req, res) => {
  try {
    const constituencyID = req.params.constituencyID;
    
    // Perform GROUP BY candidateID to count votes
    const voteCounts = await Vote.findAll({
      where: { constituencyID },
      attributes: [
        'candidateID',
        [sequelize.fn('COUNT', sequelize.col('candidateID')), 'count']
      ],
      group: ['candidateID']
    });

    // Format the results to match frontend expectations
    const results = {};
    voteCounts.forEach(v => {
      results[v.candidateID] = parseInt(v.get('count'), 10);
    });

    res.json({
      success: true,
      constituencyID,
      results
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
    const totalRegistered = await Voter.count({ where: { isActive: true } });
    const totalVoted = await Voter.count({ where: { hasVoted: true } });

    // Breakdown by constituency
    const breakdown = await Voter.findAll({
      where: { isActive: true },
      attributes: [
        ['constituencyId', 'id'],
        ['constituencyName', 'name'],
        ['constituencyState', 'state'],
        [sequelize.fn('COUNT', sequelize.col('voterID')), 'totalRegistered'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN hasVoted = 1 THEN 1 ELSE 0 END")), 'totalVoted']
      ],
      group: ['constituencyId', 'constituencyName', 'constituencyState'],
      order: [['constituencyName', 'ASC']]
    });

    const constituencyBreakdown = breakdown.map(b => {
      const registered = parseInt(b.get('totalRegistered'), 10) || 0;
      const voted = parseInt(b.get('totalVoted'), 10) || 0;
      const turnoutPercent = registered > 0 ? (voted / registered) * 100 : 0;
      return {
        _id: b.get('id'),
        name: b.get('name'),
        state: b.get('state'),
        totalRegistered: registered,
        totalVoted: voted,
        turnoutPercent
      };
    });

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
 * Look up a specific transaction on the mock ledger.
 */
router.get('/transaction/:txID', async (req, res) => {
  try {
    const tx = await Vote.findOne({ where: { transactionID: req.params.txID } });
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    
    res.json({ 
      success: true, 
      transaction: {
        transactionID: tx.transactionID,
        timestamp: tx.createdAt,
        encryptedVote: tx.encryptedVote,
        constituencyID: tx.constituencyID
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve transaction.' });
  }
});

module.exports = router;
