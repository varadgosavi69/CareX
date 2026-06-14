import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as doctorService from '../api/services/doctorService';
import * as appointmentService from '../api/services/appointmentService';
import { apiErrorMessage } from '../api/client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
    Stethoscope, MapPin, User, CalendarDays, ChevronRight,
    ChevronLeft, CheckCircle, XCircle, Loader2, Navigation, Clock, Building2,
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
    useEffect(() => { if (center) map.setView(center, 13, { animate: true, duration: 0.8 }); }, [center, map]);
    return null;
}

// ─── Specialties (match the backend's directory) ─────────────────────────────
const CATEGORIES = [
    { name: 'General Physician', icon: '🏥', color: '#0277BD' },
    { name: 'Cardiology', icon: '❤️', color: '#C62828' },
    { name: 'Dermatology', icon: '🧴', color: '#F57C00' },
    { name: 'Pediatrics', icon: '👶', color: '#1565C0' },
    { name: 'Orthopedics', icon: '🦴', color: '#558B2F' },
    { name: 'Gynecology', icon: '🌸', color: '#AD1457' },
    { name: 'Neurology', icon: '🧠', color: '#4527A0' },
    { name: 'Psychiatry', icon: '🧘', color: '#00695C' },
    { name: 'ENT', icon: '👂', color: '#00838F' },
    { name: 'Ophthalmology', icon: '👁️', color: '#1565C0' },
    { name: 'Dentistry', icon: '🦷', color: '#6A1B9A' },
    { name: 'Gastroenterology', icon: '🍽️', color: '#EF6C00' },
    { name: 'Urology', icon: '💧', color: '#0097A7' },
    { name: 'Oncology', icon: '🎗️', color: '#AD1457' },
    { name: 'Endocrinology', icon: '⚗️', color: '#5E35B1' },
];

// Backend WEEKDAYS (Monday-first), used to map a date to an availability day.
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAY = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

const pad = (n) => String(n).padStart(2, '0');

// Weekday name (backend format) for a yyyy-mm-dd date, computed at local noon so
// it can't drift across midnight.
function weekdayOf(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    return DAYS[(d.getDay() + 6) % 7];
}

// Generate 30-minute "HH:mm-HH:mm" slots within a doctor's availability windows
// for the given weekday.
function slotsForDay(availability, weekday) {
    const out = [];
    for (const w of (availability || []).filter(a => a.day === weekday)) {
        const [sh, sm] = w.startTime.split(':').map(Number);
        const [eh, em] = w.endTime.split(':').map(Number);
        let cur = sh * 60 + sm;
        const end = eh * 60 + em;
        while (cur + 30 <= end) {
            const next = cur + 30;
            out.push(`${pad(Math.floor(cur / 60))}:${pad(cur % 60)}-${pad(Math.floor(next / 60))}:${pad(next % 60)}`);
            cur = next;
        }
    }
    return out;
}

// Unique availability days for a doctor, as short labels.
function availabilityDays(doctor) {
    return [...new Set((doctor.availability || []).map(a => a.day))].map(d => SHORT_DAY[d] || d);
}

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

