import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase';
import {
    collection, query, where, orderBy, onSnapshot,
    addDoc, serverTimestamp, updateDoc, doc, getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    ClipboardList, CalendarDays, Clock, User, Stethoscope,
    CheckCircle, X, Sparkles, XCircle, Star, FileText,
    Upload, Eye, History, Activity, Filter,
    Search as SearchIcon, Download, AlertCircle, Zap, TrendingUp
} from 'lucide-react';

const STATUS_STYLES = {
    Approved: 'badge-approved',
    Rejected: 'badge-rejected',
    Pending: 'badge-pending',
    Cancelled: 'badge-cancelled',
};

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ doctorId, doctorName, category, existingRating, onRated }) {
    const [hovered, setHovered] = useState(0);
    const [selected, setSelected] = useState(existingRating || 0);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(!!existingRating);
    const { user } = useAuth();

    const handleRate = async (stars) => {
        if (done) return;
        setSelected(stars);
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'Ratings'), {
                doctorId, doctorName, category,
                patientId: user.uid, patientEmail: user.email,
                rating: stars,
                timestamp: serverTimestamp(),
            });
            setDone(true);
            onRated && onRated(stars);
        } catch (e) {
            console.error(e);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#64748B', marginRight: 4 }}>Rate:</span>
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={18}
                    style={{ cursor: submitting ? 'default' : 'pointer', transition: 'transform 0.1s' }}
                    fill={i <= (hovered || selected) ? '#F59E0B' : 'none'}
                    color={i <= (hovered || selected) ? '#F59E0B' : '#CBD5E1'}
                    onMouseEnter={() => !done && setHovered(i)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => handleRate(i)}
                />
            ))}
            {submitting && <span style={{ fontSize: 11, color: '#94A3B8' }}>Saving…</span>}
        </div>
    );
}

// ─── Floating Approval Toast ─────────────────────────────────────────────────
function ApprovalToast({ toasts, onDismiss }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className="toast-notification toast-approved">
                    <CheckCircle size={20} style={{ flexShrink: 0, color: '#2E7D32' }} />
                    <div className="toast-text">
                        <strong>Appointment Approved!</strong>
                        <p>{t.message}</p>
                    </div>
                    <button className="toast-close" onClick={() => onDismiss(t.id)}>
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}

