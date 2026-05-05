import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';

function RegisterScreen() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    voterID: '',
    password: '',
    constituencyID: 'DL01',
    constituencyName: 'New Delhi'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const constituencies = [
    { id: 'DL01', name: 'New Delhi' },
    { id: 'UP04', name: 'Lucknow' },
    { id: 'MH02', name: 'Mumbai South' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'constituencyID') {
      const selected = constituencies.find(c => c.id === value);
      setFormData(prev => ({ ...prev, constituencyID: value, constituencyName: selected.name }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await register(formData);
      setSuccess('Registration successful! You can now login.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
        <h3>Migrant Voter Registration</h3>
        {error && <div className="error-box" style={{marginBottom: '1rem'}}><p>{error}</p></div>}
        {success && <div style={{backgroundColor: '#d4edda', color: '#155724', padding: '1rem', borderRadius: '4px', marginBottom: '1rem'}}><p>{success}</p></div>}
        
        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <div>
            <label style={{display: 'block', textAlign: 'left', marginBottom: '0.5rem'}}>Full Name</label>
            <input 
              type="text" 
              name="name"
              value={formData.name} 
              onChange={handleChange}
              placeholder="Enter your name"
              required
              style={{width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc'}}
            />
          </div>
          <div>
            <label style={{display: 'block', textAlign: 'left', marginBottom: '0.5rem'}}>Voter ID</label>
            <input 
              type="text" 
              name="voterID"
              value={formData.voterID} 
              onChange={handleChange}
              placeholder="e.g. ABC1234567"
              required
              style={{width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc'}}
            />
          </div>
          <div>
            <label style={{display: 'block', textAlign: 'left', marginBottom: '0.5rem'}}>Password</label>
            <input 
              type="password" 
              name="password"
              value={formData.password} 
              onChange={handleChange}
              placeholder="Create a password"
              required
              style={{width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc'}}
            />
          </div>
          <div>
            <label style={{display: 'block', textAlign: 'left', marginBottom: '0.5rem'}}>Select Home Constituency</label>
            <select 
              name="constituencyID"
              value={formData.constituencyID}
              onChange={handleChange}
              style={{width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc'}}
            >
              {constituencies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading} style={{marginTop: '1rem'}}>
            {loading ? 'Registering...' : 'Register as Migrant Voter'}
          </button>
        </form>
        
        <p style={{marginTop: '2rem'}}>
          Already registered? <Link to="/login" style={{color: '#0056b3'}}>Login Here</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterScreen;
