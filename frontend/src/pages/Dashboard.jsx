import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as appointmentService from '../api/services/appointmentService';
import {
    Heart, CalendarPlus, ClipboardList, AlertTriangle, LogOut,
    UserCircle, Stethoscope, Brain, Lightbulb, Sun, Coffee, Moon,
    CalendarDays, Clock, CheckCircle, XCircle, Loader2
} from 'lucide-react';

const navItems = [
    { to: '/dashboard/book', icon: <CalendarPlus size={18} />, label: 'Book Appointment' },
    { to: '/dashboard/history', icon: <ClipboardList size={18} />, label: 'Appointment History' },
    { to: '/dashboard/symptoms', icon: <Brain size={18} />, label: 'Symptom Checker' },
    { to: '/dashboard/tips', icon: <Lightbulb size={18} />, label: 'Health Tips' },
    { to: '/dashboard/emergency', icon: <AlertTriangle size={18} />, label: 'Emergency' },
    { to: '/dashboard/profile', icon: <UserCircle size={18} />, label: 'My Profile' },
    { to: '/dashboard/doctor', icon: <Stethoscope size={18} />, label: 'Doctor Panel' },
];

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Good Morning', icon: <Coffee size={18} color="#F59E0B" /> };
    if (h < 17) return { text: 'Good Afternoon', icon: <Sun size={18} color="#F59E0B" /> };
    return { text: 'Good Evening', icon: <Moon size={18} color="#7C3AED" /> };
}

function GreetingBanner({ user }) {
    const { text, icon } = getGreeting();
    const displayName = user?.name || user?.email?.split('@')[0] || 'User';
    const firstName = displayName.split(' ')[0];

    const [stats, setStats] = useState({ total: 0, upcoming: 0, completed: 0, cancelled: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        let active = true;
        const load = async () => {
            try {
                // Fetch the patient's appointments and derive the banner stats.
                const { appointments } = await appointmentService.list({ limit: 50 });
                if (!active) return;
                const now = Date.now();
                const isFuture = (a) => new Date(a.scheduledAt).getTime() >= now;
                setStats({
                    total: appointments.length,
                    upcoming: appointments.filter(
                        a => (a.status === 'pending' || a.status === 'approved') && isFuture(a)
                    ).length,
                    completed: appointments.filter(a => a.status === 'completed').length,
                    cancelled: appointments.filter(a => a.status === 'cancelled').length,
                });
            } catch {
                // Leave zeros on failure — the banner still renders cleanly.
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [user]);

    return (
        <div style={{
            background: 'linear-gradient(135deg, #0D47A1 0%, #0097A7 100%)',
            borderRadius: 18, padding: '24px 28px', marginBottom: 28, position: 'relative', overflow: 'hidden',
        }}>
            {/* Decorative circles */}
            <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', bottom: -20, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {icon}
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500 }}>{text}</span>
            </div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: '0 0 20px' }}>
                Welcome back, {firstName}! 👋
            </h2>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
                {loading ? (
                    <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                        <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading your stats…
                    </div>
                ) : [
                    { label: 'Total Appointments', value: stats.total, icon: <CalendarDays size={16} color="white" /> },
                    { label: 'Upcoming', value: stats.upcoming, icon: <Clock size={16} color="white" /> },
                    { label: 'Completed', value: stats.completed, icon: <CheckCircle size={16} color="white" /> },
                    { label: 'Cancelled', value: stats.cancelled, icon: <XCircle size={16} color="white" /> },
                ].map(s => (
                    <div key={s.label} style={{
                        background: 'rgba(255,255,255,0.12)', borderRadius: 12,
                        padding: '12px 14px', backdropFilter: 'blur(8px)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>{s.icon}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'white', lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() ?? 'U';

    const displayName = user?.name || user?.email?.split('@')[0] || 'User';

    return (
        <div className="dashboard">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <Heart size={22} color="white" fill="white" />
                    </div>
                    <h2>CareX Cloud</h2>
                    <p>Healthcare Portal</p>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => isActive ? 'active' : ''}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <span>{displayName}</span>
                            <small>{user?.email}</small>
                        </div>
                    </div>
                    <button className="nav-btn" onClick={handleLogout} style={{
                        color: 'rgba(255,255,255,0.7)',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', padding: '12px 16px',
                        background: 'rgba(239,68,68,0.1)',
                        border: 'none', borderRadius: '10px',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '14px', fontWeight: 500,
                        transition: 'all 0.25s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <GreetingBanner user={user} />
                <Outlet />
            </main>
        </div>
    );
}
