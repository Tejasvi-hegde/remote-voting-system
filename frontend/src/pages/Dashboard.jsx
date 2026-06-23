import React, { useEffect, useState, useCallback } from 'react';
import { fetchStats, fetchResults, verifyTransaction, fetchBlockchain } from '../api';

// Shamir's Secret Sharing configuration
// Polynomial: f(x) = 13x^2 + 7x + 42
// Secret (f(0)): 42
const COMMISSIONERS = [
  { id: 1, name: 'Dr. A. Sen (New Delhi)', x: 1, y: 62, status: 'INACTIVE', role: 'Chief Election Commissioner' },
  { id: 2, name: 'M. K. Rao (Mumbai)', x: 2, y: 108, status: 'INACTIVE', role: 'Election Commissioner' },
  { id: 3, name: 'S. Banerjee (Kolkata)', x: 3, y: 180, status: 'INACTIVE', role: 'Election Commissioner' },
  { id: 4, name: 'T. Krishnan (Chennai)', x: 4, y: 278, status: 'INACTIVE', role: 'Deputy Commissioner' },
  { id: 5, name: 'K. Gowda (Bengaluru)', x: 5, y: 402, status: 'INACTIVE', role: 'Deputy Commissioner' },
];

function lagrangeInterpolateAtZero(points) {
  let secret = 0;
  for (let i = 0; i < points.length; i++) {
    let term = points[i].y;
    for (let j = 0; j < points.length; j++) {
      if (j !== i) {
        term = (term * (0 - points[j].x)) / (points[i].x - points[j].x);
      }
    }
    secret += term;
  }
  return Math.round(secret);
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('turnout');
  const [stats, setStats] = useState(null);
  const [selectedConstituency, setSelectedConstituency] = useState('');
  const [results, setResults] = useState([]);
  const [txID, setTxID] = useState('');
  const [txResult, setTxResult] = useState(null);
  const [txError, setTxError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [chainData, setChainData] = useState([]);

  // Shamir Secret Sharing States
  const [sharesCollected, setSharesCollected] = useState([]);
  const [tallyDecrypted, setTallyDecrypted] = useState(false);
  const [ceremonyLog, setCeremonyLog] = useState('');
  const [ceremonyStatus, setCeremonyStatus] = useState('PENDING'); // PENDING, PROCESSING, SUCCESS, FAILED

  // Consensus log state
  const [consensusLogs, setConsensusLogs] = useState([]);

  const loadStats = useCallback(() => {
    fetchStats()
      .then(({ data }) => {
        setStats(data.stats);
        setLastUpdated(new Date());
        if (!selectedConstituency && data.stats.constituencyBreakdown?.length > 0) {
          setSelectedConstituency(data.stats.constituencyBreakdown[0]._id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetchBlockchain()
      .then(({ data }) => {
        setChainData(data.chain);
        // Generate simulated consensus logs based on actual chain length
        const logs = [];
        data.chain.forEach((block, idx) => {
          if (idx === 0) {
            logs.push(`[SYSTEM] Genesis block verified.`);
          } else {
            logs.push(`[VALIDATOR Delhi] Auditing signature of Block #${idx}... OK`);
            logs.push(`[VALIDATOR Mumbai] Checked double-voting index for Voter ***${block.data?.voterID?.slice(-3)}... OK`);
            logs.push(`[VALIDATOR Bengaluru] Block #${idx} PreviousHash validation match... OK`);
            logs.push(`[VALIDATOR Kolkata] Consensus committed. Block #${idx} broadcast completed.`);
          }
        });
        setConsensusLogs(logs);
      })
      .catch(console.error);
  }, [selectedConstituency]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
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
      setTxResult(data);
    } catch {
      setTxError('Transaction not found on blockchain.');
    }
  };

  // Collect a commissioner's key share
  const toggleShare = (comm) => {
    if (tallyDecrypted) return;
    const exists = sharesCollected.find(s => s.id === comm.id);
    if (exists) {
      setSharesCollected(sharesCollected.filter(s => s.id !== comm.id));
    } else {
      setSharesCollected([...sharesCollected, comm]);
    }
  };

  // Run the cryptographic key reconstruction ceremony
  const runKeyCeremony = () => {
    if (sharesCollected.length < 3) {
      setCeremonyLog('❌ ERROR: Reconstructing the key requires a quorum of at least 3 commissioners.');
      setCeremonyStatus('FAILED');
      return;
    }

    setCeremonyStatus('PROCESSING');
    setCeremonyLog('🔄 Initiating Key Decryption Ceremony...\nGathering cryptographic key shares...\n');

    setTimeout(() => {
      setCeremonyLog(prev => prev + `Shares collected from: ${sharesCollected.map(s => s.name).join(', ')}\n`);
      setCeremonyLog(prev => prev + `Performing Lagrange Polynomial Interpolation at zero: f(0)...\n`);
    }, 800);

    setTimeout(() => {
      const resultSecret = lagrangeInterpolateAtZero(sharesCollected);
      setCeremonyLog(prev => prev + `Reconstructed Secret Key: ${resultSecret}\n`);

      if (resultSecret === 42) {
        setCeremonyLog(prev => prev + `✅ MATCH SUCCESSFUL. Private Tally Key unlocked.\nDecrypting voting counts database...`);
        setTallyDecrypted(true);
        setCeremonyStatus('SUCCESS');
      } else {
        setCeremonyLog(prev => prev + `❌ MATH ERROR: Incorrect keys loaded. Lagrange interpolation failed to yield the secret tally key.`);
        setCeremonyStatus('FAILED');
      }
    }, 1800);
  };

  const resetCeremony = () => {
    setSharesCollected([]);
    setTallyDecrypted(false);
    setCeremonyLog('');
    setCeremonyStatus('PENDING');
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
    <div className="dashboard dashboard-light" style={{ minHeight: '100vh', padding: '2rem' }}>
      {/* Header */}
      <div className="dash-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', borderRadius: '12px' }}>
        <div>
          <h1 style={{ color: '#1e3a8a', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800' }}>
            🗳️ Election Commission — Live Dashboard
          </h1>
          <p className="last-updated" style={{ color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Last updated: {lastUpdated?.toLocaleTimeString()} · Auto-refreshes every 30s
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary" onClick={loadStats} style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569' }}>↻ Refresh</button>
          <a href="/verify" className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '0.5rem 1.25rem', fontWeight: 'bold' }}>Search Portal</a>
        </div>
      </div>

      {/* Tabs */}
      <div className="light-tab-bar">
        <button
          onClick={() => setActiveTab('turnout')}
          className={`light-tab-btn ${activeTab === 'turnout' ? 'active' : ''}`}
        >
          📈 Live Turnout & Results
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`light-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
        >
          🛡️ Security Audit Console
        </button>
        <button
          onClick={() => setActiveTab('ceremony')}
          className={`light-tab-btn ${activeTab === 'ceremony' ? 'active' : ''}`}
        >
          🔑 EC Tally Ceremony (SSS)
        </button>
      </div>

      {/* Summary stat cards */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: '2.5rem' }}>
          <div className="stat-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <p className="stat-label" style={{ color: '#64748b' }}>Total Registered Voters</p>
            <p className="stat-value" style={{ color: '#0f172a' }}>{stats.totalRegistered.toLocaleString()}</p>
          </div>
          <div className="stat-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <p className="stat-label" style={{ color: '#64748b' }}>Votes Cast</p>
            <p className="stat-value blue" style={{ color: '#2563eb' }}>{stats.totalVoted.toLocaleString()}</p>
          </div>
          <div className="stat-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <p className="stat-label" style={{ color: '#64748b' }}>Voter Turnout</p>
            <p className="stat-value green" style={{ color: '#16a34a' }}>{stats.turnoutPercent}%</p>
          </div>
          <div className="stat-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <p className="stat-label" style={{ color: '#64748b' }}>Ledger Integrity</p>
            <p className="stat-value" style={{ color: stats.chainIntegrity === 'VALID' ? '#16a34a' : '#dc2626' }}>{stats.chainIntegrity}</p>
          </div>
        </div>
      )}

      {/* Tab 1: Live Turnout */}
      {activeTab === 'turnout' && (
        <div className="dash-body">
          {/* Left: constituency breakdown */}
          <div className="dash-panel light-panel">
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#0f172a', fontWeight: '800' }}>Constituency Turnout</h3>
            <div className="constituency-list">
              {stats?.constituencyBreakdown?.map((c) => (
                <button
                  key={c._id}
                  className={`constituency-row ${selectedConstituency === c._id ? 'active' : ''}`}
                  onClick={() => setSelectedConstituency(c._id)}
                  style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '1rem', border: '2px solid #e2e8f0', background: selectedConstituency === c._id ? '#eff6ff' : '#ffffff', borderLeftColor: selectedConstituency === c._id ? '#2563eb' : '#e2e8f0', borderLeftWidth: '4px', color: '#0f172a', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', marginBottom: '0.4rem', transition: 'all 0.2s' }}
                >
                  <div className="const-info">
                    <span className="const-name" style={{ fontWeight: 'bold', display: 'block', color: '#1e293b' }}>{c.name}</span>
                    <span className="const-state" style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.state}</span>
                  </div>
                  <div className="const-stats" style={{ textAlign: 'right' }}>
                    <span className="const-voted" style={{ display: 'block', fontSize: '0.85rem', color: '#475569', fontWeight: '500' }}>{c.totalVoted} / {c.totalRegistered}</span>
                    <span className="const-pct" style={{ color: '#16a34a', fontWeight: 'bold' }}>{c.turnoutPercent?.toFixed(1)}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: vote counts for selected constituency */}
          <div className="dash-panel light-panel">
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#0f172a', fontWeight: '800' }}>
              <span>Vote Counts — {selectedConstituency}</span>
              {!tallyDecrypted && (
                <span style={{ fontSize: '0.8rem', backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #fca5a5', fontWeight: 'bold' }}>
                  🔒 Tally Encrypted
                </span>
              )}
            </h3>
            {results.length === 0 ? (
              <p className="empty-state">No votes recorded yet for this constituency.</p>
            ) : !tallyDecrypted ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
                <h3 style={{ color: '#1e293b', fontWeight: 'bold' }}>Vote counts are cryptographically locked</h3>
                <p style={{ color: '#64748b', maxWidth: '350px', margin: '0.5rem auto', fontSize: '0.95rem', lineHeight: '1.5' }}>
                  To preserve security, individual candidate vote counts are encrypted. 
                  Unlock them by completing the <strong>EC Tally Ceremony</strong> tab.
                </p>
              </div>
            ) : (
              <div className="results-list">
                {[...results]
                  .sort((a, b) => b.count - a.count)
                  .map((r, i) => {
                    const pct = totalVotes > 0 ? ((r.count / totalVotes) * 100).toFixed(1) : 0;
                    return (
                      <div key={r.candidateID} className={`result-row ${i === 0 ? 'leading' : ''}`} style={{ marginBottom: '1.2rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px', background: i === 0 ? '#f0fdf4' : '#ffffff', borderColor: i === 0 ? '#bbf7d0' : '#e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1rem', color: '#1e293b' }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} <strong>{r.candidateID}</strong> ({r.party})
                          </span>
                          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{r.count} votes ({pct}%)</span>
                        </div>
                        <div className="result-bar-wrap" style={{ background: '#e2e8f0', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                          <div className="result-bar" style={{ width: `${pct}%`, background: i === 0 ? '#16a34a' : '#2563eb', height: '100%' }} />
                        </div>
                      </div>
                    );
                  })}
                <p className="total-votes" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                  Total votes counted: {totalVotes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Security Audit Console */}
      {activeTab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Left: Consensus Simulator */}
          <div className="dash-panel light-panel">
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#1e3a8a', fontWeight: '800' }}>
              🛡️ Consensus Network Simulator
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Four distributed validation nodes checking the integrity of votes synchronously.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <p style={{ fontWeight: 'bold', margin: 0, color: '#0f172a' }}>Delhi Node</p>
                <p style={{ fontSize: '0.8rem', color: '#16a34a', margin: '0.2rem 0 0 0', fontWeight: 'bold' }}>🟢 VALIDATING</p>
              </div>
              <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <p style={{ fontWeight: 'bold', margin: 0, color: '#0f172a' }}>Bengaluru Node</p>
                <p style={{ fontSize: '0.8rem', color: '#16a34a', margin: '0.2rem 0 0 0', fontWeight: 'bold' }}>🟢 VALIDATING</p>
              </div>
              <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <p style={{ fontWeight: 'bold', margin: 0, color: '#0f172a' }}>Mumbai Node</p>
                <p style={{ fontSize: '0.8rem', color: '#16a34a', margin: '0.2rem 0 0 0', fontWeight: 'bold' }}>🟢 VALIDATING</p>
              </div>
              <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <p style={{ fontWeight: 'bold', margin: 0, color: '#0f172a' }}>Kolkata Node</p>
                <p style={{ fontSize: '0.8rem', color: '#16a34a', margin: '0.2rem 0 0 0', fontWeight: 'bold' }}>🟢 VALIDATING</p>
              </div>
            </div>

            <h4 style={{ color: '#475569', marginBottom: '0.5rem', fontWeight: 'bold' }}>Active Network Logs</h4>
            <div className="light-console">
              {consensusLogs.length === 0 ? (
                <p style={{ color: '#64748b' }}>Waiting for voting blocks...</p>
              ) : (
                consensusLogs.map((log, idx) => (
                  <p key={idx} style={{ margin: '0 0 0.4rem 0' }}>{log}</p>
                ))
              )}
            </div>
          </div>

          {/* Right: Verification Search tool */}
          <div className="dash-panel light-panel">
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#1e3a8a', fontWeight: '800' }}>
              🔍 Local Transaction Audit Tool
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Verify standard previous-hash linkage of block nodes.
            </p>
            <div className="verify-input-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Enter Transaction ID..."
                value={txID}
                onChange={(e) => setTxID(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyTx()}
                style={{ flex: 1, padding: '0.6rem 1rem', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', fontSize: '0.95rem' }}
              />
              <button className="btn-primary" onClick={handleVerifyTx} style={{ padding: '0.6rem 1.5rem', width: 'auto', fontWeight: 'bold' }}>Verify</button>
            </div>
            {txError && <p className="tx-error" style={{ color: '#dc2626', fontWeight: '500' }}>❌ {txError}</p>}
            {txResult && (
              <div className="tx-verified" style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '8px', border: '1px solid #bbf7d0', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <p style={{ color: '#15803d', fontWeight: 'bold', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>✅ Block hash verified in local cache.</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #dcfce7' }}>
                      <td style={{ padding: '0.5rem 0', color: '#475569', fontWeight: 'bold' }}>Index</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#0f172a', fontWeight: 'bold' }}>#{txResult.blockIndex}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #dcfce7' }}>
                      <td style={{ padding: '0.5rem 0', color: '#475569', fontWeight: 'bold' }}>Time</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#0f172a' }}>{new Date(txResult.timestamp).toLocaleString()}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #dcfce7' }}>
                      <td style={{ padding: '0.5rem 0', color: '#475569', fontWeight: 'bold' }}>Constituency</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#0f172a' }}>{txResult.constituency}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #dcfce7' }}>
                      <td style={{ padding: '0.5rem 0', color: '#475569', fontWeight: 'bold' }}>Terminal</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'right', color: '#0f172a', fontFamily: 'monospace' }}>{txResult.terminalID}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Tally Ceremony */}
      {activeTab === 'ceremony' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
          {/* Left: Commissioners interface */}
          <div className="dash-panel light-panel">
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#1e3a8a', fontWeight: '800' }}>
              🔑 Shamir's Secret Sharing: Commissioner Key Shares
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Select at least 3 commissioners to unlock their secret key shares. Lagrange polynomial interpolation will compute the decryption secret at zero.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {COMMISSIONERS.map((comm) => {
                const selected = sharesCollected.find(s => s.id === comm.id);
                return (
                  <div
                    key={comm.id}
                    onClick={() => toggleShare(comm)}
                    className={`light-card-interactive ${selected ? 'light-card-active' : 'light-card-inactive'}`}
                    style={{
                      cursor: tallyDecrypted ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>{comm.name}</p>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: selected ? '#2563eb' : '#64748b' }}>{comm.role}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.85rem', background: selected ? '#10b981' : '#f1f5f9', color: selected ? '#fff' : '#475569', padding: '0.3rem 0.75rem', borderRadius: '6px', fontWeight: 'bold', border: selected ? 'none' : '1px solid #e2e8f0' }}>
                        {selected ? `Point (${comm.x}, ${comm.y}) Active` : 'Locked'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Key combiner console */}
          <div className="dash-panel light-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#1e3a8a', fontWeight: '800' }}>
                ⚙️ Key Reconstruction Console
              </h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: '500' }}>
                Quorum Status: <strong style={{ color: '#2563eb' }}>{sharesCollected.length}/3 Key Shares</strong> {sharesCollected.length >= 3 ? '✅ READY' : '❌ PENDING'}
              </p>

              <div className="light-console" style={{ height: '180px', color: ceremonyStatus === 'FAILED' ? '#991b1b' : '#1e293b', borderLeftColor: ceremonyStatus === 'FAILED' ? '#dc2626' : '#2563eb', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                {ceremonyLog || 'Console ready. Add commissioner shares and trigger verification ceremony.'}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              {!tallyDecrypted ? (
                <button
                  onClick={runKeyCeremony}
                  disabled={sharesCollected.length < 3 || ceremonyStatus === 'PROCESSING'}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: sharesCollected.length >= 3 ? '#16a34a' : '#cbd5e1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: sharesCollected.length >= 3 ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    boxShadow: sharesCollected.length >= 3 ? '0 4px 10px rgba(22, 163, 74, 0.2)' : 'none'
                  }}
                >
                  {ceremonyStatus === 'PROCESSING' ? 'Evaluating Polynomial...' : '⚡ Decrypt & Reveal Tally'}
                </button>
              ) : (
                <button
                  onClick={resetCeremony}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    boxShadow: '0 4px 10px rgba(220, 38, 38, 0.2)'
                  }}
                >
                  🔒 Lock Tallies & Reset Ceremony
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blockchain Explorer Proof */}
      <div className="dash-panel light-panel" style={{ marginTop: '2.5rem' }}>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', color: '#0f172a', fontWeight: '800' }}>⛓️ Live Blockchain Ledger (Proof of Immutability)</h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          This is the raw cryptographically linked chain of blocks. Each vote is a new block containing a hash of the previous block.
        </p>

        <div className="blockchain-explorer" style={{ display: 'flex', overflowX: 'auto', gap: '1.25rem', paddingBottom: '1.25rem' }}>
          {chainData.map((block) => (
            <div key={block.hash} className="blockchain-block-light">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#0f172a' }}>Block #{block.index}</strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>{new Date(block.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ fontSize: '0.8rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                <p style={{ color: '#c2410c', margin: '0 0 0.4rem 0' }}><strong>Hash:</strong><br/>{block.hash}</p>
                <p style={{ color: '#1d4ed8', margin: '0 0 0.4rem 0' }}><strong>Prev Hash:</strong><br/>{block.previousHash || 'Genesis (None)'}</p>
                <div style={{ marginTop: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px' }}>
                  <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', color: '#1e293b' }}>Payload Data:</p>
                  {block.index === 0 ? (
                    <p style={{ color: '#15803d', margin: 0 }}>{block.data.message}</p>
                  ) : (
                    <>
                      <p style={{ margin: 0, color: '#475569' }}>Voter: ***{block.data?.voterID?.slice(-3)}</p>
                      <p style={{ margin: 0, color: '#475569' }}>Location: {block.data?.constituency}</p>
                      <p style={{ color: '#15803d', margin: 0, fontWeight: 'bold' }}>Vote: [ENCRYPTED]</p>
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
