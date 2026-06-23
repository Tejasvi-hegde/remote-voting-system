import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from '../utils/languages';

/**
 * AuthScreen
 * First screen the voter sees on the terminal.
 * We simulate the physical R307 fingerprint scanner so you can test
 * without Windows Hello getting in the way.
 */
function AuthScreen() {
  const navigate = useNavigate();
  const { t, lang, changeLanguage } = useTranslation();
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

  if (!voter) {
    return (
      <div className="screen auth-screen">
        {renderHeader()}

        <div className="voter-card auth-card">
          <h3>{t('welcome')}</h3>
          <p>{t('enter_fp')}</p>

          <form onSubmit={handleLogin} className="auth-form">
            <input
              type="number"
              className="auth-input"
              placeholder={t('fp_placeholder')}
              value={fingerprintId}
              onChange={e => setFingerprintId(e.target.value)}
            />
            <button className="btn-primary auth-btn" type="submit" disabled={loading}>
              {loading ? t('btn_scanning') : t('btn_scan')}
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
