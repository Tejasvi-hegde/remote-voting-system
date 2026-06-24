import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './AdminScreen.css';

const API_BASE = 'http://localhost:5001/api/admin';

export default function AdminScreen() {
  const [voters, setVoters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [activeTab, setActiveTab] = useState('voters');
  const [message, setMessage] = useState('');

  const [lookupVoterID, setLookupVoterID] = useState('');
  const [foundVoter, setFoundVoter] = useState(null);
  
  // Camera & Face Registration States
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [piIpAddress, setPiIpAddress] = useState(() => localStorage.getItem('pi_ip_address') || '192.168.1.100');

  useEffect(() => {
    localStorage.setItem('pi_ip_address', piIpAddress);
  }, [piIpAddress]);

  const [candidateForm, setCandidateForm] = useState({ 
    name: '', 
    party: '', 
    symbol: '', 
    constituency: '',
    voterID: ''
  });

  useEffect(() => {
    fetchVoters();
    fetchCandidates();
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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
    setCapturedImage(null);
    stopCamera();

    const formattedVoterID = lookupVoterID.trim().toUpperCase();
    const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
    if (!epicRegex.test(formattedVoterID)) {
      setMessage('Error: Invalid voter ID format. Must be 3 letters followed by 7 digits (e.g. ABC1234567).');
      return;
    }

    try {
      const res = await axios.get(`${API_BASE}/voter/lookup/${formattedVoterID}`);
      setFoundVoter(res.data);
      setMessage('Voter found! Register their face biometrics below.');
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const captureFromPi = async () => {
    setMessage('Connecting to Raspberry Pi camera...');
    setCapturedImage(null);
    try {
      const cleanIp = piIpAddress.replace(/^(http:\/\/|https:\/\/)/, '').trim();
      const res = await axios.get(`http://${cleanIp}:5002/capture`, { timeout: 10000 });
      if (res.data && res.data.success && res.data.faceImage) {
        setCapturedImage(res.data.faceImage);
        setMessage('Successfully captured photo from Raspberry Pi webcam!');
      } else {
        setMessage(`Error capturing from Pi: ${res.data?.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage(`Failed to connect to Pi Camera Server at http://${piIpAddress}:5002. Please ensure the camera server is running on the Raspberry Pi and the IP address is correct.`);
    }
  };

  // Camera Handlers
  const startCamera = async () => {
    setMessage('');
    setCapturedImage(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setMessage(`Error accessing camera: ${err.message}. Please use the manual file upload option below.`);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage('Error: File size too large (max 2MB).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaceSubmit = async (e) => {
    e.preventDefault();
    if (!foundVoter || !capturedImage) return;

    setMessage('Processing and registering face biometrics...');
    try {
      await axios.post(`${API_BASE}/voter/register-face`, {
        voterID: foundVoter.voter_id,
        faceImage: capturedImage
      });

      setMessage(`Face biometrics registered successfully for voter ${foundVoter.name}!`);
      setFoundVoter(null);
      setLookupVoterID('');
      setCapturedImage(null);
      fetchVoters();
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleCandidateSubmit = async (e) => {
    e.preventDefault();
    const formattedVoterID = candidateForm.voterID.trim().toUpperCase();
    const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
    if (!epicRegex.test(formattedVoterID)) {
      setMessage('Error: Invalid candidate voter ID format. Must be 3 letters followed by 7 digits (e.g. ABC1234567).');
      return;
    }

    try {
      await axios.post(`${API_BASE}/candidate`, {
        ...candidateForm,
        voterID: formattedVoterID
      });
      setMessage('Candidate added successfully!');
      setCandidateForm({ name: '', party: '', symbol: '', constituency: '', voterID: '' });
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
            <h2>Register Face for Remote Voting</h2>
            <p className="section-desc">Look up an existing voter by their Voter ID card (EPIC number) to capture and link their face biometrics.</p>
            
            <form onSubmit={handleLookup} className="admin-form lookup-form">
              <input 
                placeholder="Enter Voter ID (e.g. IND0000001)" 
                value={lookupVoterID} 
                onChange={e => setLookupVoterID(e.target.value)} 
                required 
              />
              <button type="submit">Lookup Voter</button>
            </form>

            {foundVoter && (
              <div className="voter-preview">
                <h3>Voter Details Found</h3>
                <div className="voter-preview-details">
                  <p><strong>Name:</strong> {foundVoter.name}</p>
                  <p><strong>DOB:</strong> {foundVoter.dob}</p>
                  <p><strong>Address:</strong> {foundVoter.address}</p>
                  <p><strong>Constituency:</strong> {foundVoter.constituency}</p>
                  <p><strong>Biometrics Status:</strong> {foundVoter.has_face ? '✅ Face Registered (re-submitting will update it)' : '❌ Face Not Registered'}</p>
                </div>

                <div className="biometric-capture-section">
                  <h4>Capture Face Biometrics</h4>

                  <div className="pi-capture-config" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', margin: '1rem 0', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0' }}>📷 Remote Capture from Raspberry Pi</h5>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input 
                        type="text" 
                        placeholder="Raspberry Pi IP (e.g. 192.168.1.45)" 
                        value={piIpAddress} 
                        onChange={e => setPiIpAddress(e.target.value)} 
                        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', minWidth: '220px', flexGrow: 1, color: '#333' }}
                      />
                      <button 
                        type="button" 
                        className="btn-success" 
                        onClick={captureFromPi}
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Capture from Pi
                      </button>
                    </div>
                  </div>
                  
                  <div className="capture-modes" style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
                    {!cameraActive ? (
                      <button type="button" className="btn-primary" onClick={startCamera}>
                        📷 Use Laptop Webcam
                      </button>
                    ) : (
                      <button type="button" className="btn-danger" onClick={stopCamera}>
                        🛑 Stop Laptop Camera
                      </button>
                    )}
                    
                    <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                      📁 Upload Photo
                      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                  </div>

                  {/* Camera view */}
                  {cameraActive && (
                    <div className="camera-view-container" style={{ margin: '1rem 0', position: 'relative' }}>
                      <video ref={videoRef} style={{ width: '100%', maxWidth: '480px', borderRadius: '8px', border: '2px solid #ccc' }} />
                      <button type="button" className="btn-success" onClick={capturePhoto} style={{ display: 'block', marginTop: '0.5rem' }}>
                        📸 Capture Photo
                      </button>
                    </div>
                  )}

                  {/* Hidden canvas for taking frames */}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {/* Photo Preview */}
                  {capturedImage && (
                    <div className="image-preview-container" style={{ margin: '1rem 0' }}>
                      <h5>Face Snapshot Preview</h5>
                      <img src={capturedImage} alt="Captured face" style={{ width: '100%', maxWidth: '240px', borderRadius: '8px', border: '3px solid #22c55e' }} />
                    </div>
                  )}

                  {capturedImage && (
                    <form onSubmit={handleFaceSubmit} className="register-form" style={{ marginTop: '1.5rem' }}>
                      <button type="submit" className="btn-success btn-large">
                        🔗 Register & Link Face with Voter ID
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            <h2>Registered Voters ({voters.length})</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Voter ID</th>
                  <th>Name</th>
                  <th>Constituency</th>
                  <th>Face Registered</th>
                  <th>Has Voted</th>
                </tr>
              </thead>
              <tbody>
                {voters.map(v => (
                  <tr key={v.voter_id}>
                    <td>{v.voter_id}</td>
                    <td>{v.name}</td>
                    <td>{v.constituency}</td>
                    <td>{v.has_face ? '✅ Yes' : '❌ No'}</td>
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
              <input 
                placeholder="Candidate Voter ID (e.g. IND0000001)" 
                value={candidateForm.voterID} 
                onChange={e => setCandidateForm({...candidateForm, voterID: e.target.value.toUpperCase()})} 
                required 
              />
              <input 
                placeholder="Candidate Name" 
                value={candidateForm.name} 
                onChange={e => setCandidateForm({...candidateForm, name: e.target.value})} 
                required 
              />
              <input 
                placeholder="Party" 
                value={candidateForm.party} 
                onChange={e => setCandidateForm({...candidateForm, party: e.target.value})} 
                required 
              />
              <input 
                placeholder="Symbol" 
                value={candidateForm.symbol} 
                onChange={e => setCandidateForm({...candidateForm, symbol: e.target.value})} 
              />
              <input 
                placeholder="Constituency" 
                value={candidateForm.constituency} 
                onChange={e => setCandidateForm({...candidateForm, constituency: e.target.value})} 
                required 
              />
              <button type="submit">Add Candidate</button>
            </form>

            <h2>Registered Candidates ({candidates.length})</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Voter ID</th>
                  <th>Name</th>
                  <th>Party</th>
                  <th>Symbol</th>
                  <th>Constituency</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.id}>
                    <td>{c.voter_id}</td>
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
