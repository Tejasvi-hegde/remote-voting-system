import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { castVote } from '../api';

/**
 * ConfirmScreen
 * Shows the voter their selection one final time.
 * On confirm -> submits to blockchain via /api/vote/cast
 * On back    -> returns to ballot
 *
 * After successful submission, shows the transaction ID
 * which the voter can use to verify their vote later.
 */
function ConfirmScreen() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [candidate] = useState(() => {
    const raw = sessionStorage.getItem('selected_candidate');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (result) {
      notifyTerminal(result);
    }
  }, [result]);

  useEffect(() => {
    if (!candidate) {
      navigate('/ballot');
    }
  }, [candidate, navigate]);

  if (!candidate) {
    return null;
  }

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const terminalCallback = sessionStorage.getItem('terminal_callback');
      const terminalID = sessionStorage.getItem('terminal_id');
      const { data } = await castVote(candidate.candidateID);

      sessionStorage.removeItem('voting_token');
      sessionStorage.removeItem('selected_candidate');

      setResult({
        ...data,
        terminalCallback,
        terminalID,
        candidateID: candidate.candidateID
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Vote submission failed. Please call the presiding officer.';
      setError(msg);
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="screen success-screen">
        <div className="success-icon">✅</div>
        <h1>Vote Cast Successfully!</h1>
        <p className="success-message">
          Your vote has been securely recorded on the blockchain.
        </p>

        <div className="tx-card">
          <p className="tx-label">Transaction ID (keep this for verification)</p>
          <p className="tx-id">{result.transactionID}</p>
          <p className="tx-time">Recorded at: {new Date(result.timestamp).toLocaleString()}</p>
        </div>

        <p className="thank-you">
          Thank you for exercising your democratic right. <br />
          This terminal will reset in a moment.
        </p>

        <AutoResetTimer
          seconds={20}
          onDone={() => {
            sessionStorage.clear();
            window.location.href = '/';
          }}
        />
      </div>
    );
  }

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

  return (
    <div className="screen confirm-screen">
      <h2>Final Confirmation</h2>
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
          <strong>This action cannot be undone.</strong><br />
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
          Go Back
        </button>
        <button
          className="btn-primary btn-confirm"
          onClick={handleConfirm}
        >
          Cast My Vote
        </button>
      </div>
    </div>
  );
}

function notifyTerminal(result) {
  if (!result?.terminalCallback || result._terminalNotified) {
    return;
  }

  const callbackURL = new URL(result.terminalCallback);
  callbackURL.searchParams.set('status', 'completed');
  callbackURL.searchParams.set('transactionID', result.transactionID);
  callbackURL.searchParams.set('timestamp', result.timestamp);
  callbackURL.searchParams.set('candidateID', result.candidateID);
  if (result.terminalID) {
    callbackURL.searchParams.set('terminalID', result.terminalID);
  }

  // Best-effort notification to the local Raspberry Pi callback server.
  const beacon = new Image();
  beacon.src = callbackURL.toString();
  result._terminalNotified = true;
}

function AutoResetTimer({ seconds, onDone }) {
  const [count, setCount] = React.useState(seconds);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCount((current) => {
        if (current <= 1) {
          clearInterval(timer);
          onDone();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <p className="reset-notice">
      Terminal resets in <strong>{count}</strong> seconds...
    </p>
  );
}

export default ConfirmScreen;
