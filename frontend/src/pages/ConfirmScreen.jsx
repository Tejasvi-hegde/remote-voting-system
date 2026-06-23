import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { castVote } from '../api';
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
 * ConfirmScreen
 * Shows the voter their selection one final time.
 * On confirm → submits to blockchain via /api/vote/cast
 * On back   → returns to ballot
 *
 * After successful submission, shows the transaction ID
 * which the voter can use to verify their vote later.
 */
function ConfirmScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const raw = sessionStorage.getItem('selected_candidate');
  const candidate = raw ? JSON.parse(raw) : null;

  if (!candidate) {
    navigate('/ballot');
    return null;
  }

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data } = await castVote(candidate.candidateID);
      // Do not remove candidate or clear session yet, so the screen doesn't redirect
      setResult(data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Vote submission failed. Please call the presiding officer.';
      setError(msg);
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="screen success-screen">
        <div className="success-icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
        <h2>{t('vote_cast_success')}</h2>
        <p className="success-message" style={{ fontSize: '1.2rem', marginBottom: '2rem' }}
           dangerouslySetInnerHTML={{ __html: t('vote_cast_desc', { candidate: `<strong>${candidate.name}</strong>` }) }}>
        </p>

        <div className="tx-card" style={{ background: '#1a202c', padding: '1.5rem', borderRadius: '8px', border: '1px solid #4a5568' }}>
          <p className="tx-label" style={{ color: '#a0aec0', fontWeight: 'bold' }}>{t('tx_label')}</p>
          <p className="tx-id" style={{ fontSize: '1.1rem', wordBreak: 'break-all', fontFamily: 'monospace', color: '#63b3ed' }}>{result.transactionID}</p>
          <p className="tx-time" style={{ color: '#a0aec0', marginTop: '0.5rem' }}>{t('recorded_at', { time: new Date(result.timestamp).toLocaleString() })}</p>
        </div>

        <p className="thank-you" style={{ marginTop: '2rem', fontSize: '1.2rem', fontWeight: 'bold', color: '#48bb78' }}
           dangerouslySetInnerHTML={{ __html: t('thank_you') }}>
        </p>

        <AutoResetTimer seconds={20} onDone={() => {
          sessionStorage.clear();
          window.location.href = '/';
        }} />
      </div>
    );
  }

  // ── Submitting state ───────────────────────────────────────────────────────
  if (submitting) {
    return (
      <div className="screen loading-screen">
        <div className="spinner" />
        <h2>{t('submitting_vote')}</h2>
        <p>{t('do_not_touch')}</p>
        <p>{t('confirm_wait')}</p>
      </div>
    );
  }

  // ── Confirm state ──────────────────────────────────────────────────────────
  return (
    <div className="screen confirm-screen">
      <h2>{t('final_confirmation')}</h2>
      <p className="confirm-instruction">
        {t('about_to_cast')}
      </p>

      <div className="confirm-card">
        <div className="party-symbol-large">{getSymbolEmoji(candidate.partySymbol)}</div>
        <div className="confirm-details">
          <p className="confirm-candidate-name">{candidate.name}</p>
          <p className="confirm-party">{candidate.party}</p>
        </div>
      </div>

      <div className="confirm-warning">
        <p dangerouslySetInnerHTML={{ __html: t('warning_undo') }}></p>
      </div>

      {error && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      <div className="confirm-actions">
        <button
          className="btn-secondary"
          onClick={() => navigate('/ballot')}
        >
          {t('btn_go_back')}
        </button>
        <button
          className="btn-primary btn-confirm"
          onClick={handleConfirm}
        >
          {t('btn_cast_vote')}
        </button>
      </div>
    </div>
  );
}

// Auto-resets the terminal after vote is cast
function AutoResetTimer({ seconds, onDone }) {
  const { t } = useTranslation();
  const [count, setCount] = React.useState(seconds);
  React.useEffect(() => {
    const tTimer = setInterval(() => {
      setCount((c) => {
        if (c <= 1) { clearInterval(tTimer); onDone(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tTimer);
  }, [onDone]);
  return (
    <p className="reset-notice">
      {t('reset_notice', { secs: `<strong>${count}</strong>` })}
    </p>
  );
}

export default ConfirmScreen;
