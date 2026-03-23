import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AuthScreen
 * First screen the voter sees on the terminal.
 * If a token was passed via URL (from Pi), we decode it and show
 * the voter's identity — then auto-redirect to the ballot.
 * If no token, show an error (terminal was opened manually).
 */
function AuthScreen() {
  const navigate = useNavigate();
  const [voter, setVoter] = useState(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const token = sessionStorage.getItem('voting_token');
    if (!token) {
      setError('No authentication token found. Please use the fingerprint scanner to begin.');
      return;
    }

    // Decode JWT payload (no verification — server already verified it)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // Check expiry
      if (payload.exp * 1000 < Date.now()) {
        setError('Session expired. Please scan your fingerprint again.');
        sessionStorage.clear();
        return;
      }

      setVoter({
        name: payload.voterName,
        voterID: payload.voterID,
        constituency: payload.constituencyName,
        expiresAt: new Date(payload.exp * 1000)
      });

      // Auto-redirect to ballot after 5 seconds
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
      setError('Invalid session. Please re-authenticate at the scanner.');
      sessionStorage.clear();
    }
  }, [navigate]);

  if (error) {
    return (
      <div className="screen error-screen">
        <div className="ec-logo">🗳️</div>
        <h1>Authentication Required</h1>
        <div className="error-box">
          <p>{error}</p>
        </div>
        <p className="hint">Please place your finger on the biometric scanner at this terminal.</p>
      </div>
    );
  }

  if (!voter) {
    return (
      <div className="screen loading-screen">
        <div className="spinner" />
        <p>Verifying identity...</p>
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
        <div className="verified-badge">✅ Identity Verified</div>
        <table className="voter-details">
          <tbody>
            <tr>
              <td className="label">Name</td>
              <td className="value">{voter.name}</td>
            </tr>
            <tr>
              <td className="label">Voter ID</td>
              <td className="value">{voter.voterID}</td>
            </tr>
            <tr>
              <td className="label">Constituency</td>
              <td className="value">{voter.constituency}</td>
            </tr>
            <tr>
              <td className="label">Session Valid Until</td>
              <td className="value">{voter.expiresAt.toLocaleTimeString()}</td>
            </tr>
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
