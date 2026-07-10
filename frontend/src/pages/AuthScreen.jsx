import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/languages';

/**
 * AuthScreen
 * First screen the voter sees on the terminal.
 * Supports:
 * - Face Verification via Raspberry Pi Camera + EVM terminal showcase.
 */
function AuthScreen() {
  const { t, lang, changeLanguage } = useTranslation();
  const [error, setError] = useState('');

  // Pi Verification State
  const [piVerifying, setPiVerifying] = useState(false);
  const [piSuccessVoter, setPiSuccessVoter] = useState(null);
  const [piIp, setPiIp] = useState('raspberrypi.local');

  const handlePiFaceVerify = async (e) => {
    e.preventDefault();
    setError('');
    setPiVerifying(true);

    try {
      const { data } = await axios.post('/api/auth/verify-face-pi', {
        piIp: piIp
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
            <p style={{ margin: 0, fontSize: '0.95rem' }}>Please ask the voter to proceed to the <strong>Raspberry Pi EVM Terminal</strong>. They must press <strong>YES (Button 7)</strong> on the terminal to view their ballot and cast their vote.</p>
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

  return (
    <div className="screen auth-screen">
      {renderHeader()}

      <div className="voter-card auth-card" style={{ maxWidth: '500px', width: '90%', margin: '2rem auto', padding: '2.5rem' }}>
        <h3 style={{ textAlign: 'center', fontSize: '1.6rem', color: '#1e3a8a', fontWeight: 'bold', marginBottom: '1.5rem' }}>Voter Authentication</h3>
        
        <p style={{ fontSize: '0.95rem', color: '#64748b', margin: '0 0 1.5rem 0', textAlign: 'center', lineHeight: '1.4' }}>
          Verify identity by capturing a live snapshot from the Raspberry Pi camera terminal.
        </p>

        <form onSubmit={handlePiFaceVerify}>
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', marginBottom: '0.5rem' }}>Raspberry Pi IP / Hostname</label>
            <input 
              type="text" 
              value={piIp} 
              onChange={(e) => setPiIp(e.target.value)} 
              placeholder="e.g. raspberrypi.local or 10.244.249.xx"
              style={{ width: '100%', padding: '10px', fontSize: '1.05rem', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }}
            />
          </div>

          <button 
            className="btn-primary" 
            type="submit"
            disabled={piVerifying}
            style={{ width: '100%', padding: '14px', fontSize: '1.1rem', fontWeight: 'bold', background: '#22c55e', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(34, 197, 94, 0.2)' }}
          >
            {piVerifying ? (
              <>
                <span className="spinner" style={{ width: '16px', height: '16px', margin: 0, border: '2px solid #fff', borderTopColor: 'transparent' }} />
                Verifying Face...
              </>
            ) : 'Capture & Verify Face'}
          </button>
        </form>

        {error && (
          <div className="error-box" style={{ marginTop: '1.5rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b' }}>
            <p style={{ margin: 0, fontWeight: '500' }}>❌ {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthScreen;
