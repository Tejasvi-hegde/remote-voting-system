import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { castVote } from '../api';

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
      // Clear session — vote is done
      sessionStorage.clear();
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
        <div className="success-icon">✅</div>
        <h1>Vote Cast Successfully!</h1>
        <p className="success-message">
          Your vote was successfully casted to <strong>{candidate.name}</strong>.<br />
          It has been securely recorded on the blockchain.
        </p>

        <div className="tx-card">
          <p className="tx-label">Transaction ID (keep this for verification)</p>
          <p className="tx-id">{result.transactionID}</p>
          <p className="tx-time">Recorded at: {new Date(result.timestamp).toLocaleString()}</p>
        </div>

        <p className="thank-you">
          🙏 Thank you for exercising your democratic right. <br />
          This terminal will reset in a moment.
        </p>

        <AutoResetTimer seconds={20} onDone={() => window.location.href = '/'} />
      </div>
    );
  }

  // ── Submitting state ───────────────────────────────────────────────────────
  if (submitting) {
    return (
      <div className="screen loading-screen">
        <div className="spinner" />
        <h2>Submitting your vote...</h2>
        <p>Please do not touch the screen or leave the terminal.</p>
        <p>This may take a few seconds while the blockchain confirms.</p>
      </div>
    );
  }

  // ── Confirm state ──────────────────────────────────────────────────────────
  return (
    <div className="screen confirm-screen">
      <h2>⚠️ Final Confirmation</h2>
      <p className="confirm-instruction">
        You are about to cast your vote for:
      </p>

      <div className="confirm-card">
        <div className="party-symbol-large">{candidate.partySymbol || '🏛️'}</div>
        <div className="confirm-details">
          <p className="confirm-candidate-name">{candidate.name}</p>
          <p className="confirm-party">{candidate.party}</p>
        </div>
      </div>

      <div className="confirm-warning">
        <p>
          ⚠️ <strong>This action cannot be undone.</strong><br />
          Once submitted, your vote is permanently recorded on the blockchain.
        </p>
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
          ← Go Back
        </button>
        <button
          className="btn-primary btn-confirm"
          onClick={handleConfirm}
        >
          ✅ Cast My Vote
        </button>
      </div>
    </div>
  );
}

// Auto-resets the terminal after vote is cast
function AutoResetTimer({ seconds, onDone }) {
  const [count, setCount] = React.useState(seconds);
  React.useEffect(() => {
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) { clearInterval(t); onDone(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onDone]);
  return (
    <p className="reset-notice">
      Terminal resets in <strong>{count}</strong> seconds...
    </p>
  );
}

export default ConfirmScreen;
