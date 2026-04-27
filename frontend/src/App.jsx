import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthScreen from './pages/AuthScreen';
import BallotScreen from './pages/BallotScreen';
import ConfirmScreen from './pages/ConfirmScreen';
import Dashboard from './pages/Dashboard';
import './App.css';

/**
 * App — Root component
 *
 * Token flow:
 * The Raspberry Pi opens this app with ?token=<JWT> in the URL.
 * We store it in sessionStorage (clears when browser closes).
 * Protected routes check sessionStorage for a valid token.
 */
function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Extract token from URL (set by Pi terminal)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const terminalID = params.get('terminal');
    const terminalCallback = params.get('terminalCallback');

    if (token) {
      sessionStorage.setItem('voting_token', token);
    }
    if (terminalID) {
      sessionStorage.setItem('terminal_id', terminalID);
    }
    if (terminalCallback) {
      sessionStorage.setItem('terminal_callback', terminalCallback);
    }
    if (token || terminalID || terminalCallback) {
      // Clean terminal session details from the URL without reload.
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          {/* Voting terminal screens */}
          <Route path="/" element={<AuthScreen />} />
          <Route path="/ballot" element={<ProtectedRoute><BallotScreen /></ProtectedRoute>} />
          <Route path="/confirm" element={<ProtectedRoute><ConfirmScreen /></ProtectedRoute>} />

          {/* EC Admin dashboard — separate route, no auth needed */}
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

// Redirect to home if no token in session
function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('voting_token');
  if (!token) return <Navigate to="/" replace />;
  return children;
}

export default App;
