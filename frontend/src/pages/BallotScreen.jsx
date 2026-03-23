import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBallot } from '../api';

/**
 * BallotScreen
 * Displays the candidate list for the voter's constituency.
 * Voter selects one candidate and proceeds to confirmation.
 */
function BallotScreen() {
  const navigate = useNavigate();
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
        <p>Loading your constituency ballot...</p>
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
      <div className="ballot-header">
        <div>
          <h2>Official Ballot</h2>
          <p className="constituency-name">{constituency}</p>
        </div>
        <div className={`session-timer ${timeLeft < 120 ? 'warning' : ''}`}>
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      <p className="ballot-instruction">
        Select <strong>ONE</strong> candidate and press Confirm Vote.
      </p>

      {/* Candidate list */}
      <div className="candidate-list">
        {candidates.map((c) => (
          <button
            key={c.candidateID}
            className={`candidate-card ${selected?.candidateID === c.candidateID ? 'selected' : ''}`}
            onClick={() => setSelected(c)}
          >
            <div className="party-symbol">{c.partySymbol || '🏛️'}</div>
            <div className="candidate-info">
              <span className="candidate-name">{c.name}</span>
              <span className="candidate-party">{c.party}</span>
            </div>
            <div className="selection-indicator">
              {selected?.candidateID === c.candidateID ? '✅' : '⭕'}
            </div>
          </button>
        ))}

        {/* NOTA - None of the Above */}
        <button
          className={`candidate-card nota ${selected?.candidateID === 'NOTA' ? 'selected' : ''}`}
          onClick={() => setSelected({ candidateID: 'NOTA', name: 'None of the Above', party: 'NOTA' })}
        >
          <div className="party-symbol">🚫</div>
          <div className="candidate-info">
            <span className="candidate-name">None of the Above (NOTA)</span>
            <span className="candidate-party">Article 49-O</span>
          </div>
          <div className="selection-indicator">
            {selected?.candidateID === 'NOTA' ? '✅' : '⭕'}
          </div>
        </button>
      </div>

      {/* Footer actions */}
      <div className="ballot-footer">
        <button
          className="btn-primary"
          disabled={!selected}
          onClick={handleNext}
        >
          Confirm Selection →
        </button>
        {!selected && (
          <p className="select-hint">Please select a candidate to continue.</p>
        )}
      </div>
    </div>
  );
}

export default BallotScreen;
