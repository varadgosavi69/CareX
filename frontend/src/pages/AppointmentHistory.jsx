import React, { useEffect, useState, useCallback } from 'react';
import * as appointmentService from '../api/services/appointmentService';
import * as reportService from '../api/services/reportService';
import * as ratingService from '../api/services/ratingService';
import * as prescriptionService from '../api/services/prescriptionService';
import { apiErrorMessage } from '../api/client';
import {
    ClipboardList, X, XCircle, Star, FileText,
    Upload, Eye, TrendingUp, RefreshCw,
    Search as SearchIcon, Zap, Loader2, CheckCircle,
} from 'lucide-react';

// Status metadata keyed by the API's lowercase enum
// (pending | approved | rejected | cancelled | completed).
const STATUS_META = {
    pending: { label: '⏳ Pending', badge: 'badge-pending', border: '#FFE082', bg: '#FFF8E1', txt: '#E65100', dot: '#E65100' },
    approved: { label: '✓ Approved', badge: 'badge-approved', border: '#A5D6A7', bg: '#E8F5E9', txt: '#2E7D32', dot: '#2E7D32' },
    completed: { label: '🏁 Completed', badge: 'badge-approved', border: '#A5D6A7', bg: '#E8F5E9', txt: '#2E7D32', dot: '#2E7D32' },
    rejected: { label: '✗ Rejected', badge: 'badge-rejected', border: '#EF9A9A', bg: '#FFEBEE', txt: '#C62828', dot: '#C62828' },
    cancelled: { label: '🚫 Cancelled', badge: 'badge-cancelled', border: '#E0E7FF', bg: '#F8FAFF', txt: '#64748B', dot: '#64748B' },
};

const metaFor = (status) => STATUS_META[status] || STATUS_META.pending;

// Flatten a populated API appointment into the shape the UI renders.
const normalizeAppt = (a) => {
    const d = a.scheduledAt ? new Date(a.scheduledAt) : null;
    const valid = d && !Number.isNaN(d.getTime());
    return {
        id: a._id,
        status: a.status,
        scheduledAt: a.scheduledAt,
        date: valid ? d.toLocaleDateString('en-CA') : '', // YYYY-MM-DD (local)
        time: a.slot || (valid ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
        doctorId: a.doctor?._id,
        doctorName: a.doctor?.user?.name || 'Doctor',
        category: a.category || a.doctor?.specialty || '',
        hospital: a.location?.address || '',
        patientName: a.patient?.name || '',
        reason: a.reason || '',
        consultationFee: a.consultationFee,
    };
};

// ─── Star Rating Component ────────────────────────────────────────────────────
// One rating per appointment, only for COMPLETED appointments. Disables once
// rated; a 409 from the API (already rated) is also treated as "done".
function StarRating({ appointmentId, alreadyRated, onRated }) {
    const [hovered, setHovered] = useState(0);
    const [selected, setSelected] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(!!alreadyRated);
    const [error, setError] = useState('');

    const handleRate = async (stars) => {
        if (done || submitting) return;
        setSelected(stars);
        setSubmitting(true);
        setError('');
        try {
            await ratingService.create({ appointmentId, stars });
            setDone(true);
            onRated?.(appointmentId, stars);
        } catch (e) {
            if (e?.response?.status === 409) {
                // Already rated — enforce one-per-appointment client-side too.
                setDone(true);
                onRated?.(appointmentId, stars);
            } else {
                setError(apiErrorMessage(e, 'Could not submit rating'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={16}
                        fill={i <= selected ? '#F59E0B' : 'none'}
                        color={i <= selected ? '#F59E0B' : '#CBD5E1'}
                    />
                ))}
                <span style={{ fontSize: 12, color: '#64748B' }}>Rated!</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748B', marginRight: 4 }}>Rate:</span>
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={18}
                    style={{ cursor: submitting ? 'default' : 'pointer', transition: 'transform 0.1s' }}
                    fill={i <= (hovered || selected) ? '#F59E0B' : 'none'}
                    color={i <= (hovered || selected) ? '#F59E0B' : '#CBD5E1'}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => handleRate(i)}
                />
            ))}
            {submitting && <span style={{ fontSize: 11, color: '#94A3B8' }}>Saving…</span>}
            {error && <span style={{ fontSize: 11, color: '#C62828' }}>{error}</span>}
        </div>
    );
}

