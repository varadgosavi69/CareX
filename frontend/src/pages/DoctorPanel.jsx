import React, { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as appointmentService from '../api/services/appointmentService';
import * as prescriptionService from '../api/services/prescriptionService';
import { apiErrorMessage } from '../api/client';
import {
    ClipboardList, CheckCircle, Clock, Stethoscope, Building2,
    CalendarDays, Loader2, History, XCircle, FileText, RefreshCw, ShieldAlert,
} from 'lucide-react';

// Status comparisons use the API's lowercase enum
// (pending | approved | rejected | cancelled | completed).
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Flatten a populated API appointment into the shape this panel renders.
const normalizeAppt = (a) => {
    const d = a.scheduledAt ? new Date(a.scheduledAt) : null;
    const valid = d && !Number.isNaN(d.getTime());
    return {
        id: a._id,
        status: a.status, // lowercase API enum
        scheduledAt: a.scheduledAt,
        date: valid ? d.toLocaleDateString('en-CA') : '', // YYYY-MM-DD (local)
        day: valid ? WEEKDAY_NAMES[d.getDay()] : '',
        time: a.slot || (valid ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
        doctorName: a.doctor?.user?.name || 'Doctor',
        category: a.category || a.doctor?.specialty || '',
        hospital: a.location?.address || '',
        patientName: a.patient?.name || '',
        userEmail: a.patient?.email || '',
        patientReason: a.reason || '',
        consultationFee: a.consultationFee,
    };
};

// Turn an API error into a clear message, calling out 403/404/409 explicitly.
const describeError = (e, fallback) => {
    const status = e?.response?.status;
    const serverMsg = e?.response?.data?.message;
    if (status === 403) return serverMsg || 'You are not authorized to perform this action.';
    if (status === 404) return serverMsg || 'Appointment not found — it may have been removed.';
    if (status === 409) return serverMsg || 'This conflicts with the current state of the appointment.';
    return apiErrorMessage(e, fallback);
};

// ─── Not Authorized State ─────────────────────────────────────────────────────
function NotAuthorized() {
    return (
        <div>
            <div className="page-header">
                <h1>Doctor Panel</h1>
                <p>Review appointments and view patient history</p>
            </div>
            <div className="page-body">
                <div className="card">
                    <div className="empty-state">
                        <div style={{
                            width: 72, height: 72, margin: '0 auto 16px',
                            background: 'linear-gradient(135deg, #C62828, #EF5350)',
                            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(198,40,40,0.3)',
                        }}>
                            <ShieldAlert size={32} color="white" />
                        </div>
                        <h3>Not Authorized</h3>
                        <p>This area is restricted to medical staff. Please sign in with a doctor account to access the panel.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Prescription Modal ─────────────────────────────────────────────────────────────────────────────────
function PrescriptionModal({ appt, onClose, onSaved }) {
    const [medicine, setMedicine] = useState('');
    const [dosage, setDosage] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!medicine.trim()) return;
        setSaving(true);
        setError('');
        try {
            await prescriptionService.create(appt.id, {
                medicines: [{
                    name: medicine.trim(),
                    ...(dosage.trim() ? { dosage: dosage.trim() } : {}),
                }],
                ...(notes.trim() ? { notes: notes.trim() } : {}),
            });
            setSaved(true);
            setTimeout(() => { onSaved && onSaved(); onClose(); }, 1200);
        } catch (e) {
            setError(describeError(e, 'Could not save prescription.'));
        } finally {
            setSaving(false);
        }
    };

    if (!appt) return null;
    const inputStyle = {
        width: '100%', padding: '11px 14px', border: '2px solid #E0E7FF',
        borderRadius: 10, fontFamily: 'inherit', fontSize: 14, outline: 'none',
        color: '#1E293B', background: '#F8FAFF', boxSizing: 'border-box',
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                <div className="modal-banner" style={{ background: 'linear-gradient(135deg,#2E7D32,#43A047)' }}>
                    <div className="modal-banner-icon pop-in"><FileText size={34} color="white" /></div>
                    <h3 className="modal-banner-title">Write Prescription</h3>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                        For: <strong>{appt.patientName}</strong>
                    </p>
                    {saved ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                            <CheckCircle size={40} color="#2E7D32" />
                            <p style={{ fontWeight: 700, marginTop: 8, color: '#2E7D32' }}>Prescription Saved!</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Medicine *</label>
                                <input type="text" value={medicine} onChange={e => { setMedicine(e.target.value); setError(''); }}
                                    placeholder="e.g. Paracetamol 500mg" style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Dosage</label>
                                <input type="text" value={dosage} onChange={e => setDosage(e.target.value)}
                                    placeholder="e.g. 500mg twice daily after food" style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Doctor Notes</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                    placeholder="Additional instructions for the patient..." rows={3}
                                    style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                            {error && (
                                <div style={{
                                    background: '#FFEBEE', color: '#C62828', borderRadius: 8,
                                    padding: '10px 12px', fontSize: 13, marginBottom: 12, border: '1px solid #EF9A9A',
                                }}>
                                    {error}
                                </div>
                            )}
                            <div className="modal-actions">
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !medicine.trim()}>
                                    {saving ? 'Saving…' : '💾 Save Prescription'}
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── History Card ─────────────────────────────────────────────────────────────
function HistoryCard({ appt }) {
    const isApproved = appt.status === 'approved';
    return (
        <div style={{
            background: 'white', borderRadius: 14, padding: '18px 20px',
            border: `1.5px solid ${isApproved ? '#A5D6A7' : '#EF9A9A'}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                {/* Left - Patient info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: isApproved
                                ? 'linear-gradient(135deg, #2E7D32, #4CAF50)'
                                : 'linear-gradient(135deg, #C62828, #EF5350)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0,
                        }}>
                            {appt.patientName?.[0]?.toUpperCase() || 'P'}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{appt.patientName}</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>
                                {appt.userEmail}
                            </div>
                        </div>
                    </div>

                    {appt.patientReason && (
                        <div style={{
                            background: '#F8FAFF', borderRadius: 7, padding: '6px 10px',
                            fontSize: 12, color: '#475569', borderLeft: '3px solid #90CAF9',
                        }}>
                            📝 {appt.patientReason}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12, color: '#64748B' }}>
                        <span><Stethoscope size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#0277BD' }} />{appt.doctorName}</span>
                        <span><Building2 size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#0277BD' }} />{appt.hospital}</span>
                        <span><CalendarDays size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#0277BD' }} />{appt.date} · {appt.day}</span>
                        <span><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#0277BD' }} />{appt.time}</span>
                    </div>
                </div>

                {/* Right - Status badge */}
                <div>
                    <span style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: isApproved ? '#E8F5E9' : '#FFEBEE',
                        color: isApproved ? '#2E7D32' : '#C62828',
                        display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                        {isApproved ? <CheckCircle size={13} /> : <XCircle size={13} />}
                        {titleCase(appt.status)}
                    </span>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                        {appt.category}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Doctor Panel ────────────────────────────────────────────────────────
export default function DoctorPanel() {
    const { user } = useAuth();
    const isAuthorized = !!user && (user.role === 'doctor' || user.role === 'admin');

    const [tab, setTab] = useState('pending'); // 'pending' | 'history'
    const [appts, setAppts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [approving, setApproving] = useState({});
    const [rejecting, setRejecting] = useState({});
    const [historyFilter, setHistoryFilter] = useState('All'); // 'All' | 'Approved' | 'Rejected'
    const [prescriptionTarget, setPrescriptionTarget] = useState(null); // appointment obj for prescription modal
    const [categoryFilter, setCategoryFilter] = useState('All'); // category filter for pending tab

    // Fetch this doctor's appointments (role-aware GET /api/appointments).
    const load = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true); else setLoading(true);
        setError('');
        try {
            const { appointments } = await appointmentService.list({ limit: 50 });
            setAppts((appointments || []).map(normalizeAppt));
        } catch (e) {
            setError(apiErrorMessage(e, 'Could not load appointments'));
        } finally {
            if (silent) setRefreshing(false); else setLoading(false);
        }
    }, []);

    // Initial load (only for authorized doctors/admins).
    useEffect(() => {
        if (isAuthorized) load();
    }, [isAuthorized, load]);

    // Refetch when the window regains focus. NOTE: the live Firestore onSnapshot
    // listeners are intentionally replaced by fetch-on-mount + a Refresh button +
    // refocus refresh (same pattern as AppointmentHistory).
    useEffect(() => {
        if (!isAuthorized) return;
        const onFocus = () => load({ silent: true });
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [isAuthorized, load]);

    const handleApprove = async (id) => {
        setApproving(p => ({ ...p, [id]: true }));
        setActionError('');
        try {
            await appointmentService.updateStatus(id, 'approved');
            await load({ silent: true });
        } catch (e) {
            setActionError(describeError(e, 'Could not approve appointment.'));
        } finally {
            setApproving(p => ({ ...p, [id]: false }));
        }
    };

    const handleReject = async (id) => {
        setRejecting(p => ({ ...p, [id]: true }));
        setActionError('');
        try {
            await appointmentService.updateStatus(id, 'rejected');
            await load({ silent: true });
        } catch (e) {
            setActionError(describeError(e, 'Could not reject appointment.'));
        } finally {
            setRejecting(p => ({ ...p, [id]: false }));
        }
    };

    // Gate the panel by JWT role. Hooks above always run; redirects/states below.
    if (!user) return <Navigate to="/" replace />;
    if (!isAuthorized) return <NotAuthorized />;

    // Split the doctor's appointments into the two buckets the panel shows.
    const pending = appts.filter(a => a.status === 'pending');
    const history = appts.filter(a => a.status === 'approved' || a.status === 'rejected');

    const filteredHistory = historyFilter === 'All'
        ? history
        : history.filter(a => a.status === historyFilter.toLowerCase());

    // Pending: filtered by category
    const pendingCategories = ['All', ...Array.from(new Set(pending.map(a => a.category).filter(Boolean))).sort()];
    const filteredPending = categoryFilter === 'All' ? pending : pending.filter(a => a.category === categoryFilter);

    // Stats for progress bar
    const approvedCount = history.filter(a => a.status === 'approved').length;
    const rejectedCount = history.filter(a => a.status === 'rejected').length;
    const totalHandled = pending.length + history.length;
    const approvedPct = totalHandled > 0 ? Math.round((approvedCount / totalHandled) * 100) : 0;
    const rejectedPct = totalHandled > 0 ? Math.round((rejectedCount / totalHandled) * 100) : 0;
    const pendingPct = totalHandled > 0 ? Math.round((pending.length / totalHandled) * 100) : 0;

    const TAB_STYLE = (active) => ({
        padding: '10px 24px', borderRadius: 10, border: 'none',
        fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.2s',
        background: active ? 'linear-gradient(135deg, #0D47A1, #1976D2)' : '#F1F5F9',
        color: active ? 'white' : '#64748B',
        boxShadow: active ? '0 4px 12px rgba(21,101,192,0.3)' : 'none',
    });

    return (
        <div>
            {prescriptionTarget && (
                <PrescriptionModal
                    appt={prescriptionTarget}
                    onClose={() => setPrescriptionTarget(null)}
                    onSaved={() => setPrescriptionTarget(null)}
                />
            )}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1>Doctor Panel</h1>
                        <p>Review appointments and view patient history</p>
                    </div>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => load({ silent: true })}
                        disabled={loading || refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <RefreshCw size={14} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                        {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="page-body">
                {/* Action error banner */}
                {actionError && (
                    <div style={{
                        background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10,
                        padding: '12px 16px', marginBottom: 16, color: '#C62828', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    }}>
                        <span>{actionError}</span>
                        <button className="btn btn-outline btn-sm" onClick={() => setActionError('')}>Dismiss</button>
                    </div>
                )}

                {/* Stats Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
                    {[
                        { label: 'Pending', value: pending.length, color: '#F57C00', bg: '#FFF8E1', icon: '⏳' },
                        { label: 'Approved', value: approvedCount, color: '#2E7D32', bg: '#E8F5E9', icon: '✓' },
                        { label: 'Rejected', value: rejectedCount, color: '#C62828', bg: '#FFEBEE', icon: '✗' },
                        { label: 'Total Treated', value: history.length, color: '#0277BD', bg: '#E1F5FE', icon: '🏥' },
                    ].map(stat => (
                        <div key={stat.label} style={{ background: stat.bg, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ fontSize: 26 }}>{stat.icon}</div>
                            <div>
                                <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                <div style={{ fontSize: 13, color: stat.color, opacity: 0.85 }}>{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Progress bar */}
                {totalHandled > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>Appointment Breakdown</span>
                            <span style={{ fontSize: 12, color: '#94A3B8' }}>{totalHandled} total</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 20, overflow: 'hidden', display: 'flex', background: '#E2E8F0' }}>
                            {approvedPct > 0 && <div style={{ width: `${approvedPct}%`, background: '#4CAF50', transition: 'width 0.8s ease' }} title={`Approved: ${approvedPct}%`} />}
                            {pendingPct > 0 && <div style={{ width: `${pendingPct}%`, background: '#F59E0B', transition: 'width 0.8s ease' }} title={`Pending: ${pendingPct}%`} />}
                            {rejectedPct > 0 && <div style={{ width: `${rejectedPct}%`, background: '#EF5350', transition: 'width 0.8s ease' }} title={`Rejected: ${rejectedPct}%`} />}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#64748B' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} /> Approved {approvedPct}%</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} /> Pending {pendingPct}%</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF5350', display: 'inline-block' }} /> Rejected {rejectedPct}%</span>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                    <button style={TAB_STYLE(tab === 'pending')} onClick={() => setTab('pending')}>
                        <ClipboardList size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Pending ({pending.length})
                    </button>
                    <button style={TAB_STYLE(tab === 'history')} onClick={() => setTab('history')}>
                        <History size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Patient History ({history.length})
                    </button>
                </div>

                {error && (
                    <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#C62828', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span>Error: {error}</span>
                        <button className="btn btn-outline btn-sm" onClick={() => load()}>Retry</button>
                    </div>
                )}

                {/* ─── PENDING TAB ─── */}
                {tab === 'pending' && (
                    loading ? (
                        <div className="loading-container"><div className="loading-spinner" /><p>Loading...</p></div>
                    ) : (
                        <div>
                            {/* Category filter */}
                            {pendingCategories.length > 1 && (
                                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Filter by specialty:</span>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {pendingCategories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setCategoryFilter(cat)}
                                                style={{
                                                    padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                                                    background: categoryFilter === cat ? '#0D47A1' : '#F1F5F9',
                                                    color: categoryFilter === cat ? 'white' : '#64748B',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                {cat}{cat !== 'All' ? ` (${pending.filter(a => a.category === cat).length})` : ` (${pending.length})`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {filteredPending.length === 0 ? (
                                <div className="card">
                                    <div className="empty-state">
                                        <div className="empty-icon">{categoryFilter === 'All' ? '✅' : '🔍'}</div>
                                        <h3>{categoryFilter === 'All' ? 'All Clear!' : `No ${categoryFilter} Pending`}</h3>
                                        <p>{categoryFilter === 'All' ? 'No pending appointments.' : `No pending appointments for ${categoryFilter}.`}</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {filteredPending.map(appt => (
                                        <div key={appt.id} className="card" style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                                                    {/* Patient */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{
                                                            width: 42, height: 42, borderRadius: '50%',
                                                            background: 'linear-gradient(135deg, #0D47A1, #0277BD)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: 'white', fontWeight: 700, fontSize: 16,
                                                        }}>
                                                            {appt.patientName?.[0]?.toUpperCase() || 'P'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>{appt.patientName}</div>
                                                            <div style={{ fontSize: 12, color: '#64748B' }}>
                                                                {appt.userEmail}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {appt.patientReason && (
                                                        <div style={{
                                                            background: '#F8FAFF', borderRadius: 8, padding: '8px 12px',
                                                            fontSize: 13, color: '#475569', borderLeft: '3px solid #1565C0',
                                                        }}>
                                                            📝 <em>{appt.patientReason}</em>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                                                        {[
                                                            [<Stethoscope size={14} />, appt.doctorName],
                                                            [<Building2 size={14} />, appt.hospital],
                                                            [<CalendarDays size={14} />, `${appt.date} · ${appt.day}`],
                                                            [<Clock size={14} />, appt.time],
                                                        ].map(([icon, text], i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                                                                <span style={{ color: '#0277BD' }}>{icon}</span><span>{text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div>
                                                        <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                                            {appt.category}
                                                        </span>
                                                        <span className="badge badge-pending" style={{ marginLeft: 8 }}>⏳ Pending</span>
                                                    </div>
                                                </div>
                                                {/* Buttons */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 140 }}>
                                                    <button className="btn btn-primary"
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
                                                        onClick={() => handleApprove(appt.id)}
                                                        disabled={approving[appt.id] || rejecting[appt.id]}>
                                                        {approving[appt.id]
                                                            ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Approving…</>
                                                            : <><CheckCircle size={16} /> Approve</>}
                                                    </button>
                                                    <button className="btn btn-danger"
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px' }}
                                                        onClick={() => handleReject(appt.id)}
                                                        disabled={approving[appt.id] || rejecting[appt.id]}>
                                                        {rejecting[appt.id]
                                                            ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Rejecting…</>
                                                            : <>✗ Reject</>}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                )}

                {/* ─── HISTORY TAB ─── */}
                {tab === 'history' && (
                    <div>
                        {/* Filter buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            {['All', 'Approved', 'Rejected'].map(f => (
                                <button key={f} onClick={() => setHistoryFilter(f)} style={{
                                    padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                    fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                                    background: historyFilter === f
                                        ? (f === 'Approved' ? '#E8F5E9' : f === 'Rejected' ? '#FFEBEE' : '#EEF2FF')
                                        : '#F1F5F9',
                                    color: historyFilter === f
                                        ? (f === 'Approved' ? '#2E7D32' : f === 'Rejected' ? '#C62828' : '#4338CA')
                                        : '#64748B',
                                }}>
                                    {f === 'Approved' ? '✓ ' : f === 'Rejected' ? '✗ ' : ''}{f}
                                    {f === 'All' ? ` (${history.length})` : ` (${history.filter(a => a.status === f.toLowerCase()).length})`}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="loading-container"><div className="loading-spinner" /><p>Loading history...</p></div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="card">
                                <div className="empty-state">
                                    <div className="empty-icon">📋</div>
                                    <h3>No Records Yet</h3>
                                    <p>No {historyFilter !== 'All' ? historyFilter.toLowerCase() : ''} appointments found.</p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {filteredHistory.map(appt => (
                                    <div key={appt.id}>
                                        <HistoryCard appt={appt} />
                                        {appt.status === 'approved' && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                                                <button
                                                    onClick={() => setPrescriptionTarget(appt)}
                                                    style={{
                                                        background: '#F0FDF4',
                                                        color: '#2E7D32',
                                                        border: '1.5px solid #A5D6A7',
                                                        borderRadius: 8, padding: '6px 14px',
                                                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                                                    }}
                                                >
                                                    <FileText size={14} />
                                                    Write Prescription
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
