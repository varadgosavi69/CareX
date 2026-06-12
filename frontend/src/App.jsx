import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BookAppointment from './pages/BookAppointment';
import AppointmentHistory from './pages/AppointmentHistory';
import Emergency from './pages/Emergency';
import Profile from './pages/Profile';
import DoctorPanel from './pages/DoctorPanel';
import SymptomChecker from './pages/SymptomChecker';
import HealthTips from './pages/HealthTips';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'linear-gradient(135deg, #0D47A1, #0097A7)'
            }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div className="loading-spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                    <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>Loading CareX Cloud...</p>
                </div>
            </div>
        );
    }
    return user ? children : <Navigate to="/" replace />;
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'linear-gradient(135deg, #0D47A1, #0097A7)'
            }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div className="loading-spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                    <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>Loading CareX Cloud...</p>
                </div>
            </div>
        );
    }
    return !user ? children : <Navigate to="/dashboard" replace />;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
                        <Route index element={<Navigate to="book" replace />} />
                        <Route path="book" element={<BookAppointment />} />
                        <Route path="history" element={<AppointmentHistory />} />
                        <Route path="emergency" element={<Emergency />} />
                        <Route path="profile" element={<Profile />} />
                        <Route path="doctor" element={<DoctorPanel />} />
                        <Route path="symptoms" element={<SymptomChecker />} />
                        <Route path="tips" element={<HealthTips />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
