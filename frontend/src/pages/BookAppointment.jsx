import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import {
    collection, addDoc, serverTimestamp, getDocs, query, where
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
    Stethoscope, MapPin, User, CalendarDays, ChevronRight,
    ChevronLeft, CheckCircle, XCircle, Loader2, Navigation, Clock, Building2, X,
    Search, Star, Calendar
} from 'lucide-react';

// Fix Leaflet default marker icons (Vite asset bundling issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom blue icon for user location
const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// Custom red icon for doctors
const doctorIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// ─── Re-center map helper ────────────────────────────────────────────────────
function MapRecenter({ center }) {
    const map = useMap();
    useEffect(() => { if (center) map.setView(center, 14, { animate: true, duration: 0.8 }); }, [center, map]);
    return null;
}

// ─── Doctor Categories ───────────────────────────────────────────────────────
const CATEGORIES = [
    { name: 'MBBS', icon: '🩺', color: '#1565C0' },
    { name: 'BAMS', icon: '🌿', color: '#2E7D32' },
    { name: 'BDS', icon: '🦷', color: '#6A1B9A' },
    { name: 'ENT', icon: '👂', color: '#00838F' },
    { name: 'Cardiologist', icon: '❤️', color: '#C62828' },
    { name: 'Dermatologist', icon: '🧴', color: '#F57C00' },
    { name: 'Orthopedic', icon: '🦴', color: '#558B2F' },
    { name: 'Pediatrician', icon: '👶', color: '#1565C0' },
    { name: 'Gynecologist', icon: '🌸', color: '#AD1457' },
    { name: 'Neurologist', icon: '🧠', color: '#4527A0' },
    { name: 'Psychiatrist', icon: '🧘', color: '#00695C' },
    { name: 'General Physician', icon: '🏥', color: '#0277BD' },
];

// ─── Doctor Availability by Category ─────────────────────────────────────────
const DOCTOR_AVAILABILITY = {
    'MBBS': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00 AM', end: '01:00 PM' },
    'BAMS': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00 AM', end: '12:00 PM' },
    'BDS': { days: ['Mon', 'Wed', 'Fri'], start: '10:00 AM', end: '02:00 PM' },
    'ENT': { days: ['Tue', 'Thu', 'Sat'], start: '11:00 AM', end: '03:00 PM' },
    'Cardiologist': { days: ['Mon', 'Wed', 'Fri'], start: '10:00 AM', end: '02:00 PM' },
    'Dermatologist': { days: ['Mon', 'Tue', 'Thu', 'Fri'], start: '09:30 AM', end: '12:30 PM' },
    'Orthopedic': { days: ['Mon', 'Tue', 'Wed', 'Thu'], start: '09:00 AM', end: '01:00 PM' },
    'Pediatrician': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00 AM', end: '12:00 PM' },
    'Gynecologist': { days: ['Tue', 'Wed', 'Thu', 'Sat'], start: '10:00 AM', end: '02:30 PM' },
    'Neurologist': { days: ['Mon', 'Wed', 'Fri'], start: '02:00 PM', end: '06:00 PM' },
    'Psychiatrist': { days: ['Mon', 'Tue', 'Thu', 'Fri'], start: '02:00 PM', end: '05:30 PM' },
    'General Physician': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00 AM', end: '06:00 PM' },
};

// Convert "09:00 AM" to minutes since midnight for comparison
function timeToMinutes(t) {
    const [time, period] = t.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
}

function getAvailableSlots(category, allSlots) {
    const avail = DOCTOR_AVAILABILITY[category];
    if (!avail) return allSlots;
    const startMin = timeToMinutes(avail.start);
    const endMin = timeToMinutes(avail.end);
    return allSlots.filter(s => {
        const sm = timeToMinutes(s);
        return sm >= startMin && sm <= endMin;
    });
}

// Deterministic consultation fee (₹300–₹900) based on doctor name
function getConsultationFee(name) {
    if (!name) return 500;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xFFFFFF;
    return 300 + (hash % 601);
}

// ─── Time Slots ──────────────────────────────────────────────────────────────
const TIME_SLOTS = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM',
    '04:30 PM', '05:00 PM', '05:30 PM', '06:00 PM',
];

// ─── Star Rating Display ─────────────────────────────────────────────────────
function StarDisplay({ rating, count }) {
    const full = Math.round(rating || 0);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={13}
                    fill={i <= full ? '#F59E0B' : 'none'}
                    color={i <= full ? '#F59E0B' : '#CBD5E1'}
                />
            ))}
            {count > 0 && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 2 }}>({count})</span>}
        </div>
    );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Haversine distance (km) ─────────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Category-specific doctor names ─────────────────────────────────────────
