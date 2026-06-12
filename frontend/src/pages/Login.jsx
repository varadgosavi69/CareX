import React, { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { Heart, Mail, Lock, AlertCircle, X, Cloud, User, UserPlus, LogIn } from 'lucide-react';

const AUTH_ERRORS = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
};

export default function Login() {
    const [mode, setMode] = useState('login'); // 'login' | 'signup'

    // Login fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Sign-up extra fields
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const clearFields = () => {
        setEmail(''); setPassword(''); setFullName(''); setConfirmPassword('');
        setError(''); setSuccess('');
    };

    const switchMode = (m) => { setMode(m); clearFields(); };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError('Please enter both email and password.'); return; }
        setLoading(true); setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(AUTH_ERRORS[err.code] || `Authentication failed: ${err.message}`);
        } finally { setLoading(false); }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!fullName.trim()) { setError('Please enter your full name.'); return; }
        if (!email || !password) { setError('Please fill in all fields.'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setLoading(true); setError('');
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: fullName.trim() });
        } catch (err) {
            setError(AUTH_ERRORS[err.code] || `Sign up failed: ${err.message}`);
        } finally { setLoading(false); }
    };

    const inputStyle = {
        paddingLeft: '44px', width: '100%', boxSizing: 'border-box',
    };
    const iconStyle = {
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: '#64748B', pointerEvents: 'none',
    };

    return (
        <div className="auth-page">
            {/* Background floating icons */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                {['❤️', '🏥', '💊', '🩺', '🧬', '💉'].map((icon, i) => (
                    <div key={i} style={{
                        position: 'absolute', fontSize: '32px', opacity: 0.08,
                        top: `${10 + i * 15}%`, left: `${5 + i * 16}%`,
                        animation: `bgPulse ${4 + i}s ease-in-out infinite`,
                        animationDelay: `${i * 0.5}s`,
                    }}>{icon}</div>
                ))}
            </div>

            <div className="auth-card" style={{ maxWidth: 420 }}>
                <div className="auth-logo">
                    <div className="auth-logo-icon">
                        <Heart size={32} color="white" fill="white" />
                    </div>
                    <h1>CareX Cloud</h1>
                    <p>Healthcare Appointment Management</p>
                </div>

                {/* Mode Toggle */}
                <div style={{
                    display: 'flex', background: '#F1F5F9', borderRadius: 12,
                    padding: 4, marginBottom: 24, gap: 4,
                }}>
                    {[
                        { key: 'login', label: 'Sign In', icon: <LogIn size={15} /> },
                        { key: 'signup', label: 'Create Account', icon: <UserPlus size={15} /> },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => switchMode(tab.key)}
                            style={{
                                flex: 1, padding: '10px 8px', border: 'none', borderRadius: 10,
                                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: mode === tab.key ? 'white' : 'transparent',
                                color: mode === tab.key ? '#0D47A1' : '#64748B',
                                boxShadow: mode === tab.key ? '0 2px 8px rgba(13,71,161,0.12)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: '10px',
                        padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px',
                        marginBottom: '20px'
                    }}>
                        <AlertCircle size={18} color="#C62828" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: '13px', color: '#C62828', flex: 1 }}>{error}</span>
                        <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C62828', padding: 0 }}>
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div style={{
                        background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '10px',
                        padding: '12px 16px', fontSize: '13px', color: '#2E7D32', marginBottom: '20px'
                    }}>
                        ✓ {success}
                    </div>
                )}

                {/* ── LOGIN FORM ── */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <div style={iconStyle}><Mail size={18} /></div>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com" required style={inputStyle} autoComplete="email" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <div style={{ position: 'relative' }}>
                                <div style={iconStyle}><Lock size={18} /></div>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter your password" required style={inputStyle} autoComplete="current-password" />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
                            {loading ? (
                                <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Signing in...</>
                            ) : (
                                <><Cloud size={18} /> Login to CareX Cloud</>
                            )}
                        </button>
                    </form>
                )}

                {/* ── SIGN UP FORM ── */}
                {mode === 'signup' && (
                    <form onSubmit={handleSignUp}>
                        <div className="form-group">
                            <label>Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <div style={iconStyle}><User size={18} /></div>
                                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                                    placeholder="Your full name" required style={inputStyle} autoComplete="name" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <div style={iconStyle}><Mail size={18} /></div>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com" required style={inputStyle} autoComplete="email" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <div style={{ position: 'relative' }}>
                                <div style={iconStyle}><Lock size={18} /></div>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="At least 6 characters" required style={inputStyle} autoComplete="new-password" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <div style={iconStyle}><Lock size={18} /></div>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat your password" required style={inputStyle} autoComplete="new-password" />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
                            {loading ? (
                                <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Creating Account...</>
                            ) : (
                                <><UserPlus size={18} /> Create My Account</>
                            )}
                        </button>
                    </form>
                )}

                <div style={{
                    marginTop: '24px', padding: '14px', background: '#EEF2FF',
                    borderRadius: '10px', textAlign: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50' }} />
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Secure Firebase Authentication</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748B' }}>
                        Your data is protected with enterprise-grade encryption
                    </p>
                </div>
            </div>
        </div>
    );
}
