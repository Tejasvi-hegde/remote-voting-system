import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './pages/LoginScreen';
import RegisterScreen from './pages/RegisterScreen';
import BallotScreen from './pages/BallotScreen';
import ConfirmScreen from './pages/ConfirmScreen';
import Dashboard from './pages/Dashboard';
import './App.css';

/**
 * App — Root component for Mock Drill
 */
function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          {/* Voting terminal screens (Mock Drill) */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          
          <Route path="/ballot" element={<ProtectedRoute><BallotScreen /></ProtectedRoute>} />
          <Route path="/confirm" element={<ProtectedRoute><ConfirmScreen /></ProtectedRoute>} />

          {/* EC Admin dashboard — separate route, no auth needed */}
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

// Redirect to login if no token in session
function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('voting_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default App;