const DOCTOR_NAMES_BY_CATEGORY = {
    'MBBS': ['Dr. Arjun Verma', 'Dr. Kavitha Nair', 'Dr. Suresh Iyer', 'Dr. Pooja Reddy', 'Dr. Manish Gupta', 'Dr. Divya Menon'],
    'BAMS': ['Dr. Ramesh Ayyer', 'Dr. Lata Krishnan', 'Dr. Gopal Sharma', 'Dr. Meera Pillai', 'Dr. Vinod Patil', 'Dr. Shreya Joshi'],
    'BDS': ['Dr. Neha Kapoor', 'Dr. Sanjay Khanna', 'Dr. Ritu Singh', 'Dr. Amit Chaudhary', 'Dr. Preeti Desai', 'Dr. Kiran Bose'],
    'ENT': ['Dr. Prakash Rao', 'Dr. Ananya Das', 'Dr. Sunil Tiwari', 'Dr. Nandini Hegde', 'Dr. Rakesh Malhotra', 'Dr. Swati Banerjee'],
    'Cardiologist': ['Dr. Deepak Mathur', 'Dr. Sunanda Pillai', 'Dr. Vivek Chopra', 'Dr. Rekha Shetty', 'Dr. Abhijit Sen', 'Dr. Hema Nambiar'],
    'Dermatologist': ['Dr. Shruti Agarwal', 'Dr. Tarun Bhatia', 'Dr. Pallavi Joshi', 'Dr. Nikhil Mehrotra', 'Dr. Devika Rao', 'Dr. Sameer Lal'],
    'Orthopedic': ['Dr. Rajiv Tandon', 'Dr. Smita Kulkarni', 'Dr. Ashok Pandey', 'Dr. Usha Naidu', 'Dr. Hemant Saxena', 'Dr. Bhavna Shah'],
    'Pediatrician': ['Dr. Geeta Varma', 'Dr. Rajan Mishra', 'Dr. Anjana Tiwari', 'Dr. Kunal Bose', 'Dr. Preethi Kumar', 'Dr. Naresh Pillai'],
    'Gynecologist': ['Dr. Shobha Menon', 'Dr. Alka Sinha', 'Dr. Farida Khan', 'Dr. Bindu George', 'Dr. Chetana Deshpande', 'Dr. Nirmala Rao'],
    'Neurologist': ['Dr. Siddharth Jain', 'Dr. Arati Vyas', 'Dr. Murali Krishnan', 'Dr. Tanuja Patil', 'Dr. Rohit Aggarwal', 'Dr. Shanta Iyer'],
    'Psychiatrist': ['Dr. Varun Mallik', 'Dr. Nisha Puri', 'Dr. Saurabh Ghosh', 'Dr. Leela Rajan', 'Dr. Ajay Bhatt', 'Dr. Indira Nair'],
    'General Physician': ['Dr. Mohan Das', 'Dr. Seema Kapoor', 'Dr. Pranav Sharma', 'Dr. Radha Krishnan', 'Dr. Tushar Mehta', 'Dr. Lalitha Suresh'],
};
const DEFAULT_NAMES = ['Dr. Anil Sharma', 'Dr. Priya Mehta', 'Dr. Rajesh Kumar', 'Dr. Sunita Patel', 'Dr. Vikram Singh', 'Dr. Anjali Nair'];

// ─── Seed demo doctors to Firestore ─────────────────────────────────────────
async function seedDoctors(category, userLat, userLng) {
    const OFFSETS = [
        { lat: 0.005, lng: 0.003 }, { lat: -0.006, lng: 0.007 }, { lat: 0.009, lng: -0.004 },
        { lat: -0.003, lng: -0.008 }, { lat: 0.012, lng: 0.005 }, { lat: -0.010, lng: 0.002 },
    ];
    const names = DOCTOR_NAMES_BY_CATEGORY[category] || DEFAULT_NAMES;
    const hospitals = ['Apollo Hospitals', 'Fortis Healthcare', 'AIIMS', 'Manipal Hospital', 'Max Super Speciality', 'Columbia Asia'];
    const batch = names.map((name, i) => ({
        name, specialization: category, hospital: hospitals[i],
        lat: userLat + OFFSETS[i].lat, lng: userLng + OFFSETS[i].lng,
        available: i !== 5, category,
    }));
    const colRef = collection(db, 'Doctors');
    await Promise.all(batch.map(d => addDoc(colRef, d)));
    return batch;
}

