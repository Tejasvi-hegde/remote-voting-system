import React, { useEffect, useState, useCallback } from 'react';
import { fetchStats, fetchResults, verifyTransaction, fetchBlockchain } from '../api';

/**
 * Dashboard — Election Commission Admin View
 * Route: /dashboard
 *
 * Shows:
 * - Live voter turnout statistics
 * - Constituency-wise vote counts (from blockchain via CouchDB)
 * - Transaction verification tool
 *
 * Auto-refreshes every 30 seconds.
 */
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [selectedConstituency, setSelectedConstituency] = useState('');
  const [results, setResults] = useState([]);
  const [txID, setTxID] = useState('');
  const [txResult, setTxResult] = useState(null);
  const [txError, setTxError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [chainData, setChainData] = useState([]);

  const loadStats = useCallback(() => {
    fetchStats()
      .then(({ data }) => {
        setStats(data.stats);
        setLastUpdated(new Date());
        // Auto-select first constituency
        if (!selectedConstituency && data.stats.constituencyBreakdown?.length > 0) {
          setSelectedConstituency(data.stats.constituencyBreakdown[0]._id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetchBlockchain()
      .then(({ data }) => setChainData(data.chain))
      .catch(console.error);
  }, [selectedConstituency]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [loadStats]);

  useEffect(() => {
    if (!selectedConstituency) return;
    fetchResults(selectedConstituency)
      .then(({ data }) => setResults(data.results || []))
      .catch(console.error);
  }, [selectedConstituency]);

  const handleVerifyTx = async () => {
    if (!txID.trim()) return;
    setTxError('');
    setTxResult(null);
    try {
      const { data } = await verifyTransaction(txID.trim());
      setTxResult(data.transaction);
    } catch {
      setTxError('Transaction not found on blockchain.');
    }
  };

  const totalVotes = results.reduce((sum, r) => sum + r.count, 0);

  if (loading) {
    return (
      <div className="screen loading-screen">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1>🗳️ Election Commission — Live Dashboard</h1>
          <p className="last-updated">
            Last updated: {lastUpdated?.toLocaleTimeString()} · Auto-refreshes every 30s
          </p>
        </div>
        <button className="btn-secondary" onClick={loadStats}>↻ Refresh</button>
      </div>

      {/* Summary stat cards */}
      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">Total Registered Voters</p>
            <p className="stat-value">{stats.totalRegistered.toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Votes Cast</p>
            <p className="stat-value blue">{stats.totalVoted.toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Voter Turnout</p>
            <p className="stat-value green">{stats.turnoutPercent}%</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Constituencies</p>
            <p className="stat-value">{stats.constituencyBreakdown?.length || 0}</p>
          </div>
        </div>
      )}

      <div className="dash-body">
        {/* Left: constituency breakdown */}
        <div className="dash-panel">
          <h3>Constituency Turnout</h3>
          <div className="constituency-list">
            {stats?.constituencyBreakdown?.map((c) => (
              <button
                key={c._id}
                className={`constituency-row ${selectedConstituency === c._id ? 'active' : ''}`}
                onClick={() => setSelectedConstituency(c._id)}
              >
                <div className="const-info">
                  <span className="const-name">{c.name}</span>
                  <span className="const-state">{c.state}</span>
                </div>
                <div className="const-stats">
                  <span className="const-voted">{c.totalVoted} / {c.totalRegistered}</span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, c.turnoutPercent)}%` }}
                    />
                  </div>
                  <span className="const-pct">{c.turnoutPercent?.toFixed(1)}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: vote counts for selected constituency */}
        <div className="dash-panel">
          <h3>Vote Counts — {selectedConstituency}</h3>
          {results.length === 0 ? (
            <p className="empty-state">No votes recorded yet for this constituency.</p>
          ) : (
            <div className="results-list">
              {[...results]
                .sort((a, b) => b.count - a.count)
                .map((r, i) => {
                  const pct = totalVotes > 0 ? ((r.count / totalVotes) * 100).toFixed(1) : 0;
                  return (
                    <div key={r.candidateID} className={`result-row ${i === 0 ? 'leading' : ''}`}>
                      <span className="result-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                      <span className="result-candidate">{r.candidateID}</span>
                      <div className="result-bar-wrap">
                        <div className="result-bar" style={{ width: `${pct}%` }} />
                        <span className="result-count">{r.count} votes ({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              <p className="total-votes">Total votes counted: {totalVotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction verifier */}
      <div className="verify-section">
        <h3>🔍 Verify a Vote Transaction</h3>
        <p>Enter a Transaction ID to verify it exists on the blockchain.</p>
        <div className="verify-input-row">
          <input
            type="text"
            placeholder="Enter Transaction ID..."
            value={txID}
            onChange={(e) => setTxID(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyTx()}
          />
          <button className="btn-primary" onClick={handleVerifyTx}>Verify</button>
        </div>
        {txError && <p className="tx-error">❌ {txError}</p>}
        {txResult && (
          <div className="tx-verified">
            <p>✅ Transaction verified on blockchain</p>
            <table className="tx-table">
              <tbody>
                <tr><td>Transaction ID</td><td>{txResult.transactionID}</td></tr>
                <tr><td>Constituency</td><td>{txResult.constituencyID}</td></tr>
                <tr><td>Timestamp</td><td>{new Date(txResult.timestamp).toLocaleString()}</td></tr>
                <tr><td>Status</td><td>{txResult.status}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Blockchain Explorer Proof */}
      <div className="dash-panel" style={{ marginTop: '2rem' }}>
        <h3>⛓️ Live Blockchain Ledger (Proof of Immutability)</h3>
        <p style={{ color: '#aaa', marginBottom: '1rem' }}>
          This is the raw cryptographically linked chain of blocks. Each vote is a new block containing a hash of the previous block, making tampering mathematically impossible.
        </p>
        
        <div className="blockchain-explorer" style={{ display: 'flex', overflowX: 'auto', gap: '1rem', paddingBottom: '1rem' }}>
          {chainData.map((block) => (
            <div key={block.hash} style={{ minWidth: '300px', backgroundColor: '#1a202c', border: '1px solid #4a5568', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2d3748', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <strong>Block #{block.index}</strong>
                <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>{new Date(block.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ fontSize: '0.8rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                <p style={{ color: '#ed8936' }}><strong>Hash:</strong><br/>{block.hash}</p>
                <p style={{ color: '#4299e1' }}><strong>Prev Hash:</strong><br/>{block.previousHash || 'Genesis (None)'}</p>
                <div style={{ marginTop: '0.5rem', backgroundColor: '#2d3748', padding: '0.5rem', borderRadius: '4px' }}>
                  <p><strong>Data Payload:</strong></p>
                  {block.index === 0 ? (
                    <p style={{ color: '#68d391' }}>{block.data.message}</p>
                  ) : (
                    <>
                      <p>Voter: ***{block.data.voterID.slice(-3)}</p>
                      <p>Constituency: {block.data.constituency}</p>
                      <p style={{ color: '#68d391' }}>Vote: [ENCRYPTED]</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