// ─── Cancel Confirm Modal ─────────────────────────────────────────────────────
function CancelModal({ appt, onConfirm, onClose, cancelling }) {
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
function ReportUploadModal({ apptId, onClose, onUploaded }) {
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [reportType, setReportType] = useState('Blood Test');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const REPORT_TYPES = ['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Prescription', 'Other'];

    const handleUpload = async () => {
        if (!file) { setError('Please select a file.'); return; }
        if (file.size > 5 * 1024 * 1024) { setError('File must be under 5MB.'); return; }
        setUploading(true);
        setError('');
        try {
            const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            await addDoc(collection(db, 'Reports'), {
                patientId: user.uid,
                appointmentId: apptId,
                reportType,
                fileName: file.name,
                reportURL: url,
                uploadedAt: serverTimestamp(),
            });
            onUploaded();
            onClose();
        } catch (e) {
            setError('Upload failed: ' + (e.message || 'Unknown error'));
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
                    <div className="form-group">
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Report Type</label>
                        <select
                            value={reportType}
                            onChange={e => setReportType(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', border: '2px solid #E0E7FF', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, outline: 'none' }}
                        >
                            {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
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
                </div>
            </div>
        </div>
    );
}

// ─── Prescription View Modal ──────────────────────────────────────────────────
function PrescriptionModal({ prescription, onClose }) {
    if (!prescription) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                <div className="modal-banner" style={{ background: 'linear-gradient(135deg,#2E7D32,#43A047)' }}>
                    <div className="modal-banner-icon pop-in">
                        <FileText size={34} color="white" />
                    </div>
                    <h3 className="modal-banner-title">Your Prescription</h3>
                </div>
                <div className="modal-body">
                    <div style={{ background: '#F8FAFF', borderRadius: 12, padding: '16px 18px', border: '1px solid #E0E7FF' }}>
                        {prescription.medicine && (
                            <div style={{ marginBottom: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Medicine</span>
                                <p style={{ fontWeight: 600, fontSize: 15, color: '#0F172A', marginTop: 2 }}>💊 {prescription.medicine}</p>
                            </div>
                        )}
                        {prescription.dosage && (
                            <div style={{ marginBottom: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Dosage</span>
                                <p style={{ fontWeight: 600, fontSize: 15, color: '#0F172A', marginTop: 2 }}>⚖️ {prescription.dosage}</p>
                            </div>
                        )}
                        {prescription.notes && (
                            <div style={{ marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Doctor Notes</span>
                                <p style={{ fontSize: 14, color: '#475569', marginTop: 4, lineHeight: 1.6 }}>📝 {prescription.notes}</p>
                            </div>
                        )}
                    </div>
                    <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 12, textAlign: 'center' }}>
                        Prescribed by {prescription.doctorName}
                    </p>
                    <div className="modal-actions" style={{ marginTop: 16 }}>
                        <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const DEMO_APPOINTMENTS = [
    { doctorName: 'Dr. Arjun Verma', specialization: 'MBBS', hospital: 'Apollo Hospitals', category: 'MBBS', patientName: '', date: '2026-02-10', day: 'Tuesday', time: '09:00 AM', status: 'Approved' },
    { doctorName: 'Dr. Deepak Mathur', specialization: 'Cardiologist', hospital: 'Fortis Healthcare', category: 'Cardiologist', patientName: '', date: '2026-02-14', day: 'Saturday', time: '10:30 AM', status: 'Approved' },
    { doctorName: 'Dr. Shruti Agarwal', specialization: 'Dermatologist', hospital: 'AIIMS', category: 'Dermatologist', patientName: '', date: '2026-02-20', day: 'Friday', time: '11:00 AM', status: 'Rejected' },
    { doctorName: 'Dr. Geeta Varma', specialization: 'Pediatrician', hospital: 'Manipal Hospital', category: 'Pediatrician', patientName: '', date: '2026-02-25', day: 'Wednesday', time: '02:00 PM', status: 'Approved' },
    { doctorName: 'Dr. Siddharth Jain', specialization: 'Neurologist', hospital: 'Max Super Speciality', category: 'Neurologist', patientName: '', date: '2026-03-01', day: 'Sunday', time: '04:00 PM', status: 'Rejected' },
    { doctorName: 'Dr. Neha Kapoor', specialization: 'BDS', hospital: 'Columbia Asia', category: 'BDS', patientName: '', date: '2026-03-03', day: 'Tuesday', time: '09:30 AM', status: 'Pending' },
    { doctorName: 'Dr. Shobha Menon', specialization: 'Gynecologist', hospital: 'Cloudnine Hospital', category: 'Gynecologist', patientName: '', date: '2026-03-05', day: 'Thursday', time: '11:30 AM', status: 'Pending' },
    { doctorName: 'Dr. Rajiv Tandon', specialization: 'Orthopedic', hospital: 'Care Hospitals', category: 'Orthopedic', patientName: '', date: '2026-03-07', day: 'Saturday', time: '03:00 PM', status: 'Pending' },
];

export default function AppointmentHistory() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toasts, setToasts] = useState([]);
    const [seeding, setSeeding] = useState(false);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'timeline' | status filters
    const [searchQuery, setSearchQuery] = useState('');
    const [reports, setReports] = useState([]);
    const [userRatings, setUserRatings] = useState({}); // apptId -> stars
    const prevStatuses = useRef({});
    const isFirstLoad = useRef(true);

    // Modals
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [uploadTarget, setUploadTarget] = useState(null); // apptId
    const [prescriptionTarget, setPrescriptionTarget] = useState(null); // prescription object

    const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const seedDemoAppointments = async () => {
        setSeeding(true);
        const name = user.displayName || user.email?.split('@')[0] || 'Patient';
        try {
            await Promise.all(DEMO_APPOINTMENTS.map(appt =>
                addDoc(collection(db, 'Appointments'), {
                    ...appt,
                    patientName: name,
                    userId: user.uid,
                    userEmail: user.email,
                    doctorId: `demo-${appt.category}`,
                    timestamp: serverTimestamp(),
                })
            ));
        } catch (e) {
            console.error('Seed error', e);
        } finally {
            setSeeding(false);
        }
    };

    const handleCancelConfirm = async () => {
        if (!cancelTarget) return;
        setCancelling(true);
        try {
            await updateDoc(doc(db, 'Appointments', cancelTarget.id), { status: 'Cancelled' });
        } catch (err) {
            console.error('Cancel error', err);
        } finally {
            setCancelling(false);
            setCancelTarget(null);
        }
    };

    // Load appointments
    useEffect(() => {
        let unsubscribe = () => { };
        const startListener = (withOrder) => {
            const q = withOrder
                ? query(collection(db, 'Appointments'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'))
                : query(collection(db, 'Appointments'), where('userId', '==', user.uid));

            unsubscribe = onSnapshot(q, (snap) => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

                if (!isFirstLoad.current) {
                    docs.forEach(appt => {
                        const prev = prevStatuses.current[appt.id];
                        if (prev === 'Pending' && appt.status === 'Approved') {
                            const toastId = `${appt.id}-${Date.now()}`;
                            setToasts(t => [...t, {
                                id: toastId,
                                message: `Your appointment with ${appt.doctorName} has been approved!`,
                            }]);
                            setTimeout(() => dismissToast(toastId), 6000);
                        }
                    });
                }

                docs.forEach(appt => { prevStatuses.current[appt.id] = appt.status; });
                isFirstLoad.current = false;
                setAppointments(docs);
                setLoading(false);
                setError('');
            }, (err) => {
                if (withOrder && err?.code === 'failed-precondition') {
                    unsubscribe();
                    startListener(false);
                } else {
                    setError(`Could not load appointments: ${err.message}`);
                    setLoading(false);
                }
            });
        };
        startListener(true);
        return () => unsubscribe();
    }, [user.uid]);

    // Load reports
    useEffect(() => {
        const load = async () => {
            try {
                const q = query(collection(db, 'Reports'), where('patientId', '==', user.uid));
                const snap = await getDocs(q);
                setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch { }
        };
        load();
    }, [user.uid]);

    // Load user ratings
    useEffect(() => {
        const load = async () => {
            try {
                const q = query(collection(db, 'Ratings'), where('patientId', '==', user.uid));
                const snap = await getDocs(q);
                const map = {};
                snap.docs.forEach(d => { map[d.data().doctorId] = d.data().rating; });
                setUserRatings(map);
            } catch { }
        };
        load();
    }, [user.uid]);

    const stats = {
        total: appointments.length,
        approved: appointments.filter(a => a.status === 'Approved').length,
        pending: appointments.filter(a => a.status === 'Pending').length,
        rejected: appointments.filter(a => a.status === 'Rejected').length,
        cancelled: appointments.filter(a => a.status === 'Cancelled').length,
    };

    // Health score: 0-100 based on kept (approved) vs missed (cancelled/rejected)
    const kept = stats.approved;
    const missed = stats.cancelled + stats.rejected;
    const healthScore = stats.total === 0 ? null
        : Math.max(0, Math.min(100, Math.round(((kept * 2 - missed) / Math.max(stats.total * 2, 1)) * 100)));
    const healthLabel = healthScore === null ? null
        : healthScore >= 80 ? { text: 'Excellent', color: '#2E7D32', bg: '#E8F5E9' }
            : healthScore >= 60 ? { text: 'Good', color: '#0277BD', bg: '#E1F5FE' }
                : healthScore >= 40 ? { text: 'Fair', color: '#E65100', bg: '#FFF8E1' }
                    : { text: 'Needs Attention', color: '#C62828', bg: '#FFEBEE' };

    // Countdown helper
    const getDaysAway = (dateStr) => {
        if (!dateStr) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const apptDate = new Date(dateStr); apptDate.setHours(0, 0, 0, 0);
        const diff = Math.round((apptDate - today) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const FILTER_TABS = [
        { key: 'all', label: 'All', count: stats.total },
        { key: 'Approved', label: '✓ Approved', count: stats.approved },
        { key: 'Pending', label: '⏳ Pending', count: stats.pending },
        { key: 'Rejected', label: '✗ Rejected', count: stats.rejected },
        { key: 'Cancelled', label: '🚫 Cancelled', count: stats.cancelled },
        { key: 'timeline', label: '📅 Timeline', count: null },
    ];

    const getFilteredAppointments = () => {
        let list = [...appointments];
        // Status filter
        if (activeTab !== 'all' && activeTab !== 'timeline') {
            list = list.filter(a => a.status === activeTab);
        }
        // Search
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

    // ─── Timeline View ─────────────────────────────────────────────────────────
    const getTimelineData = () => {
        const apptItems = appointments.map(a => ({
            date: a.date,
            type: 'appointment',
            label: `${a.category} — ${a.doctorName}`,
            detail: `${a.hospital} · ${a.time}`,
            status: a.status,
            icon: '🏥',
        }));
        const reportItems = reports.map(r => ({
            date: r.uploadedAt?.toDate?.()?.toISOString?.()?.split('T')[0] || 'Unknown',
            type: 'report',
            label: `${r.reportType} uploaded`,
            detail: r.fileName,
            status: 'report',
            icon: '📄',
            url: r.reportURL,
        }));
        const all = [...apptItems, ...reportItems].sort((a, b) => b.date.localeCompare(a.date));
        // Group by year
        const grouped = {};
        all.forEach(item => {
            const year = item.date?.slice(0, 4) || 'Unknown';
            if (!grouped[year]) grouped[year] = [];
            grouped[year].push(item);
        });
        return grouped;
    };

    const STATUS_TAB_COLORS = {
        'all': '#1565C0',
        'Approved': '#2E7D32',
        'Pending': '#E65100',
        'Rejected': '#C62828',
        'Cancelled': '#64748B',
        'timeline': '#6D28D9',
    };

    return (
        <div>
            <ApprovalToast toasts={toasts} onDismiss={dismissToast} />
            <CancelModal
                appt={cancelTarget}
                onConfirm={handleCancelConfirm}
                onClose={() => setCancelTarget(null)}
                cancelling={cancelling}
            />
            {uploadTarget && (
                <ReportUploadModal
                    apptId={uploadTarget}
                    onClose={() => setUploadTarget(null)}
                    onUploaded={() => {
                        // Refresh reports
                        getDocs(query(collection(db, 'Reports'), where('patientId', '==', user.uid)))
                            .then(snap => setReports(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
                    }}
                />
            )}
            {prescriptionTarget && (
                <PrescriptionModal
                    prescription={prescriptionTarget}
                    onClose={() => setPrescriptionTarget(null)}
                />
            )}

            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1>Appointment History</h1>
                        <p>View, rate, and manage all your appointments</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {!loading && stats.approved === 0 && (
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={seedDemoAppointments}
                                disabled={seeding}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#2E7D32', color: '#2E7D32' }}
                            >
                                <Sparkles size={14} />
                                {seeding ? 'Adding...' : 'Add Demo Appointments'}
                            </button>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {loading && <div className="loading-spinner" style={{ width: 14, height: 14 }} />}
                            <span style={{ fontSize: 12, color: '#64748B' }}>🔴 Live updates</span>
                        </div>
                    </div>
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
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
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
                        { label: 'Pending', value: stats.pending, icon: '⏳', cls: 'orange' },
                        { label: 'Rejected', value: stats.rejected, icon: '✗', cls: 'red' },
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
                    <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#C62828', fontSize: 13 }}>
                        Error: {error}
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
                                                {/* Dot */}
                                                <div style={{
                                                    position: 'absolute', left: -33, top: 14,
                                                    width: 14, height: 14, borderRadius: '50%',
                                                    background: item.type === 'report' ? '#0097A7' :
                                                        item.status === 'Approved' ? '#2E7D32' :
                                                            item.status === 'Pending' ? '#E65100' : '#C62828',
                                                    border: '3px solid white',
                                                    boxShadow: '0 0 0 2px #E0E7FF',
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
                                                            <span className={`badge ${STATUS_STYLES[item.status] || 'badge-pending'}`}>
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
                            const statusColors = {
                                Approved: { border: '#A5D6A7', bg: '#E8F5E9', txt: '#2E7D32' },
                                Pending: { border: '#FFE082', bg: '#FFF8E1', txt: '#E65100' },
                                Rejected: { border: '#EF9A9A', bg: '#FFEBEE', txt: '#C62828' },
                                Cancelled: { border: '#E0E7FF', bg: '#F8FAFF', txt: '#64748B' },
                            };
                            const sc = statusColors[appt.status] || statusColors.Pending;
                            const apptReports = reports.filter(r => r.appointmentId === appt.id);

                            return (
                                <div key={appt.id} style={{
                                    background: 'white', borderRadius: 16,
                                    border: `2px solid ${sc.border}`,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                                    overflow: 'hidden',
                                }}>
                                    {/* Status bar */}
                                    <div style={{
                                        background: sc.bg, padding: '10px 20px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className={`badge ${STATUS_STYLES[appt.status] || 'badge-pending'}`}>
                                                {appt.status === 'Pending' ? '⏳ Pending'
                                                    : appt.status === 'Approved' ? '✓ Approved'
                                                        : appt.status === 'Cancelled' ? '🚫 Cancelled'
                                                            : appt.status}
                                            </span>
                                            {/* Countdown badge */}
                                            {appt.status === 'Approved' && (() => {
                                                const days = getDaysAway(appt.date);
                                                if (days === null) return null;
                                                if (days < 0) return null; // past
                                                return (
                                                    <span style={{
                                                        background: days === 0 ? '#00695C' : '#0D47A1',
                                                        color: 'white', fontSize: 11, fontWeight: 700,
                                                        padding: '3px 10px', borderRadius: 20,
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                    }}>
                                                        {days === 0 ? '🎯 Today!' : `📅 ${days} day${days !== 1 ? 's' : ''} away`}
                                                    </span>
                                                );
                                            })()}
                                            <span style={{ fontSize: 12, color: sc.txt, fontWeight: 600 }}>
                                                {appt.date} · {appt.time}
                                            </span>
                                        </div>
                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {appt.status === 'Pending' && (
                                                <button
                                                    onClick={() => setCancelTarget(appt)}
                                                    style={{
                                                        background: '#FFEBEE', color: '#C62828',
                                                        border: '1px solid #EF9A9A', borderRadius: 7,
                                                        padding: '4px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            {appt.prescription && (
                                                <button
                                                    onClick={() => setPrescriptionTarget({ ...appt.prescription, doctorName: appt.doctorName })}
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
                                            {/* Doctor avatar */}
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
                                                    {appt.hospital} · {appt.category}
                                                </div>
                                                <div style={{ fontSize: 13, color: '#475569' }}>
                                                    👤 {appt.patientName}
                                                    {appt.patientAge && ` · Age: ${appt.patientAge}`}
                                                    {appt.patientGender && ` · ${appt.patientGender}`}
                                                    {appt.patientPhone && ` · 📞 ${appt.patientPhone}`}
                                                </div>
                                                {appt.patientReason && (
                                                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontStyle: 'italic' }}>
                                                        📝 {appt.patientReason}
                                                    </div>
                                                )}

                                                {/* Rating — only for Approved appointments */}
                                                {appt.status === 'Approved' && (
                                                    <div style={{ marginTop: 10 }}>
                                                        <StarRating
                                                            doctorId={appt.doctorId}
                                                            doctorName={appt.doctorName}
                                                            category={appt.category}
                                                            existingRating={userRatings[appt.doctorId]}
                                                            onRated={(stars) => setUserRatings(prev => ({ ...prev, [appt.doctorId]: stars }))}
                                                        />
                                                    </div>
                                                )}

                                                {/* Uploaded reports for this appointment */}
                                                {apptReports.length > 0 && (
                                                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {apptReports.map(r => (
                                                            <a key={r.id} href={r.reportURL} target="_blank" rel="noreferrer"
                                                                style={{
                                                                    background: '#F0FDF4', border: '1px solid #A7F3D0',
                                                                    color: '#065F46', borderRadius: 8,
                                                                    padding: '3px 10px', fontSize: 12, fontWeight: 600,
                                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                                    textDecoration: 'none',
                                                                }}
                                                            >
                                                                <FileText size={11} /> {r.reportType}
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