// ─── Local-only demo doctors (no Firestore) ───────────────────────────────────
function seedDoctorsLocal(category, userLat, userLng) {
    const OFFSETS = [
        { lat: 0.005, lng: 0.003 }, { lat: -0.006, lng: 0.007 }, { lat: 0.009, lng: -0.004 },
        { lat: -0.003, lng: -0.008 }, { lat: 0.012, lng: 0.005 }, { lat: -0.010, lng: 0.002 },
    ];
    const names = DOCTOR_NAMES_BY_CATEGORY[category] || DEFAULT_NAMES;
    const hospitals = ['Apollo Hospitals', 'Fortis Healthcare', 'AIIMS', 'Manipal Hospital', 'Max Super Speciality', 'Columbia Asia'];
    return names.map((name, i) => ({
        id: `local-${category}-${i}`,
        name, specialization: category, hospital: hospitals[i],
        lat: userLat + OFFSETS[i].lat, lng: userLng + OFFSETS[i].lng,
        available: i !== 5, category,
    }));
}

// ─── Auto-close countdown modal ───────────────────────────────────────────────
function ConfirmationModal({ modal, onClose, onViewHistory }) {
    const [progress, setProgress] = useState(100);
    const autoCloseMs = 5000;

    useEffect(() => {
        if (!modal || modal.type === 'submitting') return;
        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / autoCloseMs) * 100);
            setProgress(remaining);
            if (remaining === 0) {
                clearInterval(interval);
                onClose();
            }
        }, 50);
        return () => clearInterval(interval);
    }, [modal, onClose]);

    if (!modal) return null;

    const isSubmitting = modal.type === 'submitting';
    const isSent = modal.type === 'sent';       // new: request sent, awaiting doctor

    const bannerColor = isSubmitting
        ? 'linear-gradient(135deg, #1565C0, #1976D2)'
        : 'linear-gradient(135deg, #0277BD, #039BE5)';

    return (
        <div className="modal-overlay" onClick={!isSubmitting ? onClose : undefined}>
            <div className="modal modal-enhanced" onClick={e => e.stopPropagation()}>
                {/* Gradient Banner */}
                <div className="modal-banner" style={{ background: bannerColor }}>
                    <div className={`modal-banner-icon ${isSubmitting ? 'spinning' : 'pop-in'}`}>
                        {isSubmitting ? (
                            <Loader2 size={40} color="white" style={{ animation: 'spin 0.8s linear infinite' }} />
                        ) : (
                            <CheckCircle size={40} color="white" />
                        )}
                    </div>
                    <h3 className="modal-banner-title">
                        {isSubmitting ? 'Submitting Request...' : 'Request Sent! 📩'}
                    </h3>
                </div>

                {/* Body */}
                <div className="modal-body">
                    <p className="modal-message">{modal.message}</p>

                    {/* Appointment Summary */}
                    {isSent && modal.summary && (
                        <div className="modal-summary">
                            {/* Patient info */}
                            {modal.summary.patientName && (
                                <div className="modal-summary-row">
                                    <User size={15} />
                                    <span><strong>Patient:</strong> {modal.summary.patientName}</span>
                                </div>
                            )}
                            {(modal.summary.patientAge || modal.summary.patientGender) && (
                                <div className="modal-summary-row">
                                    <span>🧑</span>
                                    <span>
                                        {modal.summary.patientAge && `Age: ${modal.summary.patientAge}`}
                                        {modal.summary.patientAge && modal.summary.patientGender && '  ·  '}
                                        {modal.summary.patientGender && modal.summary.patientGender}
                                    </span>
                                </div>
                            )}
                            {modal.summary.patientPhone && (
                                <div className="modal-summary-row">
                                    <span>📞</span>
                                    <span>{modal.summary.patientPhone}</span>
                                </div>
                            )}
                            {modal.summary.patientReason && (
                                <div className="modal-summary-row">
                                    <span>📝</span>
                                    <span>{modal.summary.patientReason}</span>
                                </div>
                            )}
                            {/* Divider */}
                            <div style={{ borderTop: '1px solid #E2E8F0', margin: '8px 0' }} />
                            {/* Doctor / appointment info */}
                            {modal.summary.doctor && (
                                <div className="modal-summary-row">
                                    <User size={15} />
                                    <span><strong>Doctor:</strong> {modal.summary.doctor}</span>
                                </div>
                            )}
                            {modal.summary.hospital && (
                                <div className="modal-summary-row">
                                    <Building2 size={15} />
                                    <span>{modal.summary.hospital}</span>
                                </div>
                            )}
                            {modal.summary.date && (
                                <div className="modal-summary-row">
                                    <CalendarDays size={15} />
                                    <span>{modal.summary.date} ({modal.summary.day})</span>
                                </div>
                            )}
                            {modal.summary.time && (
                                <div className="modal-summary-row">
                                    <Clock size={15} />
                                    <span>{modal.summary.time}</span>
                                </div>
                            )}
                            <div className="modal-summary-row" style={{ marginTop: 8, color: '#F57C00', fontWeight: 600 }}>
                                ⏳ <span>Status: Pending — awaiting doctor approval</span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {isSent && (
                        <div className="modal-actions">
                            <button className="btn btn-primary btn-sm" onClick={onViewHistory}>
                                View in History
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={onClose}>
                                Book Another
                            </button>
                        </div>
                    )}

                    {/* Auto-close progress bar */}
                    {isSent && (
                        <div className="modal-progress-track">
                            <div
                                className="modal-progress-bar"
                                style={{ width: `${progress}%`, background: '#0277BD' }}
                            />
                        </div>
                    )}
                    {isSent && (
                        <p className="modal-auto-close-hint">Closes automatically in a few seconds</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function BookAppointment() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [locationError, setLocationError] = useState('');
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [loadingDoctors, setLoadingDoctors] = useState(false);
    const prefetchedLocation = useRef(null);

    // Smart search
    const [doctorSearch, setDoctorSearch] = useState('');

    // Ratings map: doctorId -> { avg, count }
    const [ratingsMap, setRatingsMap] = useState({});

    // Booking form
    const [bookDate, setBookDate] = useState('');
    const [bookDay, setBookDay] = useState('');
    const [bookTime, setBookTime] = useState('');
    const [patientName, setPatientName] = useState('');
    const [patientAge, setPatientAge] = useState('');
    const [patientGender, setPatientGender] = useState('');
    const [patientPhone, setPatientPhone] = useState('');
    const [patientReason, setPatientReason] = useState('');
    const [booking, setBooking] = useState(false);
    const [bookError, setBookError] = useState('');

    // Confirmation modal
    const [modal, setModal] = useState(null);

    // ─── Pre-fetch location on mount ─────────────────────────────────────────
    useEffect(() => {
        const GEO_OPTS = { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 };
        if (!navigator.geolocation) {
            prefetchedLocation.current = { lat: 28.6139, lng: 77.2090, fallback: true };
            setLoadingLocation(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                prefetchedLocation.current = { lat: coords.latitude, lng: coords.longitude, fallback: false };
                setLoadingLocation(false);
            },
            () => {
                prefetchedLocation.current = { lat: 28.6139, lng: 77.2090, fallback: true };
                setLoadingLocation(false);
            },
            GEO_OPTS
        );
    }, []);

    // ─── Fetch doctors list (2s timeout, instant local fallback) ─────────────
    const fetchDoctors = async (category, lat, lng) => {
        setLoadingDoctors(true);
        try {
            // Show local doctors instantly as the optimistic result
            const localDocs = seedDoctorsLocal(category, lat, lng);

            // Race Firestore against a 2-second timeout
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
            const q = query(collection(db, 'Doctors'), where('category', '==', category));

            let docs = localDocs; // default: instant local
            try {
                const snap = await Promise.race([getDocs(q), timeout]);
                const firestoreDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (firestoreDocs.length > 0) {
                    docs = firestoreDocs;
                } else {
                    // Seed in background (don't wait)
                    seedDoctors(category, lat, lng).catch(() => { });
                }
            } catch {
                // Timeout or offline — already using local docs
            }

            docs = docs.map(d => ({
                ...d,
                distance: haversineDistance(lat, lng, d.lat ?? lat, d.lng ?? lng),
            })).sort((a, b) => a.distance - b.distance);
            setDoctors(docs);
        } finally {
            setLoadingDoctors(false);
        }
    };

    // ─── Get location then doctors ────────────────────────────────────────────
    const getLocationAndDoctors = useCallback(async (category) => {
        setLocationError('');
        setDoctors([]);

        let loc = prefetchedLocation.current;
        if (!loc) {
            setLoadingLocation(true);
            loc = await new Promise(resolve => {
                const GEO_OPTS = { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 };
                navigator.geolocation.getCurrentPosition(
                    ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, fallback: false }),
                    () => resolve({ lat: 28.6139, lng: 77.2090, fallback: true }),
                    GEO_OPTS
                );
            });
            setLoadingLocation(false);
        }

        if (loc.fallback) {
            setLocationError('Location access denied — showing demo doctors near Delhi.');
        }
        setUserLocation({ lat: loc.lat, lng: loc.lng });
        await fetchDoctors(category, loc.lat, loc.lng);
    }, []);

    // ─── Fetch ratings for doctors in this category ───────────────────────────
    const fetchRatings = useCallback(async (category) => {
        try {
            const q = query(collection(db, 'Ratings'), where('category', '==', category));
            const snap = await getDocs(q);
            const map = {};
            snap.docs.forEach(d => {
                const { doctorId, rating } = d.data();
                if (!map[doctorId]) map[doctorId] = { total: 0, count: 0 };
                map[doctorId].total += rating;
                map[doctorId].count += 1;
            });
            const avgMap = {};
            Object.keys(map).forEach(id => {
                avgMap[id] = { avg: map[id].total / map[id].count, count: map[id].count };
            });
            setRatingsMap(avgMap);
        } catch { /* ignore */ }
    }, []);

    const handleSelectCategory = (cat) => {
        setSelectedCategory(cat);
        setDoctorSearch('');
        setStep(2);
        getLocationAndDoctors(cat.name);
        fetchRatings(cat.name);
    };

    const handleSelectDoctor = (doctor) => {
        setSelectedDoctor(doctor);
        setStep(3);
    };

    const handleBookAppointment = (e) => {
        e.preventDefault();
        if (!bookDate || !bookDay || !bookTime || !patientName.trim() || !patientAge || !patientGender || !patientPhone.trim()) return;

        setBooking(false);
        setBookError('');

        // ── Optimistic UI: show success instantly ─────────────────────────────
        setModal({
            type: 'sent',
            message: 'Your appointment request has been sent to the doctor.',
            summary: {
                doctor: selectedDoctor.name,
                hospital: selectedDoctor.hospital,
                date: bookDate,
                day: bookDay,
                time: bookTime,
                patientName: patientName.trim(),
                patientAge,
                patientGender,
                patientPhone: patientPhone.trim(),
                patientReason: patientReason.trim(),
            },
        });

        // ── Write to Firestore in the background ──────────────────────────────
        addDoc(collection(db, 'Appointments'), {
            userId: user.uid,
            userEmail: user.email,
            doctorId: selectedDoctor.id,
            doctorName: selectedDoctor.name,
            specialization: selectedDoctor.specialization,
            hospital: selectedDoctor.hospital,
            category: selectedCategory.name,
            patientName: patientName.trim(),
            patientAge: Number(patientAge),
            patientGender,
            patientPhone: patientPhone.trim(),
            patientReason: patientReason.trim(),
            date: bookDate, day: bookDay, time: bookTime,
            status: 'Pending',
            timestamp: serverTimestamp(),
        }).catch((err) => {
            // Background write failed — collapse modal & surface the error
            setModal(null);
            setBookError(
                err?.code === 'permission-denied'
                    ? 'Permission denied. Please check your Firestore security rules.'
                    : `Could not save appointment: ${err?.message || 'Unknown error'}. Please try again.`
            );
        });
    };

    const handleModalClose = () => {
        setModal(null);
        setBookError('');
        // Always reset to category selection after booking
        setStep(1); setSelectedCategory(null); setSelectedDoctor(null);
        setBookDate(''); setBookDay(''); setBookTime('');
        setPatientName(''); setPatientAge(''); setPatientGender(''); setPatientPhone(''); setPatientReason('');
    };

    const handleViewHistory = () => {
        setModal(null);
        navigate('/dashboard/history');
    };

    const getMinDate = () => new Date().toISOString().split('T')[0];

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div>
            <div className="page-header">
                <h1>Book Appointment</h1>
                <p>Find and book your healthcare appointment in minutes</p>
            </div>

            <div className="page-body">
                {/* Steps Indicator */}
                <div className="steps">
                    {[{ num: 1, label: 'Category' }, { num: 2, label: 'Doctors' }, { num: 3, label: 'Book Slot' }].map((s, i, arr) => (
                        <React.Fragment key={s.num}>
                            <div className={`step ${step === s.num ? 'active' : step > s.num ? 'completed' : ''}`}>
                                <div className="step-num">{step > s.num ? '✓' : s.num}</div>
                                <span className="step-label">{s.label}</span>
                            </div>
                            {i < arr.length - 1 && <div className={`step-line ${step > s.num ? 'completed' : ''}`} />}
                        </React.Fragment>
                    ))}
                </div>

                {/* ─── Step 1: Category ─── */}
                {step === 1 && (
                    <div>
                        <h2 className="section-title">
                            <Stethoscope size={20} /> Select Doctor Category
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12 }}>
                            {loadingLocation ? (
                                <>
                                    <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite', color: '#0277BD' }} />
                                    <span style={{ color: '#0277BD' }}>Detecting your location…</span>
                                </>
                            ) : (
                                <>
                                    <Navigation size={13} style={{ color: '#2E7D32' }} />
                                    <span style={{ color: '#2E7D32' }}>Location ready — select a category to see nearby doctors instantly</span>
                                </>
                            )}
                        </div>
                        <div className="category-grid">
                            {CATEGORIES.map(cat => (
                                <div
                                    key={cat.name}
                                    className={`category-card ${selectedCategory?.name === cat.name ? 'selected' : ''}`}
                                    onClick={() => handleSelectCategory(cat)}
                                >
                                    <div className="category-icon" style={selectedCategory?.name === cat.name ? {
                                        background: `linear-gradient(135deg, ${cat.color}, ${cat.color}99)`
                                    } : {}}>
                                        {cat.icon}
                                    </div>
                                    <span className="category-name">{cat.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Step 2: Doctors + Map ─── */}
                {step === 2 && (
                    <div>
                        <button className="back-btn" onClick={() => setStep(1)}>
                            <ChevronLeft size={16} /> Back to Categories
                        </button>

                        {locationError && (
                            <div style={{
                                background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px',
                                padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#8D6E00',
                                display: 'flex', alignItems: 'center', gap: 8
                            }}>
                                <Navigation size={16} /> {locationError}
                            </div>
                        )}

                        {/* ── High-Quality Leaflet Map ── */}
                        {userLocation && !loadingLocation && (
                            <div style={{
                                height: 360,
                                borderRadius: 16,
                                overflow: 'hidden',
                                marginBottom: 28,
                                border: '2px solid #E2E8F0',
                                boxShadow: '0 4px 24px rgba(21,101,192,0.12)',
                                position: 'relative',
                            }}>
                                {/* Compass overlay */}
                                <div style={{
                                    position: 'absolute', top: 12, right: 12, zIndex: 1000,
                                    width: 44, height: 44,
                                    background: 'white',
                                    borderRadius: '50%',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    animation: 'compassSpin 20s linear infinite',
                                    cursor: 'default',
                                    fontSize: 20,
                                }}>
                                    🧭
                                </div>
                                <MapContainer
                                    center={[userLocation.lat, userLocation.lng]}
                                    zoom={14}
                                    style={{ height: '100%', width: '100%' }}
                                    scrollWheelZoom={true}
                                    zoomControl={true}
                                >
                                    {/* CartoDB Voyager — sharp, high-res tiles at all zoom levels */}
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                        maxZoom={20}
                                        maxNativeZoom={19}
                                    />
                                    <MapRecenter center={[userLocation.lat, userLocation.lng]} />

                                    {/* User pin */}
                                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                                        <Popup><strong>📍 Your Location</strong></Popup>
                                    </Marker>

                                    {/* Doctor pins */}
                                    {doctors.map(doctor => (
                                        <Marker
                                            key={doctor.id}
                                            position={[doctor.lat, doctor.lng]}
                                            icon={doctorIcon}
                                        >
                                            <Popup>
                                                <div style={{ minWidth: 170 }}>
                                                    <strong style={{ fontSize: 13 }}>{doctor.name}</strong>
                                                    <p style={{ margin: '4px 0 2px', fontSize: 12, color: '#555' }}>🏥 {doctor.hospital}</p>
                                                    <p style={{ margin: 0, fontSize: 12, color: '#555' }}>📍 {doctor.distance?.toFixed(1)} km away</p>
                                                    <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: doctor.available ? '#2E7D32' : '#C62828' }}>
                                                        {doctor.available ? '● Available' : '● Unavailable'}
                                                    </p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                            <h2 className="section-title" style={{ margin: 0 }}>
                                <MapPin size={20} /> Nearest {selectedCategory?.name} Doctors
                            </h2>
                            {/* Smart Search */}
                            <div style={{ position: 'relative', minWidth: 240 }}>
                                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                                <input
                                    type="text"
                                    value={doctorSearch}
                                    onChange={e => setDoctorSearch(e.target.value)}
                                    placeholder="Search by name or hospital…"
                                    style={{
                                        padding: '9px 14px 9px 36px', border: '2px solid #E0E7FF',
                                        borderRadius: 10, fontSize: 13, outline: 'none',
                                        fontFamily: 'inherit', width: '100%', color: '#1E293B',
                                        background: 'white',
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#1565C0'}
                                    onBlur={e => e.target.style.borderColor = '#E0E7FF'}
                                />
                            </div>
                        </div>

                        {/* Availability badge */}
                        {selectedCategory && DOCTOR_AVAILABILITY[selectedCategory.name] && (
                            <div style={{
                                background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 10,
                                padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#2E7D32',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <Calendar size={15} />
                                <strong>Availability:</strong> {DOCTOR_AVAILABILITY[selectedCategory.name].days.join(', ')}
                                &nbsp;·&nbsp;
                                {DOCTOR_AVAILABILITY[selectedCategory.name].start} – {DOCTOR_AVAILABILITY[selectedCategory.name].end}
                            </div>
                        )}

                        {(loadingLocation || loadingDoctors) ? (
                            <div className="loading-container">
                                <div className="loading-spinner" />
                                <p>{loadingLocation ? 'Getting your location...' : 'Loading nearby doctors...'}</p>
                            </div>
                        ) : (() => {
                            const filtered = doctors.filter(d => {
                                const q = doctorSearch.toLowerCase();
                                return !q || d.name.toLowerCase().includes(q) || d.hospital.toLowerCase().includes(q);
                            });
                            return filtered.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                                    <Search size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                                    <p>No doctors match your search</p>
                                </div>
                            ) : (
                                <div>
                                    {/* Book First Available shortcut */}
                                    {filtered.some(d => d.available) && (
                                        <div style={{ marginBottom: 14 }}>
                                            <button
                                                onClick={() => {
                                                    const first = filtered.find(d => d.available);
                                                    if (first) handleSelectDoctor(first);
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: 'linear-gradient(135deg, #0D47A1, #0097A7)',
                                                    color: 'white', border: 'none', borderRadius: 12,
                                                    padding: '10px 20px', fontFamily: 'inherit',
                                                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                                    boxShadow: '0 4px 12px rgba(13,71,161,0.25)',
                                                    transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                ⚡ Book First Available — {filtered.find(d => d.available)?.name?.split(' ').slice(0, 2).join(' ')}
                                            </button>
                                        </div>
                                    )}
                                    <div className="doctor-grid">
                                        {filtered.map(doctor => {
                                            const rInfo = ratingsMap[doctor.id];
                                            return (
                                                <div key={doctor.id} className="doctor-card">
                                                    <div className="doctor-card-header">
                                                        <div className="doctor-avatar">
                                                            {doctor.name.split(' ').filter(w => w !== 'Dr.').map(w => w[0]).join('').slice(0, 2)}
                                                        </div>
                                                        <div className="doctor-info">
                                                            <h4>{doctor.name}</h4>
                                                            <p>{doctor.specialization}</p>
                                                            <StarDisplay rating={rInfo?.avg || 0} count={rInfo?.count || 0} />
                                                        </div>
                                                    </div>
                                                    <div className="doctor-meta">
                                                        <div className="doctor-meta-item">🏥 <span>{doctor.hospital}</span></div>
                                                        <div className="doctor-meta-item">
                                                            <MapPin size={14} />
                                                            <span>{doctor.distance?.toFixed(1)} km away</span>
                                                        </div>
                                                        {DOCTOR_AVAILABILITY[selectedCategory?.name] && (
                                                            <div className="doctor-meta-item" style={{ fontSize: 12, color: '#0277BD' }}>
                                                                <Clock size={12} />
                                                                <span>{DOCTOR_AVAILABILITY[selectedCategory.name].start} – {DOCTOR_AVAILABILITY[selectedCategory.name].end}</span>
                                                            </div>
                                                        )}
                                                        <div className="doctor-meta-item" style={{ fontSize: 12, color: '#7C3AED', fontWeight: 700 }}>
                                                            <span>💳</span>
                                                            <span>Consultation: ₹{getConsultationFee(doctor.name)}</span>
                                                        </div>
                                                        <div style={{ marginTop: 4 }}>
                                                            <span className={`badge ${doctor.available ? 'badge-available' : 'badge-unavailable'}`}>
                                                                {doctor.available ? '✓ Available' : '✗ Unavailable'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {doctor.available && (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            style={{ width: '100%' }}
                                                            onClick={() => handleSelectDoctor(doctor)}
                                                        >
                                                            Book Appointment <ChevronRight size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                    </div>
                )}

                {/* ─── Step 3: Booking Form ─── */}
                {step === 3 && selectedDoctor && (
                    <div>
                        <button className="back-btn" onClick={() => setStep(2)}>
                            <ChevronLeft size={16} /> Back to Doctors
                        </button>

                        <div className="selected-doctor-banner">
                            <div className="doctor-avatar">
                                {selectedDoctor.name.split(' ').filter(w => w !== 'Dr.').map(w => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedDoctor.name}</div>
                                <div style={{ opacity: 0.85, fontSize: 13 }}>{selectedDoctor.specialization} · {selectedDoctor.hospital}</div>
                                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{selectedDoctor.distance?.toFixed(1)} km away</div>
                            </div>
                        </div>

                        <div style={{ maxWidth: 600 }}>
                            <h2 className="section-title">
                                <CalendarDays size={20} /> Select Appointment Slot
                            </h2>

                            <form onSubmit={handleBookAppointment} className="booking-form">
                                {/* Patient Name */}
                                <div className="form-group">
                                    <label>Patient Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                                        <input
                                            type="text"
                                            value={patientName}
                                            onChange={e => setPatientName(e.target.value)}
                                            placeholder="Enter full patient name"
                                            required
                                            style={{ paddingLeft: 40 }}
                                        />
                                    </div>
                                </div>

                                {/* Age & Gender — side by side */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Age</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="120"
                                            value={patientAge}
                                            onChange={e => setPatientAge(e.target.value)}
                                            placeholder="e.g. 30"
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Gender</label>
                                        <select
                                            value={patientGender}
                                            onChange={e => setPatientGender(e.target.value)}
                                            required
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <option value="">Select gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="form-group">
                                    <label>Phone Number</label>
                                    <input
                                        type="tel"
                                        value={patientPhone}
                                        onChange={e => setPatientPhone(e.target.value)}
                                        placeholder="Enter contact number"
                                        required
                                        pattern="[0-9+\-\s]{7,15}"
                                        title="Enter a valid phone number"
                                    />
                                </div>

                                {/* Reason */}
                                <div className="form-group">
                                    <label>Reason for Visit <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 12 }}>(optional)</span></label>
                                    <textarea
                                        value={patientReason}
                                        onChange={e => setPatientReason(e.target.value)}
                                        placeholder="Briefly describe your symptoms or reason for the visit"
                                        rows={3}
                                        style={{ resize: 'vertical', minHeight: 80 }}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Select Date</label>
                                    <input
                                        type="date"
                                        value={bookDate}
                                        min={getMinDate()}
                                        onChange={e => {
                                            setBookDate(e.target.value);
                                            if (e.target.value) {
                                                const d = new Date(e.target.value);
                                                setBookDay(DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]);
                                            }
                                        }}
                                        required
                                    />
                                </div>

                                {bookDay && (
                                    <div className="form-group">
                                        <label>Day</label>
                                        <input
                                            type="text"
                                            value={bookDay}
                                            readOnly
                                            style={{
                                                background: '#F1F5F9',
                                                color: '#0277BD',
                                                fontWeight: 600,
                                                cursor: 'default',
                                            }}
                                        />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Select Time Slot
                                        {selectedDoctor && DOCTOR_AVAILABILITY[selectedDoctor.specialization] && (
                                            <span style={{ fontWeight: 400, fontSize: 12, color: '#0277BD', marginLeft: 8 }}>
                                                (Available: {DOCTOR_AVAILABILITY[selectedDoctor.specialization].start} – {DOCTOR_AVAILABILITY[selectedDoctor.specialization].end})
                                            </span>
                                        )}
                                    </label>
                                    <div className="time-slots">
                                        {(selectedDoctor ? getAvailableSlots(selectedDoctor.specialization, TIME_SLOTS) : TIME_SLOTS).map(slot => (
                                            <div
                                                key={slot}
                                                className={`time-slot ${bookTime === slot ? 'selected' : ''}`}
                                                onClick={() => setBookTime(slot)}
                                            >
                                                {slot}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {bookError && (
                                    <div style={{
                                        background: '#FFEBEE', border: '1px solid #EF9A9A',
                                        borderRadius: 10, padding: '12px 16px', marginTop: 16,
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                        fontSize: 13, color: '#C62828',
                                    }}>
                                        <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                                        <span>{bookError}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg"
                                    style={{ marginTop: 16, width: '100%' }}
                                    disabled={booking || !bookTime}
                                >
                                    {booking ? (
                                        <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Confirming...</>
                                    ) : 'Confirm Appointment'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Enhanced Confirmation Modal ─── */}
            <ConfirmationModal
                modal={modal}
                onClose={handleModalClose}
                onViewHistory={handleViewHistory}
            />
        </div>
    );
}
