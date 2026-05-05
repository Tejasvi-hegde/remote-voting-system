import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminScreen.css';

const API_BASE = 'http://localhost:5001/api/admin';

export default function AdminScreen() {
  const [voters, setVoters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [activeTab, setActiveTab] = useState('voters');
  const [message, setMessage] = useState('');

  const [voterForm, setVoterForm] = useState({ voterID: '', name: '', dob: '', address: '', constituency: '' });
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

  const handleVoterSubmit = async (e) => {
    e.preventDefault();
    setMessage('Simulating hardware fingerprint scanner capture...');
    
    // Simulate R307 fingerprint sensor ASCII output
    const simulatedAscii = `FP_TEMPLATE_V1\nridge:00110011\nridge:11001100\nminutiae:x=120,y=340,angle=45\nminutiae:x=200,y=180,angle=90\nminutiae:x=310,y=420,angle=135\ncore:x=215,y=300\nvoter:${voterForm.voterID}`;

    try {
      await new Promise(r => setTimeout(r, 1000)); // artificial delay for UX

      await axios.post(`${API_BASE}/voter`, {
        ...voterForm,
        fingerprintAscii: simulatedAscii
      });

      setMessage('Voter added successfully! Fingerprint template simulated and saved.');
      setVoterForm({ voterID: '', name: '', dob: '', address: '', constituency: '' });
      fetchVoters();
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
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
          <div className="admin-section">
            <h2>Add New Voter (Simulated R307 Fingerprint)</h2>
            <form onSubmit={handleVoterSubmit} className="admin-form">
              <input placeholder="Voter ID (e.g. VTR099)" value={voterForm.voterID} onChange={e => setVoterForm({...voterForm, voterID: e.target.value})} required />
              <input placeholder="Full Name" value={voterForm.name} onChange={e => setVoterForm({...voterForm, name: e.target.value})} required />
              <input placeholder="DOB (YYYY-MM-DD)" type="date" value={voterForm.dob} onChange={e => setVoterForm({...voterForm, dob: e.target.value})} />
              <input placeholder="Address" value={voterForm.address} onChange={e => setVoterForm({...voterForm, address: e.target.value})} />
              <input placeholder="Constituency" value={voterForm.constituency} onChange={e => setVoterForm({...voterForm, constituency: e.target.value})} required />
              <button type="submit" style={{ backgroundColor: '#28a745' }}>Simulate Fingerprint Scan & Save</button>
            </form>

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
