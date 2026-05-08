import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminScreen.css';

const API_BASE = 'http://localhost:5001/api/admin';

export default function AdminScreen() {
  const [voters, setVoters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [activeTab, setActiveTab] = useState('voters');
  const [message, setMessage] = useState('');
  const [piUrl, setPiUrl] = useState('http://192.168.1.100:5000');

  const [lookupVoterID, setLookupVoterID] = useState('');
  const [foundVoter, setFoundVoter] = useState(null);
  const [candidateForm, setCandidateForm] = useState({ name: '', party: '', symbol: '', constituency: '' });

  useEffect(() => {
    fetchVoters();
    fetchCandidates();
  }, []);

  const fetchVoters = async () => {
    try {
      const res = await axios.get(`${API_BASE}/voters`);
      setVoters(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/candidates`);
      setCandidates(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setMessage('Looking up voter...');
    setFoundVoter(null);
    try {
      const res = await axios.get(`${API_BASE}/voter/lookup/${lookupVoterID}`);
      setFoundVoter(res.data);
      setMessage('Voter found! Verify details below.');
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleVoterSubmit = async (e) => {
    e.preventDefault();
    if (!foundVoter) return;

    setMessage('Simulating hardware fingerprint scanner (generating unique ID 1-1000)...');
    
    try {
      // Simulate hardware delay
      await new Promise(r => setTimeout(r, 2000));
      
      const fingerprintId = Math.floor(Math.random() * 1000) + 1;
      
      if (!fingerprintId) {
         throw new Error('Simulation failed to generate a valid fingerprintId');
      }

      setMessage(`Simulated fingerprint scanned (ID: ${fingerprintId}). Linking to voter...`);

      await axios.post(`${API_BASE}/voter/register-migrant`, {
        voterID: foundVoter.voter_id,
        fingerprintId: fingerprintId
      });

      setMessage(`Migrant voter registered successfully! Fingerprint linked at ID: ${fingerprintId}`);
      setFoundVoter(null);
      setLookupVoterID('');
      fetchVoters();
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setMessage(`Error: Could not reach Raspberry Pi at ${piUrl}. Is the Python server running?`);
      } else {
        setMessage(`Error: ${err.response?.data?.error || err.message}`);
      }
    }
  };

  const handleCandidateSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/candidate`, candidateForm);
      setMessage('Candidate added successfully!');
      setCandidateForm({ name: '', party: '', symbol: '', constituency: '' });
      fetchCandidates();
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Election Commission Admin Panel</h1>
      </header>

      <div className="admin-tabs">
        <button className={activeTab === 'voters' ? 'active' : ''} onClick={() => setActiveTab('voters')}>Manage Voters</button>
        <button className={activeTab === 'candidates' ? 'active' : ''} onClick={() => setActiveTab('candidates')}>Manage Candidates</button>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div className="admin-content">
        {activeTab === 'voters' && (
          <div className="admin-section fade-in">
            <div className="pi-config">
              <h3>Hardware Configuration (Simulated)</h3>
              <p>Hardware biometric scanner is currently bypassed. A unique fingerprint ID (1-1000) will be simulated automatically.</p>
            </div>

            <h2>Register Migrant Voter</h2>
            <p className="section-desc">Look up an existing voter in the national database to register their biometrics for remote voting.</p>
            <form onSubmit={handleLookup} className="admin-form lookup-form">
              <input 
                placeholder="Enter Voter ID (e.g. VTR001)" 
                value={lookupVoterID} 
                onChange={e => setLookupVoterID(e.target.value)} 
                required 
              />
              <button type="submit">Lookup Voter</button>
            </form>

            {foundVoter && (
              <div className="voter-preview">
                <h3>Voter Details Verified</h3>
                <div className="voter-preview-details">
                  <p><strong>Name:</strong> {foundVoter.name}</p>
                  <p><strong>DOB:</strong> {foundVoter.dob}</p>
                  <p><strong>Address:</strong> {foundVoter.address}</p>
                  <p><strong>Constituency:</strong> {foundVoter.constituency}</p>
                  <p><strong>Status:</strong> {foundVoter.fingerprint_template ? 'Already registered for biometrics' : 'No biometrics linked yet'}</p>
                </div>
                <form onSubmit={handleVoterSubmit} className="register-form">
                  <button type="submit" className="btn-success">
                    Trigger Hardware Scanner & Register as Migrant
                  </button>
                </form>
              </div>
            )}

            <h2>Registered Voters ({voters.length})</h2>
            <table className="admin-table">
              <thead><tr><th>ID</th><th>Name</th><th>Constituency</th><th>Has Voted</th></tr></thead>
              <tbody>
                {voters.map(v => (
                  <tr key={v.voter_id}>
                    <td>{v.voter_id}</td>
                    <td>{v.name}</td>
                    <td>{v.constituency}</td>
                    <td>{v.has_voted ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'candidates' && (
          <div className="admin-section">
            <h2>Add New Candidate</h2>
            <form onSubmit={handleCandidateSubmit} className="admin-form">
              <input placeholder="Candidate Name" value={candidateForm.name} onChange={e => setCandidateForm({...candidateForm, name: e.target.value})} required />
              <input placeholder="Party" value={candidateForm.party} onChange={e => setCandidateForm({...candidateForm, party: e.target.value})} required />
              <input placeholder="Symbol" value={candidateForm.symbol} onChange={e => setCandidateForm({...candidateForm, symbol: e.target.value})} />
              <input placeholder="Constituency" value={candidateForm.constituency} onChange={e => setCandidateForm({...candidateForm, constituency: e.target.value})} required />
              <button type="submit">Add Candidate</button>
            </form>

            <h2>Registered Candidates ({candidates.length})</h2>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Party</th><th>Symbol</th><th>Constituency</th></tr></thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.party}</td>
                    <td>{c.symbol}</td>
                    <td>{c.constituency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
