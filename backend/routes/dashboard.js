const express = require('express');
const router = express.Router();

// GET /api/dashboard/results/:constituency
router.get('/results/:constituency', async (req, res) => {
  const blockchain = req.app.locals.blockchain;
  const db = req.app.locals.db;
  const { constituency } = req.params;

  try {
    const voteCounts = blockchain.getVoteCounts(constituency);

    // Enrich with candidate names from MySQL
    const [candidates] = await db.query('SELECT * FROM candidates WHERE constituency = ?', [constituency]);

    const results = candidates.map(c => ({
      candidateID: c.name, // The frontend displays candidateID as the candidate's name
      party: c.party,
      symbol: c.symbol,
      count: voteCounts[c.id] || 0
    }));

    return res.json({ constituency, results });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch results', detail: err.message });
  }
});

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  const blockchain = req.app.locals.blockchain;
  const db = req.app.locals.db;

  try {
    const [[{ count: totalVoters }]] = await db.query('SELECT COUNT(*) as count FROM voters');
    const [[{ count: votedCount }]] = await db.query('SELECT COUNT(*) as count FROM voters WHERE has_voted = 1');
    const totalVotesOnChain = blockchain.getAllVotes().length;
    const chainValid = blockchain.isChainValid();

    // Group voters by constituency to get breakdown
    const [constituencyData] = await db.query(`
      SELECT constituency as name, 
             COUNT(*) as totalRegistered, 
             SUM(CASE WHEN has_voted = 1 THEN 1 ELSE 0 END) as totalVoted 
      FROM voters GROUP BY constituency
    `);

    const breakdown = constituencyData.map(c => ({
      _id: c.name,
      name: c.name,
      state: 'State',
      totalRegistered: c.totalRegistered,
      totalVoted: c.totalVoted,
      turnoutPercent: c.totalRegistered > 0 ? ((c.totalVoted / c.totalRegistered) * 100) : 0
    }));

    return res.json({
      stats: {
        totalRegistered: totalVoters,
        totalVoted: votedCount,
        turnoutPercent: totalVoters > 0 ? ((votedCount / totalVoters) * 100).toFixed(2) : '0',
        totalVotesOnChain,
        chainIntegrity: chainValid ? 'VALID' : 'COMPROMISED',
        constituencyBreakdown: breakdown
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats', detail: err.message });
  }
});

// GET /api/dashboard/transaction/:txID
router.get('/transaction/:txID', (req, res) => {
  const blockchain = req.app.locals.blockchain;
  const block = blockchain.findByHash(req.params.txID);
  if (!block) return res.status(404).json({ error: 'Transaction not found' });
  return res.json({
    blockIndex: block.index,
    timestamp: block.timestamp,
    hash: block.hash,
    previousHash: block.previousHash,
    constituency: block.data.constituency,
    terminalID: block.data.terminalID
    // NOTE: do NOT expose voterID or candidateID in this response to preserve vote secrecy
  });
});

// GET /api/dashboard/blockchain
router.get('/blockchain', (req, res) => {
  const blockchain = req.app.locals.blockchain;
  return res.json({ chain: blockchain.chain });
});

module.exports = router;
