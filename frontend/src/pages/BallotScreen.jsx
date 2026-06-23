import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBallot } from '../api';
import { useTranslation } from '../utils/languages';

const getSymbolEmoji = (symbol) => {
  const mapping = {
    'Lotus': '🪷',
    'Hand': '✋',
    'Bicycle': '🚲',
    'Elephant': '🐘',
    'Bat': '🏏',
    'Arrow': '🏹',
    'Spade': '♠️',
    'Car': '🚗',
    'Umbrella': '☂️',
    'NOTA': '🚫'
  };
  return mapping[symbol] || '🏛️';
};

/**
 * BallotScreen
 * Displays the candidate list for the voter's constituency.
 * Voter selects one candidate and proceeds to confirmation.
 */
function BallotScreen() {
  const navigate = useNavigate();
  const { t, lang, changeLanguage } = useTranslation();
  const [candidates, setCandidates] = useState([]);
  const [constituency, setConstituency] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Session countdown from JWT
  useEffect(() => {
    const token = sessionStorage.getItem('voting_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const remaining = Math.floor((payload.exp * 1000 - Date.now()) / 1000);
      setTimeLeft(Math.max(0, remaining));
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          sessionStorage.clear();
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  // Load ballot
  useEffect(() => {
    fetchBallot()
      .then(({ data }) => {
        setCandidates(data.candidates);
        setConstituency(data.constituency.name);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load ballot. Please contact the presiding officer.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleNext = () => {
    if (!selected) return;
    // Store selection in sessionStorage — not sent to server until confirmed
    sessionStorage.setItem('selected_candidate', JSON.stringify(selected));
    navigate('/confirm');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="screen loading-screen">
        <div className="spinner" />
        <p>{t('loading_ballot_spinner')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen error-screen">
        <h2>⚠️ Ballot Error</h2>
        <div className="error-box"><p>{error}</p></div>
      </div>
    );
  }

  return (
    <div className="screen ballot-screen">
      {/* Header */}
      <div className="ballot-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', color: '#1e3a8a', fontWeight: '800' }}>{t('official_ballot')}</h2>
          <p className="constituency-name" style={{ color: '#475569', fontWeight: '500' }}>{constituency}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select value={lang} onChange={(e) => changeLanguage(e.target.value)} className="lang-select" style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}>
            <option value="en">English (EN)</option>
            <option value="hi">हिन्दी (HI)</option>
            <option value="kn">ಕನ್ನಡ (KN)</option>
          </select>
          <div className={`session-timer ${timeLeft < 120 ? 'warning' : ''}`} style={{ margin: 0 }}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <p className="ballot-instruction" style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '2rem' }} dangerouslySetInnerHTML={{ __html: t('ballot_instruction') }}></p>

      {/* Candidate list */}
      <div className="candidate-list">
        {candidates.map((c, index) => (
          <button
            key={c.candidateID}
            className={`candidate-card evm-row ${selected?.candidateID === c.candidateID ? 'selected' : ''}`}
            onClick={() => setSelected(c)}
          >
            <div className="evm-serial">{index + 1}</div>
            <div className="candidate-info">
              <span className="candidate-name" style={{ fontSize: '1.2rem', color: '#1e293b' }}>{c.name}</span>
              <span className="candidate-party" style={{ color: '#64748b' }}>{c.party}</span>
            </div>
            <div className="evm-symbol-box">
              {getSymbolEmoji(c.partySymbol)}
            </div>
            <div className="evm-panel">
              <div className={`evm-led ${selected?.candidateID === c.candidateID ? 'active' : ''}`} />
              <div className="evm-blue-button" />
            </div>
          </button>
        ))}

        {/* NOTA - None of the Above */}
        <button
          className={`candidate-card evm-row nota ${selected?.candidateID === 'NOTA' ? 'selected' : ''}`}
          onClick={() => setSelected({ candidateID: 'NOTA', name: t('nota_title'), party: 'NOTA', partySymbol: 'NOTA' })}
        >
          <div className="evm-serial">NOTA</div>
          <div className="candidate-info">
            <span className="candidate-name" style={{ fontSize: '1.2rem', color: '#1e293b' }}>{t('nota_title')}</span>
            <span className="candidate-party" style={{ color: '#64748b' }}>{t('nota_desc')}</span>
          </div>
          <div className="evm-symbol-box">
            🚫
          </div>
          <div className="evm-panel">
            <div className={`evm-led ${selected?.candidateID === 'NOTA' ? 'active' : ''}`} />
            <div className="evm-blue-button" />
          </div>
        </button>
      </div>

      {/* Footer actions */}
      <div className="ballot-footer">
        <button
          className="btn-primary"
          disabled={!selected}
          onClick={handleNext}
          style={{ padding: '16px 36px', fontSize: '1.1rem', maxWidth: '300px', margin: '0 auto', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
        >
          {t('btn_confirm_selection')}
        </button>
        {!selected && (
          <p className="select-hint">{t('select_hint')}</p>
        )}
      </div>
    </div>
  );
}

export default BallotScreen;
