import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CallOverlay from './components/CallOverlay';

const ProtectedRoute = ({ children }) => {
  const { isRegistered, isUnlocked, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>Loading Lorapok...</div>;
  }
  
  if (!isRegistered || !isUnlocked) {
    return <Navigate to="/login" />;
  }

  return (
    <SocketProvider>
      <CallProvider>
        {children}
        <CallOverlay />
      </CallProvider>
    </SocketProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
