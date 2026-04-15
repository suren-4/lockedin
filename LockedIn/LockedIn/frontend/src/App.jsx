import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans antialiased selection:bg-red-500/30 selection:text-red-200 relative overflow-hidden">
        {/* Animated Background Mesh */}
        <div className="bg-mesh-1"></div>
        <div className="bg-mesh-2"></div>
        <div className="bg-mesh-3"></div>

        <div className="relative z-10 min-h-screen">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard/*" 
              element={<Dashboard />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