const doctorInitials = (name) =>
    (name || 'Dr').split(' ').filter(w => w !== 'Dr.').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
    const isSent = modal.type === 'sent';

    const bannerColor = isSubmitting
        ? 'linear-gradient(135deg, #1565C0, #1976D2)'
        : 'linear-gradient(135deg, #0277BD, #039BE5)';

    return (
        <div className="modal-overlay" onClick={!isSubmitting ? onClose : undefined}>
            <div className="modal modal-enhanced" onClick={e => e.stopPropagation()}>
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

                <div className="modal-body">
                    <p className="modal-message">{modal.message}</p>

                    {isSent && modal.summary && (
                        <div className="modal-summary">
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
                            <div style={{ borderTop: '1px solid #E2E8F0', margin: '8px 0' }} />
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

                    {isSent && (
                        <div className="modal-progress-track">
                            <div className="modal-progress-bar" style={{ width: `${progress}%`, background: '#0277BD' }} />
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
    const [mapCenter, setMapCenter] = useState(null);
    const [locationError, setLocationError] = useState('');
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [loadingDoctors, setLoadingDoctors] = useState(false);
    const [doctorsError, setDoctorsError] = useState('');
    const prefetchedLocation = useRef(null);

    // Smart search
    const [doctorSearch, setDoctorSearch] = useState('');

    // Booking form
    const [bookDate, setBookDate] = useState('');
    const [bookDay, setBookDay] = useState('');
    const [bookSlot, setBookSlot] = useState('');
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
            prefetchedLocation.current = { lat: 21.1458, lng: 79.0882, fallback: true };
            setLoadingLocation(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                prefetchedLocation.current = { lat: coords.latitude, lng: coords.longitude, fallback: false };
                setLoadingLocation(false);
            },
            () => {
                prefetchedLocation.current = { lat: 21.1458, lng: 79.0882, fallback: true };
                setLoadingLocation(false);
            },
            GEO_OPTS
        );
    }, []);

    // ─── Fetch real approved doctors from the API ─────────────────────────────
    const fetchDoctors = async (specialty, loc) => {
        setLoadingDoctors(true);
        setDoctorsError('');
        try {
            // Prefer "near me" when we have a real fix; fall back to all approved
            // doctors of this specialty if nobody is nearby (seed data is regional).
            let result;
            if (loc && !loc.fallback) {
                result = await doctorService.list({ specialty, near: `${loc.lat},${loc.lng}`, radius: 50, limit: 50 });
                if (!result.doctors?.length) {
                    result = await doctorService.list({ specialty, limit: 50 });
                }
            } else {
                result = await doctorService.list({ specialty, limit: 50 });
            }

            const docs = (result.doctors || []).map(d => ({
                ...d,
                name: d.user?.name || 'Doctor',
                distance: (loc && d.lat != null && d.lng != null)
                    ? haversineDistance(loc.lat, loc.lng, d.lat, d.lng)
                    : null,
            })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

            setDoctors(docs);

            // Center the map on the doctors so pins are visible (seed data is in
            // one city); fall back to the user's location.
            const withCoords = docs.filter(d => d.lat != null && d.lng != null);
            if (withCoords.length) {
                setMapCenter({
                    lat: withCoords.reduce((s, d) => s + d.lat, 0) / withCoords.length,
                    lng: withCoords.reduce((s, d) => s + d.lng, 0) / withCoords.length,
                });
            } else if (loc) {
                setMapCenter({ lat: loc.lat, lng: loc.lng });
            }
        } catch (err) {
            setDoctors([]);
            setDoctorsError(apiErrorMessage(err, 'Could not load doctors. Please try again.'));
        } finally {
            setLoadingDoctors(false);
        }
    };

    // ─── Get location then doctors ────────────────────────────────────────────
    const getLocationAndDoctors = useCallback(async (specialty) => {
        setLocationError('');
        setDoctors([]);

        let loc = prefetchedLocation.current;
        if (!loc) {
            setLoadingLocation(true);
            loc = await new Promise(resolve => {
                const GEO_OPTS = { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 };
                navigator.geolocation.getCurrentPosition(
                    ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, fallback: false }),
                    () => resolve({ lat: 21.1458, lng: 79.0882, fallback: true }),
                    GEO_OPTS
                );
            });
            setLoadingLocation(false);
        }

        if (loc.fallback) {
            setLocationError('Location access denied — showing all available doctors.');
        }
        setUserLocation({ lat: loc.lat, lng: loc.lng });
        await fetchDoctors(specialty, loc);
    }, []);

    const handleSelectCategory = (cat) => {
        setSelectedCategory(cat);
        setDoctorSearch('');
        setStep(2);
        getLocationAndDoctors(cat.name);
    };

    const handleSelectDoctor = (doctor) => {
        setSelectedDoctor(doctor);
        setBookDate(''); setBookDay(''); setBookSlot('');
        setBookError('');
        // Prefill the patient name from the logged-in user for convenience.
        setPatientName(user?.name || '');
        setStep(3);
    };

    const handleDateChange = (value) => {
        setBookDate(value);
        setBookSlot('');
        setBookDay(value ? weekdayOf(value) : '');
    };

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        if (!bookDate || !bookDay || !bookSlot || !patientName.trim() || !patientAge || !patientGender || !patientPhone.trim()) return;

        setBooking(true);
        setBookError('');
        try {
            const startTime = bookSlot.split('-')[0];
            const scheduledAt = new Date(`${bookDate}T${startTime}:00`).toISOString();

            // The backend appointment stores one `reason`; fold the patient
            // details into it so the doctor still sees them.
            const reason = [
                patientReason.trim(),
                `Patient: ${patientName.trim()}, ${patientAge}/${patientGender}, Ph: ${patientPhone.trim()}`,
            ].filter(Boolean).join(' | ');

            await appointmentService.book({
                doctorId: selectedDoctor._id,
                scheduledAt,
                slot: bookSlot,
                reason,
                location: userLocation
                    ? { lat: userLocation.lat, lng: userLocation.lng, address: selectedDoctor.location?.address }
                    : undefined,
            });

            setModal({
                type: 'sent',
                message: 'Your appointment request has been sent to the doctor.',
                summary: {
                    doctor: selectedDoctor.name,
                    hospital: selectedDoctor.location?.address || selectedDoctor.specialty,
                    date: bookDate,
                    day: bookDay,
                    time: bookSlot,
                    patientName: patientName.trim(),
                    patientAge,
                    patientGender,
                    patientPhone: patientPhone.trim(),
                    patientReason: patientReason.trim(),
                },
            });
        } catch (err) {
            const status = err?.response?.status;
            if (status === 409) {
                setBookError('That slot was just taken for this doctor. Please pick another time.');
            } else {
                setBookError(apiErrorMessage(err, 'Could not book the appointment. Please try again.'));
            }
        } finally {
            setBooking(false);
        }
    };

    const handleModalClose = () => {
        setModal(null);
        setBookError('');
        setStep(1); setSelectedCategory(null); setSelectedDoctor(null);
        setBookDate(''); setBookDay(''); setBookSlot('');
        setPatientName(''); setPatientAge(''); setPatientGender(''); setPatientPhone(''); setPatientReason('');
    };

    const handleViewHistory = () => {
        setModal(null);
        navigate('/dashboard/history');
    };

    const getMinDate = () => new Date().toISOString().split('T')[0];

    const availableSlots = selectedDoctor && bookDay ? slotsForDay(selectedDoctor.availability, bookDay) : [];

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
                    {[{ num: 1, label: 'Specialty' }, { num: 2, label: 'Doctors' }, { num: 3, label: 'Book Slot' }].map((s, i, arr) => (
                        <React.Fragment key={s.num}>
                            <div className={`step ${step === s.num ? 'active' : step > s.num ? 'completed' : ''}`}>
                                <div className="step-num">{step > s.num ? '✓' : s.num}</div>
                                <span className="step-label">{s.label}</span>
                            </div>
                            {i < arr.length - 1 && <div className={`step-line ${step > s.num ? 'completed' : ''}`} />}
                        </React.Fragment>
                    ))}
                </div>

                {/* ─── Step 1: Specialty ─── */}
                {step === 1 && (
                    <div>
                        <h2 className="section-title">
                            <Stethoscope size={20} /> Select Doctor Specialty
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
                                    <span style={{ color: '#2E7D32' }}>Location ready — select a specialty to see doctors</span>
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
                            <ChevronLeft size={16} /> Back to Specialties
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

                        {/* ── Leaflet Map ── */}
                        {(mapCenter || userLocation) && !loadingLocation && (
                            <div style={{
                                height: 360, borderRadius: 16, overflow: 'hidden', marginBottom: 28,
                                border: '2px solid #E2E8F0', boxShadow: '0 4px 24px rgba(21,101,192,0.12)',
                                position: 'relative',
                            }}>
                                <div style={{
                                    position: 'absolute', top: 12, right: 12, zIndex: 1000,
                                    width: 44, height: 44, background: 'white', borderRadius: '50%',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    animation: 'compassSpin 20s linear infinite', cursor: 'default', fontSize: 20,
                                }}>
                                    🧭
                                </div>
                                <MapContainer
                                    center={[(mapCenter || userLocation).lat, (mapCenter || userLocation).lng]}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                    scrollWheelZoom={true}
                                    zoomControl={true}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                        maxZoom={20}
                                        maxNativeZoom={19}
                                    />
                                    <MapRecenter center={mapCenter ? [mapCenter.lat, mapCenter.lng] : [userLocation.lat, userLocation.lng]} />

                                    {userLocation && (
                                        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                                            <Popup><strong>📍 Your Location</strong></Popup>
                                        </Marker>
                                    )}

                                    {doctors.filter(d => d.lat != null && d.lng != null).map(doctor => (
                                        <Marker key={doctor._id} position={[doctor.lat, doctor.lng]} icon={doctorIcon}>
                                            <Popup>
                                                <div style={{ minWidth: 170 }}>
                                                    <strong style={{ fontSize: 13 }}>{doctor.name}</strong>
                                                    <p style={{ margin: '4px 0 2px', fontSize: 12, color: '#555' }}>🩺 {doctor.specialty}</p>
                                                    {doctor.location?.address && (
                                                        <p style={{ margin: 0, fontSize: 12, color: '#555' }}>🏥 {doctor.location.address}</p>
                                                    )}
                                                    {doctor.distance != null && (
                                                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555' }}>📍 {doctor.distance.toFixed(1)} km away</p>
                                                    )}
                                                    <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: '#2E7D32' }}>
                                                        ₹{doctor.consultationFee} · ● Available
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
                                <MapPin size={20} /> {selectedCategory?.name} Doctors
                            </h2>
                            <div style={{ position: 'relative', minWidth: 240 }}>
                                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                                <input
                                    type="text"
                                    value={doctorSearch}
                                    onChange={e => setDoctorSearch(e.target.value)}
                                    placeholder="Search by name or clinic…"
                                    style={{
                                        padding: '9px 14px 9px 36px', border: '2px solid #E0E7FF',
                                        borderRadius: 10, fontSize: 13, outline: 'none',
                                        fontFamily: 'inherit', width: '100%', color: '#1E293B', background: 'white',
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#1565C0'}
                                    onBlur={e => e.target.style.borderColor = '#E0E7FF'}
                                />
                            </div>
                        </div>

                        {(loadingLocation || loadingDoctors) ? (
                            <div className="loading-container">
                                <div className="loading-spinner" />
                                <p>{loadingLocation ? 'Getting your location...' : 'Loading doctors...'}</p>
                            </div>
                        ) : doctorsError ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#C62828' }}>
                                <XCircle size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <p>{doctorsError}</p>
                                <button className="btn btn-outline btn-sm" style={{ width: 'auto', marginTop: 12 }}
                                    onClick={() => getLocationAndDoctors(selectedCategory.name)}>
                                    Retry
                                </button>
                            </div>
                        ) : (() => {
                            const filtered = doctors.filter(d => {
                                const q = doctorSearch.toLowerCase();
                                return !q || d.name.toLowerCase().includes(q) ||
                                    (d.location?.address || '').toLowerCase().includes(q);
                            });
                            return filtered.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                                    <Search size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                                    <p>No approved {selectedCategory?.name} doctors found{doctorSearch ? ' for your search' : ' yet'}.</p>
                                </div>
                            ) : (
                                <div>
                                    {filtered.length > 0 && (
                                        <div style={{ marginBottom: 14 }}>
                                            <button
                                                onClick={() => handleSelectDoctor(filtered[0])}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: 'linear-gradient(135deg, #0D47A1, #0097A7)',
                                                    color: 'white', border: 'none', borderRadius: 12,
                                                    padding: '10px 20px', fontFamily: 'inherit',
                                                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                                    boxShadow: '0 4px 12px rgba(13,71,161,0.25)', transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                ⚡ Book First Available — {filtered[0].name.split(' ').slice(0, 2).join(' ')}
                                            </button>
                                        </div>
                                    )}
                                    <div className="doctor-grid">
                                        {filtered.map(doctor => {
                                            const days = availabilityDays(doctor);
                                            return (
                                                <div key={doctor._id} className="doctor-card">
                                                    <div className="doctor-card-header">
                                                        <div className="doctor-avatar">{doctorInitials(doctor.name)}</div>
                                                        <div className="doctor-info">
                                                            <h4>{doctor.name}</h4>
                                                            <p>{doctor.specialty}{doctor.qualifications ? ` · ${doctor.qualifications}` : ''}</p>
                                                            <StarDisplay rating={doctor.avgRating || 0} count={doctor.ratingCount || 0} />
                                                        </div>
                                                    </div>
                                                    <div className="doctor-meta">
                                                        {doctor.location?.address && (
                                                            <div className="doctor-meta-item">🏥 <span>{doctor.location.address}</span></div>
                                                        )}
                                                        {doctor.distance != null && (
                                                            <div className="doctor-meta-item">
                                                                <MapPin size={14} />
                                                                <span>{doctor.distance.toFixed(1)} km away</span>
                                                            </div>
                                                        )}
                                                        {days.length > 0 && (
                                                            <div className="doctor-meta-item" style={{ fontSize: 12, color: '#0277BD' }}>
                                                                <Calendar size={12} />
                                                                <span>{days.join(', ')}</span>
                                                            </div>
                                                        )}
                                                        {doctor.experienceYears > 0 && (
                                                            <div className="doctor-meta-item" style={{ fontSize: 12, color: '#64748B' }}>
                                                                <Clock size={12} />
                                                                <span>{doctor.experienceYears} yrs experience</span>
                                                            </div>
                                                        )}
                                                        <div className="doctor-meta-item" style={{ fontSize: 12, color: '#7C3AED', fontWeight: 700 }}>
                                                            <span>💳</span>
                                                            <span>Consultation: ₹{doctor.consultationFee}</span>
                                                        </div>
                                                        <div style={{ marginTop: 4 }}>
                                                            <span className="badge badge-available">✓ Available</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        style={{ width: '100%' }}
                                                        onClick={() => handleSelectDoctor(doctor)}
                                                    >
                                                        Book Appointment <ChevronRight size={14} />
                                                    </button>
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
                            <div className="doctor-avatar">{doctorInitials(selectedDoctor.name)}</div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedDoctor.name}</div>
                                <div style={{ opacity: 0.85, fontSize: 13 }}>
                                    {selectedDoctor.specialty}{selectedDoctor.location?.address ? ` · ${selectedDoctor.location.address}` : ''}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                                    ₹{selectedDoctor.consultationFee} consultation
                                    {selectedDoctor.distance != null ? ` · ${selectedDoctor.distance.toFixed(1)} km away` : ''}
                                </div>
                            </div>
                        </div>

                        <div style={{ maxWidth: 600 }}>
                            <h2 className="section-title">
                                <CalendarDays size={20} /> Select Appointment Slot
                            </h2>

                            <form onSubmit={handleBookAppointment} className="booking-form">
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

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Age</label>
                                        <input
                                            type="number" min="1" max="120"
                                            value={patientAge}
                                            onChange={e => setPatientAge(e.target.value)}
                                            placeholder="e.g. 30" required
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Gender</label>
                                        <select
                                            value={patientGender}
                                            onChange={e => setPatientGender(e.target.value)}
                                            required style={{ cursor: 'pointer' }}
                                        >
                                            <option value="">Select gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

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
                                        onChange={e => handleDateChange(e.target.value)}
                                        required
                                    />
                                </div>

                                {bookDay && (
                                    <div className="form-group">
                                        <label>Day</label>
                                        <input
                                            type="text" value={bookDay} readOnly
                                            style={{ background: '#F1F5F9', color: '#0277BD', fontWeight: 600, cursor: 'default' }}
                                        />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Select Time Slot</label>
                                    {!bookDate ? (
                                        <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Pick a date to see available slots.</p>
                                    ) : availableSlots.length === 0 ? (
                                        <div style={{
                                            background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10,
                                            padding: '10px 16px', fontSize: 13, color: '#8D6E00',
                                        }}>
                                            {selectedDoctor.name} is not available on {bookDay}. Please pick another date.
                                        </div>
                                    ) : (
                                        <div className="time-slots">
                                            {availableSlots.map(slot => (
                                                <div
                                                    key={slot}
                                                    className={`time-slot ${bookSlot === slot ? 'selected' : ''}`}
                                                    onClick={() => setBookSlot(slot)}
                                                >
                                                    {slot}
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                    disabled={booking || !bookSlot}
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

            <ConfirmationModal
                modal={modal}
                onClose={handleModalClose}
                onViewHistory={handleViewHistory}
            />
        </div>
    );
}
