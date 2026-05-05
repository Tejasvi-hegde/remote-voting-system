import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api';

function LoginScreen() {
  const navigate = useNavigate();
  const [voterID, setVoterID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(voterID, password);
      sessionStorage.setItem('voting_token', response.data.token);
      navigate('/ballot');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen auth-screen">
      <div className="ec-header">
        <span className="ec-logo">🗳️</span>
        <div>
          <h2>Election Commission of India</h2>
          <p className="terminal-id">Remote Voting System - Mock Drill</p>
        </div>
      </div>

      <div className="voter-card">
        <h3>Voter Login</h3>
        {error && <div className="error-box" style={{marginBottom: '1rem'}}><p>{error}</p></div>}
        
        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <div>
            <label style={{display: 'block', textAlign: 'left', marginBottom: '0.5rem'}}>Voter ID</label>
            <input 
              type="text" 
              value={voterID} 
              onChange={(e) => setVoterID(e.target.value)}
              placeholder="e.g. ABC1234567"
              required
              style={{width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc'}}
            />
          </div>
          <div>
            <label style={{display: 'block', textAlign: 'left', marginBottom: '0.5rem'}}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc'}}
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading} style={{marginTop: '1rem'}}>
            {loading ? 'Authenticating...' : 'Login & Proceed to Ballot'}
          </button>
        </form>
        
        <p style={{marginTop: '2rem'}}>
          New migrant voter? <Link to="/register" style={{color: '#0056b3'}}>Register Here</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginScreen;
