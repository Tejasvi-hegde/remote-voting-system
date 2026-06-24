import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from '../utils/languages';

/**
 * AuthScreen
 * First screen the voter sees on the terminal.
 * Supports:
 * 1. Face Verification via Raspberry Pi Camera + EVM terminal showcase.
 * 2. Simulated fingerprint scan using R307 sensor template IDs.
 */
function AuthScreen() {
  const navigate = useNavigate();
  const { t, lang, changeLanguage } = useTranslation();
  const [fingerprintId, setFingerprintId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pi Verification State
  const [piIp, setPiIp] = useState(() => localStorage.getItem('pi_ip_address') || '192.168.1.100');
  const [piVerifying, setPiVerifying] = useState(false);
  const [piSuccessVoter, setPiSuccessVoter] = useState(null);

  // If already authenticated via local fingerprint
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
    if (!fingerprintId) return setError(t('err_fp'));

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

  const handlePiFaceVerify = async (e) => {
    e.preventDefault();
    setError('');
    setPiVerifying(true);
    localStorage.setItem('pi_ip_address', piIp);

    try {
      const { data } = await axios.post('http://localhost:5001/api/auth/verify-face-pi', {
        piIp: piIp.trim()
      });
      if (data.success) {
        setPiSuccessVoter({
          name: data.name,
          voterID: data.voterID,
          constituency: data.constituency
        });
      } else {
        setError(data.error || 'Verification failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || `Failed to connect/verify: ${err.message}`);
    } finally {
      setPiVerifying(false);
    }
  };

  const renderHeader = () => (
    <div className="ec-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className="ec-logo">🗳️</span>
        <div>
          <h2>{t('eci')}</h2>
          <p className="terminal-id">{t('terminal_title')}</p>
        </div>
      </div>
      <div className="lang-switcher">
        <select value={lang} onChange={(e) => changeLanguage(e.target.value)} className="lang-select">
          <option value="en">English (EN)</option>
          <option value="hi">हिन्दी (HI)</option>
          <option value="kn">ಕನ್ನಡ (KN)</option>
        </select>
      </div>
    </div>
  );

  // If verified via Pi, show Pi instructions screen
  if (piSuccessVoter) {
    return (
      <div className="screen auth-screen">
        {renderHeader()}
        <div className="voter-card auth-card" style={{ textAlign: 'center', padding: '2.5rem', maxWidth: '600px', margin: '2rem auto' }}>
          <div className="verified-badge" style={{ fontSize: '1.25rem', padding: '0.6rem 1.25rem', marginBottom: '1.5rem', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '30px', display: 'inline-block', fontWeight: 'bold' }}>
            ✅ IDENTITY VERIFIED
          </div>
          <h3 style={{ fontSize: '1.6rem', color: '#1e3a8a', marginBottom: '1rem', fontWeight: 'bold' }}>Voter Verified Successfully!</h3>
          
          <table className="voter-details" style={{ width: '100%', marginBottom: '2rem', borderCollapse: 'collapse', textAlign: 'left' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td className="label" style={{ padding: '0.75rem 0', color: '#64748b', fontWeight: 'bold' }}>Name</td><td className="value" style={{ padding: '0.75rem 0', color: '#0f172a', fontWeight: 'bold' }}>{piSuccessVoter.name}</td></tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td className="label" style={{ padding: '0.75rem 0', color: '#64748b', fontWeight: 'bold' }}>Voter ID</td><td className="value" style={{ padding: '0.75rem 0', color: '#0f172a', fontFamily: 'monospace' }}>{piSuccessVoter.voterID}</td></tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td className="label" style={{ padding: '0.75rem 0', color: '#64748b', fontWeight: 'bold' }}>Constituency</td><td className="value" style={{ padding: '0.75rem 0', color: '#0f172a', fontWeight: 'bold' }}>{piSuccessVoter.constituency}</td></tr>
            </tbody>
          </table>

          <div style={{ padding: '1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', color: '#166534', marginBottom: '2rem', textAlign: 'left', lineHeight: '1.5' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>👉 Physical EVM Ready</h4>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>Please ask the voter to proceed to the <strong>Raspberry Pi EVM Terminal</strong>. They must press <strong>YES (Button 1)</strong> on the terminal to view their ballot and cast their vote.</p>
          </div>

          <button 
            className="btn-primary" 
            onClick={() => {
              setPiSuccessVoter(null);
              setError('');
            }}
            style={{ width: '100%', padding: '12px', fontSize: '1.05rem', fontWeight: 'bold', background: '#2563eb', borderRadius: '8px', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Verify Next Voter
          </button>
        </div>
      </div>
    );
  }

  if (!voter) {
    return (
      <div className="screen auth-screen">
        {renderHeader()}

        <div className="voter-card auth-card" style={{ maxWidth: '750px', width: '90%', margin: '2rem auto', padding: '2.5rem' }}>
          <h3 style={{ textAlign: 'center', fontSize: '1.6rem', color: '#1e3a8a', fontWeight: 'bold', marginBottom: '1.5rem' }}>{t('welcome')}</h3>
          
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {/* Method 1: Face Scan via Raspberry Pi */}
            <div style={{ flex: '1 1 300px', padding: '1.5rem', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  📷 Option A: Face Verification (Pi)
                </h4>
                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: '1.4' }}>
                  Capture a live photo using the Raspberry Pi camera terminal to match biometrics and load the ballot list.
                </p>
                
                <div style={{ margin: '0 0 1.25rem 0' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '0.4rem' }}>Raspberry Pi IP Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.100"
                    value={piIp}
                    onChange={e => setPiIp(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    disabled={piVerifying}
                  />
                </div>
              </div>
              
              <button 
                className="btn-primary" 
                onClick={handlePiFaceVerify} 
                disabled={piVerifying || loading}
                style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold', background: '#22c55e', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(34, 197, 94, 0.2)' }}
              >
                {piVerifying ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px', margin: 0, border: '2px solid #fff', borderTopColor: 'transparent' }} />
                    Verifying Face...
                  </>
                ) : 'Capture & Verify Face'}
              </button>
            </div>

            {/* Vertical/Horizontal divider */}
            <div className="auth-divider" style={{ width: '1px', background: '#cbd5e1', alignSelf: 'stretch' }} />

            {/* Method 2: Local Fingerprint Simulator */}
            <div style={{ flex: '1 1 300px', padding: '1.5rem', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  👆 Option B: Fingerprint (Simulated)
                </h4>
                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: '1.4' }}>
                  Simulate verification using the R307 fingerprint sensor ID. Recommended for laptop-only testing.
                </p>
                
                <form onSubmit={handleLogin} className="auth-form" style={{ margin: 0 }}>
                  <div style={{ margin: '0 0 1.25rem 0' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '0.4rem' }}>{t('enter_fp')}</label>
                    <input
                      type="number"
                      className="auth-input"
                      placeholder={t('fp_placeholder')}
                      value={fingerprintId}
                      onChange={e => setFingerprintId(e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button className="btn-primary auth-btn" type="submit" disabled={loading || piVerifying} style={{ width: '100%', margin: 0 }}>
                    {loading ? t('btn_scanning') : t('btn_scan')}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-box" style={{ marginTop: '1.5rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b' }}>
              <p style={{ margin: 0, fontWeight: '500' }}>❌ {error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen auth-screen">
      {renderHeader()}

      <div className="voter-card">
        <div className="verified-badge">✅ {t('identity_verified')}</div>
        <table className="voter-details">
          <tbody>
            <tr><td className="label">{t('voter_name')}</td><td className="value">{voter.name}</td></tr>
            <tr><td className="label">{t('voter_id')}</td><td className="value">{voter.voterID}</td></tr>
            <tr><td className="label">{t('constituency')}</td><td className="value">{voter.constituency}</td></tr>
            <tr><td className="label">{t('session_valid')}</td><td className="value">{voter.expiresAt.toLocaleTimeString()}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="countdown-box">
        <p dangerouslySetInnerHTML={{ __html: t('loading_ballot', { secs: `<strong>${countdown}</strong>` }) }}></p>
        <button className="btn-primary" onClick={() => navigate('/ballot')}>
          {t('btn_proceed')}
        </button>
      </div>
    </div>
  );
}

export default AuthScreen;
