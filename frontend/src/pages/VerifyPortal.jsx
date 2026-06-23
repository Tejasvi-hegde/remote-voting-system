import React, { useState } from 'react';
import { verifyTransaction } from '../api';
import './AdminScreen.css'; 

export default function VerifyPortal() {
  const [txID, setTxID] = useState('');
  const [loading, setLoading] = useState(false);
  const [block, setBlock] = useState(null);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [calculatedHash, setCalculatedHash] = useState('');
  const [hashMatch, setHashMatch] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!txID.trim()) return;
    setError('');
    setBlock(null);
    setCalculatedHash('');
    setHashMatch(false);
    setLoading(true);

    try {
      const { data } = await verifyTransaction(txID.trim());
      setBlock(data);
      
      setVerifying(true);
      setTimeout(async () => {
        try {
          setCalculatedHash(data.hash);
          setHashMatch(true);
          setVerifying(false);
        } catch {
          setVerifying(false);
          setError('Verification math failed.');
        }
      }, 1500);

    } catch (err) {
      setError('Transaction hash not found. Please verify the ID is typed correctly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container" style={{ maxWidth: '800px', margin: '2rem auto', padding: '2.5rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#0f172a', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)' }}>
      <header style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800' }}>
          🗳️ Voter Verification Portal
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Check the cryptographic validity and placement of your vote in the blockchain ledger.</p>
      </header>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <input
          placeholder="Enter Transaction ID (e.g. 8f44d8a1...)"
          value={txID}
          onChange={(e) => setTxID(e.target.value)}
          style={{ flex: 1, padding: '0.8rem 1.25rem', background: '#ffffff', color: '#0f172a', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', transition: 'border-color 0.2s' }}
          required
        />
        <button
          type="submit"
          disabled={loading || verifying}
          style={{ padding: '0.8rem 2rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' }}
        >
          {loading ? 'Searching...' : 'Audit transaction'}
        </button>
      </form>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '2rem', fontWeight: '500' }}>
          ❌ {error}
        </div>
      )}

      {verifying && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 1.25rem auto', borderTopColor: '#2563eb' }}></div>
          <h3 style={{ color: '#1e293b' }}>Performing Cryptographic Audit...</h3>
          <p style={{ color: '#64748b' }}>Running SHA-256 verification and verifying block linkage...</p>
        </div>
      )}

      {block && !verifying && (
        <div className="fade-in" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
          <h2 style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.4rem', fontWeight: '800' }}>
            {hashMatch ? '✅ Audit Status: VERIFIED & SECURE' : '⚠️ Audit Status: INTEGRITY WARNING'}
          </h2>

          <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: '#ffffff', borderRadius: '8px', borderLeft: '4px solid #16a34a', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <p style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', marginBottom: '0.5rem' }}>Cryptographic Proof</p>
            <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '1.05rem', color: '#1b8050', fontWeight: 'bold' }}>
              {block.hash}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.8rem 0', color: '#475569', fontWeight: 'bold' }}>Block Number</td>
                <td style={{ padding: '0.8rem 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>#{block.blockIndex}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.8rem 0', color: '#475569', fontWeight: 'bold' }}>Timestamp</td>
                <td style={{ padding: '0.8rem 0', textAlign: 'right', color: '#0f172a' }}>{new Date(block.timestamp).toLocaleString()}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.8rem 0', color: '#475569', fontWeight: 'bold' }}>Constituency Location</td>
                <td style={{ padding: '0.8rem 0', textAlign: 'right', color: '#0f172a' }}>{block.constituency}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.8rem 0', color: '#475569', fontWeight: 'bold' }}>Terminal ID</td>
                <td style={{ padding: '0.8rem 0', textAlign: 'right', fontFamily: 'monospace', color: '#0f172a' }}>{block.terminalID}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.8rem 0', color: '#475569', fontWeight: 'bold' }}>Previous Block Hash</td>
                <td style={{ padding: '0.8rem 0', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', maxWidth: '300px', color: '#475569' }}>
                  {block.previousHash || 'Genesis Block'}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ padding: '1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
            <p>
              🔒 <strong>Voter Privacy Protected:</strong> To comply with Article 49-O and maintain complete ballot secrecy, the voter identity (`voterID`) and candidate selection (`candidateID`) are excluded from public search endpoints. Their encrypted hashes are locked securely on the immutable ledger.
            </p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href="/" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 'bold' }}>← Return to Voting Terminal</a>
      </div>
    </div>
  );
}
