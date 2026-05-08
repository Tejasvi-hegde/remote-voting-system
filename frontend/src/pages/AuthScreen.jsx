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
  const [fingerprintId, setFingerprintId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated
  const [voter, setVoter] = useState(null);
  const [countdown, setCountdown] = useState(9);

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

      let count = 9;
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
    if (!fingerprintId) return setError('Please enter a Simulated Fingerprint ID first.');

    setError('');
    setLoading(true);

    try {
      await new Promise(r => setTimeout(r, 1000)); // Ux delay for realistic feel

      const { data: verifyResult } = await axios.post('http://localhost:5001/api/auth/verify', {
        fingerprintId,
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

        <div className="voter-card auth-card">
          <h3>Welcome, Voter!</h3>
          <p>Please enter your Simulated Fingerprint ID.</p>

          <form onSubmit={handleLogin} className="auth-form">
            <input
              type="number"
              className="auth-input"
              placeholder="Enter Fingerprint ID (e.g. 15)"
              value={fingerprintId}
              onChange={e => setFingerprintId(e.target.value)}
            />
            <button className="btn-primary auth-btn" type="submit" disabled={loading}>
              {loading ? 'Scanning...' : 'Simulate Hardware Fingerprint Scan'}
            </button>
          </form>

          {error && (
            <div className="error-box">
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
