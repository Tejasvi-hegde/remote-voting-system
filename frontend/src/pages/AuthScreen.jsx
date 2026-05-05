import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * AuthScreen
 * First screen the voter sees on the terminal.
 * We simulate the physical R307 fingerprint scanner so you can test
 * without Windows Hello getting in the way.
 */
function AuthScreen() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // If already authenticated
  const [voter, setVoter] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const token = sessionStorage.getItem('voting_token');
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        sessionStorage.clear();
        return;
      }
      setVoter({
        name: payload.name, 
        voterID: payload.voterID,
        constituency: payload.constituency, 
        expiresAt: new Date(payload.exp * 1000)
      });

      let count = 5;
      const timer = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count === 0) {
          clearInterval(timer);
          navigate('/ballot');
        }
      }, 1000);
      return () => clearInterval(timer);
    } catch {
      sessionStorage.clear();
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!voterID) return setError('Please enter your Voter ID first.');
    
    setError('');
    setLoading(true);

    // Simulate the hardware fingerprint ASCII string
    const simulatedAscii = `FP_TEMPLATE_V1\nridge:00110011\nridge:11001100\nminutiae:x=120,y=340,angle=45\nminutiae:x=200,y=180,angle=90\nminutiae:x=310,y=420,angle=135\ncore:x=215,y=300\nvoter:${voterID}`;

    try {
      await new Promise(r => setTimeout(r, 1000)); // Ux delay for realistic feel

      const { data: verifyResult } = await axios.post('http://localhost:5001/api/auth/verify', {
        voterID,
        fingerprintAscii: simulatedAscii,
        terminalID: 'RVC-1'
      });

      sessionStorage.setItem('voting_token', verifyResult.token);
      window.location.reload();
    } catch (err) {
      setError(`Authentication failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!voter) {
    return (
      <div className="screen auth-screen">
        <div className="ec-header">
          <span className="ec-logo">🗳️</span>
          <div>
            <h2>Election Commission of India</h2>
            <p className="terminal-id">Secure Voting Terminal</p>
          </div>
        </div>

        <div className="voter-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>Welcome, Voter!</h3>
          <p>Please enter your Voter ID to simulate scanning your fingerprint.</p>
          
          <form onSubmit={handleLogin} style={{ marginTop: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="Enter Voter ID (e.g. VTR099)" 
              value={voterID} 
              onChange={e => setVoterID(e.target.value.toUpperCase())}
              style={{ padding: '10px', fontSize: '1rem', width: '80%', marginBottom: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <br />
            <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '10px 20px', fontSize: '1.1rem' }}>
              {loading ? 'Scanning...' : 'Simulate Hardware Fingerprint Scan 👆'}
            </button>
          </form>

          {error && (
            <div className="error-box" style={{ marginTop: '1rem' }}>
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen auth-screen">
      <div className="ec-header">
        <span className="ec-logo">🗳️</span>
        <div>
          <h2>Election Commission of India</h2>
          <p className="terminal-id">Secure Voting Terminal</p>
        </div>
      </div>

      <div className="voter-card">
        <div className="verified-badge">✅ Identity Verified (Simulated Fingerprint)</div>
        <table className="voter-details">
          <tbody>
            <tr><td className="label">Name</td><td className="value">{voter.name}</td></tr>
            <tr><td className="label">Voter ID</td><td className="value">{voter.voterID}</td></tr>
            <tr><td className="label">Constituency</td><td className="value">{voter.constituency}</td></tr>
            <tr><td className="label">Session Valid Until</td><td className="value">{voter.expiresAt.toLocaleTimeString()}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="countdown-box">
        <p>Loading your ballot in <strong>{countdown}</strong> seconds...</p>
        <button className="btn-primary" onClick={() => navigate('/ballot')}>
          Proceed to Ballot Now →
        </button>
      </div>
    </div>
  );
}

export default AuthScreen;