// ─── Cancel Confirm Modal ─────────────────────────────────────────────────────
function CancelModal({ appt, onConfirm, onClose, cancelling, error }) {
    if (!appt) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                <div className="modal-banner" style={{ background: 'linear-gradient(135deg,#C62828,#E53935)' }}>
                    <div className="modal-banner-icon pop-in">
                        <XCircle size={38} color="white" />
                    </div>
                    <h3 className="modal-banner-title">Cancel Appointment?</h3>
                </div>
                <div className="modal-body">
                    <p className="modal-message" style={{ color: '#475569' }}>
                        Are you sure you want to cancel your appointment with{' '}
                        <strong>{appt.doctorName}</strong> on <strong>{appt.date}</strong> at{' '}
                        <strong>{appt.time}</strong>?
                    </p>
                    {error && (
                        <div style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginTop: 12 }}>
                            {error}
                        </div>
                    )}
                    <div className="modal-actions" style={{ marginTop: 20 }}>
                        <button
                            className="btn btn-sm"
                            style={{ background: '#C62828', color: 'white', borderRadius: 8, padding: '8px 20px', fontWeight: 600 }}
                            onClick={onConfirm}
                            disabled={cancelling}
                        >
                            {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={onClose} disabled={cancelling}>
                            Keep It
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Report Upload Modal ──────────────────────────────────────────────────────
// Uploads via multipart/form-data (reportService.upload -> POST /api/reports).
function ReportUploadModal({ apptId, onClose, onUploaded }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [uploaded, setUploaded] = useState(null);

    const handleUpload = async () => {
        if (!file) { setError('Please select a file.'); return; }
        if (file.size > 5 * 1024 * 1024) { setError('File must be under 5MB.'); return; }
        setUploading(true);
        setError('');
        try {
            const report = await reportService.upload(file, { appointmentId: apptId });
            setUploaded(report);
            onUploaded?.(report);
        } catch (e) {
            setError(apiErrorMessage(e, 'Upload failed'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div className="modal-banner" style={{ background: 'linear-gradient(135deg,#0D47A1,#0097A7)' }}>
                    <div className="modal-banner-icon pop-in">
                        <Upload size={34} color="white" />
                    </div>
                    <h3 className="modal-banner-title">Upload Medical Report</h3>
                </div>
                <div className="modal-body">
                    {uploaded ? (
                        <div>
                            <div style={{ background: '#E8F5E9', color: '#2E7D32', borderRadius: 10, padding: '14px 16px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle size={18} /> Report uploaded successfully.
                            </div>
                            <a href={uploaded.fileUrl} target="_blank" rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, color: '#0277BD', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                                <Eye size={15} /> View uploaded report
                            </a>
                            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, wordBreak: 'break-all' }}>{uploaded.fileUrl}</p>
                            <div className="modal-actions" style={{ marginTop: 16 }}>
                                <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="form-group">
                                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Select File (PDF, JPG, PNG — max 5MB)</label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => { setFile(e.target.files[0]); setError(''); }}
                                    style={{ width: '100%', fontSize: 13 }}
                                />
                                {file && <p style={{ fontSize: 12, color: '#2E7D32', marginTop: 6 }}>✓ {file.name}</p>}
                            </div>
                            {error && (
                                <div style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
                                    {error}
                                </div>
                            )}
                            <div className="modal-actions">
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleUpload}
                                    disabled={uploading || !file}
                                >
                                    {uploading ? 'Uploading…' : 'Upload Report'}
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={onClose} disabled={uploading}>Cancel</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Prescription View Modal ──────────────────────────────────────────────────
// Renders medicines[] + notes from GET /api/appointments/:id/prescription, with
// clean loading / empty / error states.
function PrescriptionModal({ state, onClose }) {
    if (!state) return null;
    const { loading, data, empty, error, doctorName } = state;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                <div className="modal-banner" style={{ background: 'linear-gradient(135deg,#2E7D32,#43A047)' }}>
                    <div className="modal-banner-icon pop-in">
                        <FileText size={34} color="white" />
                    </div>
                    <h3 className="modal-banner-title">Prescription</h3>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: '#64748B', fontSize: 14 }}>
                            <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading prescription…
                        </div>
                    ) : error ? (
                        <div style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
                            {error}
                        </div>
                    ) : empty ? (
                        <div className="empty-state" style={{ padding: '20px 0' }}>
                            <div className="empty-icon">📝</div>
                            <h3>No Prescription Yet</h3>
                            <p>Your doctor hasn’t added a prescription for this appointment.</p>
                        </div>
                    ) : data ? (
                        <>
                            <div style={{ background: '#F8FAFF', borderRadius: 12, padding: '16px 18px', border: '1px solid #E0E7FF' }}>
                                {Array.isArray(data.medicines) && data.medicines.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {data.medicines.map((m, i) => (
                                            <div key={i} style={{ borderBottom: i < data.medicines.length - 1 ? '1px dashed #E0E7FF' : 'none', paddingBottom: i < data.medicines.length - 1 ? 12 : 0 }}>
                                                <p style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', margin: 0 }}>💊 {m.name}</p>
                                                <div style={{ fontSize: 13, color: '#475569', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                                    {m.dosage && <span>⚖️ {m.dosage}</span>}
                                                    {m.frequency && <span>🕒 {m.frequency}</span>}
                                                    {m.duration && <span>📆 {m.duration}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>No medicines listed.</p>
                                )}
                                {data.notes && (
                                    <div style={{ marginTop: 14 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Doctor Notes</span>
                                        <p style={{ fontSize: 14, color: '#475569', marginTop: 4, lineHeight: 1.6 }}>📝 {data.notes}</p>
                                    </div>
                                )}
                            </div>
                            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 12, textAlign: 'center' }}>
                                Prescribed by {data.doctor?.user?.name || doctorName}
                            </p>
                        </>
                    ) : null}
                    <div className="modal-actions" style={{ marginTop: 16 }}>
                        <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AppointmentHistory() {
    const [appointments, setAppointments] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [ratedAppts, setRatedAppts] = useState(() => new Set());

    // Modals
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState('');
    const [uploadTarget, setUploadTarget] = useState(null); // apptId
    const [prescriptionState, setPrescriptionState] = useState(null);

    // Fetch appointments + reports from the REST API.
    const load = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true); else setLoading(true);
        setError('');
        try {
            const [apptRes, reportList] = await Promise.all([
                appointmentService.list({ limit: 50 }),
                reportService.list().catch(() => []), // reports are best-effort
            ]);
            setAppointments((apptRes.appointments || []).map(normalizeAppt));
            setReports(reportList || []);
        } catch (e) {
            setError(apiErrorMessage(e, 'Could not load appointments'));
        } finally {
            if (silent) setRefreshing(false); else setLoading(false);
        }
    }, []);

    // Initial load.
    useEffect(() => { load(); }, [load]);

    // Refetch when the window regains focus (live onSnapshot is intentionally
    // replaced by fetch + manual/refocus refresh).
    useEffect(() => {
        const onFocus = () => load({ silent: true });
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [load]);

    const refreshReports = useCallback(async () => {
        try {
            const list = await reportService.list();
            setReports(list || []);
        } catch { /* keep existing reports on failure */ }
    }, []);

    const handleCancelConfirm = async () => {
        if (!cancelTarget) return;
        setCancelling(true);
        setCancelError('');
        try {
            const updated = await appointmentService.cancel(cancelTarget.id);
            setAppointments(prev => prev.map(a => (a.id === updated._id ? normalizeAppt(updated) : a)));
            setCancelTarget(null);
        } catch (e) {
            setCancelError(apiErrorMessage(e, 'Could not cancel appointment'));
        } finally {
            setCancelling(false);
        }
    };

    const openPrescription = async (appt) => {
        setPrescriptionState({ loading: true, data: null, empty: false, error: '', doctorName: appt.doctorName });
        try {
            const p = await prescriptionService.get(appt.id);
            setPrescriptionState({ loading: false, data: p, empty: false, error: '', doctorName: appt.doctorName });
        } catch (e) {
            if (e?.response?.status === 404) {
                setPrescriptionState({ loading: false, data: null, empty: true, error: '', doctorName: appt.doctorName });
            } else {
                setPrescriptionState({ loading: false, data: null, empty: false, error: apiErrorMessage(e, 'Could not load prescription'), doctorName: appt.doctorName });
            }
        }
    };

    const stats = {
        total: appointments.length,
        approved: appointments.filter(a => a.status === 'approved').length,
        completed: appointments.filter(a => a.status === 'completed').length,
        pending: appointments.filter(a => a.status === 'pending').length,
        rejected: appointments.filter(a => a.status === 'rejected').length,
        cancelled: appointments.filter(a => a.status === 'cancelled').length,
    };

    // Health score: kept (approved + completed) vs missed (cancelled + rejected).
    const kept = stats.approved + stats.completed;
    const missed = stats.cancelled + stats.rejected;
    const healthScore = stats.total === 0 ? null
        : Math.max(0, Math.min(100, Math.round(((kept * 2 - missed) / Math.max(stats.total * 2, 1)) * 100)));
    const healthLabel = healthScore === null ? null
        : healthScore >= 80 ? { text: 'Excellent', color: '#2E7D32', bg: '#E8F5E9' }
            : healthScore >= 60 ? { text: 'Good', color: '#0277BD', bg: '#E1F5FE' }
                : healthScore >= 40 ? { text: 'Fair', color: '#E65100', bg: '#FFF8E1' }
                    : { text: 'Needs Attention', color: '#C62828', bg: '#FFEBEE' };

    const getDaysAway = (dateStr) => {
        if (!dateStr) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const apptDate = new Date(dateStr); apptDate.setHours(0, 0, 0, 0);
        return Math.round((apptDate - today) / (1000 * 60 * 60 * 24));
    };

    const FILTER_TABS = [
        { key: 'all', label: 'All', count: stats.total },
        { key: 'approved', label: '✓ Approved', count: stats.approved },
        { key: 'completed', label: '🏁 Completed', count: stats.completed },
        { key: 'pending', label: '⏳ Pending', count: stats.pending },
        { key: 'rejected', label: '✗ Rejected', count: stats.rejected },
        { key: 'cancelled', label: '🚫 Cancelled', count: stats.cancelled },
        { key: 'timeline', label: '📅 Timeline', count: null },
    ];

    const STATUS_TAB_COLORS = {
        all: '#1565C0', approved: '#2E7D32', completed: '#00695C',
        pending: '#E65100', rejected: '#C62828', cancelled: '#64748B', timeline: '#6D28D9',
    };

    const getFilteredAppointments = () => {
        let list = [...appointments];
        if (activeTab !== 'all' && activeTab !== 'timeline') {
            list = list.filter(a => a.status === activeTab);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(a =>
                a.doctorName?.toLowerCase().includes(q) ||
                a.category?.toLowerCase().includes(q) ||
                a.hospital?.toLowerCase().includes(q) ||
                a.patientName?.toLowerCase().includes(q)
            );
        }
        return list;
    };

    // ─── Timeline View (client-side, from API data) ────────────────────────────
    const getTimelineData = () => {
        const apptItems = appointments.map(a => ({
            date: a.date,
            type: 'appointment',
            label: `${a.category || 'Appointment'} — ${a.doctorName}`,
            detail: `${a.hospital ? a.hospital + ' · ' : ''}${a.time}`,
            status: a.status,
            icon: '🏥',
        }));
        const reportItems = reports.map(r => {
            const d = r.uploadedAt ? new Date(r.uploadedAt) : null;
            return {
                date: d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-CA') : 'Unknown',
                type: 'report',
                label: 'Report uploaded',
                detail: r.fileName || 'Medical report',
                status: 'report',
                icon: '📄',
                url: r.fileUrl,
            };
        });
        const all = [...apptItems, ...reportItems].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const grouped = {};
        all.forEach(item => {
            const year = item.date?.slice(0, 4) || 'Unknown';
            if (!grouped[year]) grouped[year] = [];
            grouped[year].push(item);
        });
        return grouped;
    };

    return (
        <div>
            <CancelModal
                appt={cancelTarget}
                onConfirm={handleCancelConfirm}
                onClose={() => { setCancelTarget(null); setCancelError(''); }}
                cancelling={cancelling}
                error={cancelError}
            />
            {uploadTarget && (
                <ReportUploadModal
                    apptId={uploadTarget}
                    onClose={() => setUploadTarget(null)}
                    onUploaded={refreshReports}
                />
            )}
            {prescriptionState && (
                <PrescriptionModal
                    state={prescriptionState}
                    onClose={() => setPrescriptionState(null)}
                />
            )}

            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1>Appointment History</h1>
                        <p>View, rate, and manage all your appointments</p>
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
                {/* Health Score Widget */}
                {healthScore !== null && healthLabel && (
                    <div style={{
                        background: healthLabel.bg, border: `1.5px solid ${healthLabel.color}40`,
                        borderRadius: 16, padding: '16px 20px', marginBottom: 20,
                        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                    }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: '50%',
                            background: `conic-gradient(${healthLabel.color} ${healthScore * 3.6}deg, #E2E8F0 0deg)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: '50%',
                                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 13, color: healthLabel.color,
                            }}>{healthScore}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <TrendingUp size={15} color={healthLabel.color} />
                                <span style={{ fontWeight: 800, fontSize: 15, color: healthLabel.color }}>Health Score: {healthLabel.text}</span>
                            </div>
                            <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                                Based on {kept} kept appointment{kept !== 1 ? 's' : ''} vs {missed} missed/cancelled.
                                Keep attending your appointments to improve your score!
                            </p>
                        </div>
                        <Zap size={20} color={healthLabel.color} style={{ opacity: 0.6 }} />
                    </div>
                )}

                {/* Stats Row */}
                <div className="stat-row" style={{ marginBottom: 24 }}>
                    {[
                        { label: 'Total', value: stats.total, icon: <ClipboardList size={22} />, cls: 'blue' },
                        { label: 'Approved', value: stats.approved, icon: '✓', cls: 'green' },
                        { label: 'Completed', value: stats.completed, icon: '🏁', cls: 'green' },
                        { label: 'Pending', value: stats.pending, icon: '⏳', cls: 'orange' },
                        { label: 'Cancelled', value: stats.cancelled, icon: '🚫', cls: '' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <div className={`stat-icon ${s.cls}`} style={!s.cls ? { background: '#F1F5F9', color: '#64748B', fontWeight: 700, fontSize: 18 } : {}}>
                                {s.icon}
                            </div>
                            <div>
                                <div className="stat-value">{s.value}</div>
                                <div className="stat-label">{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter Tabs + Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                        {FILTER_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    padding: '7px 14px', borderRadius: 20, border: 'none',
                                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                                    background: activeTab === tab.key ? STATUS_TAB_COLORS[tab.key] : '#F1F5F9',
                                    color: activeTab === tab.key ? 'white' : '#64748B',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative', minWidth: 220 }}>
                        <SearchIcon size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search appointments…"
                            style={{
                                padding: '8px 12px 8px 30px', border: '2px solid #E0E7FF',
                                borderRadius: 20, fontSize: 13, outline: 'none',
                                fontFamily: 'inherit', width: '100%', color: '#1E293B', background: 'white',
                            }}
                        />
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#C62828', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span>Error: {error}</span>
                        <button className="btn btn-outline btn-sm" onClick={() => load()}>Retry</button>
                    </div>
                )}

                {loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner" />
                        <p>Loading appointments...</p>
                    </div>
                ) : activeTab === 'timeline' ? (
                    /* ─── TIMELINE VIEW ─── */
                    <div>
                        {(() => {
                            const grouped = getTimelineData();
                            const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
                            if (years.length === 0) {
                                return (
                                    <div className="card">
                                        <div className="empty-state">
                                            <div className="empty-icon">📅</div>
                                            <h3>No Timeline Yet</h3>
                                            <p>Book appointments and upload reports to build your health timeline.</p>
                                        </div>
                                    </div>
                                );
                            }
                            return years.map(year => (
                                <div key={year} style={{ marginBottom: 32 }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 10,
                                        background: 'linear-gradient(135deg,#0D47A1,#0097A7)',
                                        color: 'white', padding: '6px 20px', borderRadius: 20,
                                        fontWeight: 800, fontSize: 16, marginBottom: 16,
                                    }}>
                                        📅 {year}
                                    </div>
                                    <div style={{ borderLeft: '3px solid #E0E7FF', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {grouped[year].map((item, i) => (
                                            <div key={i} style={{ position: 'relative' }}>
                                                <div style={{
                                                    position: 'absolute', left: -33, top: 14,
                                                    width: 14, height: 14, borderRadius: '50%',
                                                    background: item.type === 'report' ? '#0097A7' : metaFor(item.status).dot,
                                                    border: '3px solid white', boxShadow: '0 0 0 2px #E0E7FF',
                                                }} />
                                                <div className="card" style={{
                                                    padding: '14px 18px',
                                                    border: `1.5px solid ${item.type === 'report' ? '#B2EBF2' : '#E0E7FF'}`,
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <span style={{ fontSize: 20 }}>{item.icon}</span>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{item.label}</div>
                                                                <div style={{ fontSize: 12, color: '#64748B' }}>{item.date} · {item.detail}</div>
                                                            </div>
                                                        </div>
                                                        {item.type === 'report' && item.url && (
                                                            <a href={item.url} target="_blank" rel="noreferrer" style={{
                                                                fontSize: 12, color: '#0277BD', display: 'flex', alignItems: 'center', gap: 4,
                                                                textDecoration: 'none', fontWeight: 600,
                                                            }}>
                                                                <Eye size={13} /> View
                                                            </a>
                                                        )}
                                                        {item.type === 'appointment' && (
                                                            <span className={`badge ${metaFor(item.status).badge}`}>
                                                                {item.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="card">
                        <div className="empty-state">
                            <div className="empty-icon">📋</div>
                            <h3>No Appointments Yet</h3>
                            <p>Book your first appointment from the Book Appointment tab.</p>
                        </div>
                    </div>
                ) : (
                    /* ─── APPOINTMENT CARDS ─── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {getFilteredAppointments().length === 0 ? (
                            <div className="card">
                                <div className="empty-state">
                                    <div className="empty-icon">🔍</div>
                                    <h3>No Results</h3>
                                    <p>No appointments match your search or filter.</p>
                                </div>
                            </div>
                        ) : getFilteredAppointments().map(appt => {
                            const sc = metaFor(appt.status);
                            const apptReports = reports.filter(r => r.appointment === appt.id);
                            const daysAway = getDaysAway(appt.date);
                            const isFuture = daysAway !== null && daysAway >= 0;
                            const cancellable = (appt.status === 'pending' || appt.status === 'approved') && isFuture;
                            const canViewPrescription = appt.status === 'approved' || appt.status === 'completed';

                            return (
                                <div key={appt.id} style={{
                                    background: 'white', borderRadius: 16,
                                    border: `2px solid ${sc.border}`,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden',
                                }}>
                                    {/* Status bar */}
                                    <div style={{
                                        background: sc.bg, padding: '10px 20px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span className={`badge ${sc.badge}`}>{sc.label}</span>
                                            {appt.status === 'approved' && isFuture && (
                                                <span style={{
                                                    background: daysAway === 0 ? '#00695C' : '#0D47A1',
                                                    color: 'white', fontSize: 11, fontWeight: 700,
                                                    padding: '3px 10px', borderRadius: 20,
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                }}>
                                                    {daysAway === 0 ? '🎯 Today!' : `📅 ${daysAway} day${daysAway !== 1 ? 's' : ''} away`}
                                                </span>
                                            )}
                                            <span style={{ fontSize: 12, color: sc.txt, fontWeight: 600 }}>
                                                {appt.date} · {appt.time}
                                            </span>
                                        </div>
                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {cancellable && (
                                                <button
                                                    onClick={() => { setCancelError(''); setCancelTarget(appt); }}
                                                    style={{
                                                        background: '#FFEBEE', color: '#C62828',
                                                        border: '1px solid #EF9A9A', borderRadius: 7,
                                                        padding: '4px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            {canViewPrescription && (
                                                <button
                                                    onClick={() => openPrescription(appt)}
                                                    style={{
                                                        background: '#E8F5E9', color: '#2E7D32',
                                                        border: '1px solid #A5D6A7', borderRadius: 7,
                                                        padding: '4px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                    }}
                                                >
                                                    <FileText size={12} /> Prescription
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setUploadTarget(appt.id)}
                                                style={{
                                                    background: '#E1F5FE', color: '#0277BD',
                                                    border: '1px solid #B3E5FC', borderRadius: 7,
                                                    padding: '4px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                }}
                                            >
                                                <Upload size={12} /> Upload Report
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card body */}
                                    <div style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                            <div style={{
                                                width: 48, height: 48, borderRadius: '50%',
                                                background: 'linear-gradient(135deg,#0D47A1,#0097A7)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0,
                                            }}>
                                                {appt.doctorName?.split(' ').filter(w => w !== 'Dr.').map(w => w[0]).join('').slice(0, 2)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{appt.doctorName}</div>
                                                <div style={{ fontSize: 13, color: '#64748B', marginBottom: 6 }}>
                                                    {appt.hospital ? `${appt.hospital} · ` : ''}{appt.category}
                                                    {typeof appt.consultationFee === 'number' && appt.consultationFee > 0 && ` · ₹${appt.consultationFee}`}
                                                </div>
                                                {appt.patientName && (
                                                    <div style={{ fontSize: 13, color: '#475569' }}>👤 {appt.patientName}</div>
                                                )}
                                                {appt.reason && (
                                                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontStyle: 'italic' }}>
                                                        📝 {appt.reason}
                                                    </div>
                                                )}

                                                {/* Rating — only for COMPLETED appointments */}
                                                {appt.status === 'completed' && (
                                                    <div style={{ marginTop: 10 }}>
                                                        <StarRating
                                                            appointmentId={appt.id}
                                                            alreadyRated={ratedAppts.has(appt.id)}
                                                            onRated={(id) => setRatedAppts(prev => new Set(prev).add(id))}
                                                        />
                                                    </div>
                                                )}

                                                {/* Uploaded reports for this appointment */}
                                                {apptReports.length > 0 && (
                                                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {apptReports.map(r => (
                                                            <a key={r._id} href={r.fileUrl} target="_blank" rel="noreferrer"
                                                                style={{
                                                                    background: '#F0FDF4', border: '1px solid #A7F3D0',
                                                                    color: '#065F46', borderRadius: 8,
                                                                    padding: '3px 10px', fontSize: 12, fontWeight: 600,
                                                                    display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none',
                                                                }}
                                                            >
                                                                <FileText size={11} /> {r.fileName || 'Report'}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
