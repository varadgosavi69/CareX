import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import * as profileService from '../api/services/profileService';
import { apiErrorMessage } from '../api/client';
import {
    User, Mail, Phone, Calendar, Droplets, MapPin, Heart,
    AlertCircle, Edit3, Save, X, CheckCircle, ShieldPlus, UserCircle, Users
} from 'lucide-react';

// Display options. Blood groups match the API enum exactly; gender labels are
// Title-case for display and mapped to the lowercase API enum on save.
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

// 7–20 chars: digits, spaces, and + - ( ) separators (matches the API validator).
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

const emptyProfile = {
    fullName: '',
    dob: '',
    bloodGroup: '',
    gender: '',
    mobile: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    allergies: '',
    medicalConditions: '',
};

// ─── Mapping helpers: nested API patientProfile  <->  flat form fields ──────────
const parseList = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);
const toListString = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');
const genderToApi = (label) => (label ? label.toLowerCase() : '');
const genderToLabel = (api) => (api ? api.charAt(0).toUpperCase() + api.slice(1) : '');
const dobToInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); // YYYY-MM-DD
};

// Flatten the API user (+ embedded patientProfile) into the form's flat shape.
const fromApi = (user) => {
    const pp = user?.patientProfile || {};
    const ec = pp.emergencyContact || {};
    return {
        fullName: user?.name || '',
        dob: dobToInput(pp.dateOfBirth),
        gender: genderToLabel(pp.gender),
        mobile: user?.phone || '',
        address: pp.address || '',
        bloodGroup: pp.bloodGroup || '',
        emergencyName: ec.name || '',
        emergencyPhone: ec.phone || '',
        emergencyRelation: ec.relation || '',
        allergies: toListString(pp.allergies),
        medicalConditions: toListString(pp.chronicConditions),
    };
};

// Build the PUT payload (name/phone at top level, the rest under patientProfile
// keys the backend deep-merges). Returns { payload } or { error } on bad input.
const buildPayload = (d) => {
    const payload = {};

    const name = d.fullName.trim();
    if (name) {
        if (name.length < 2) return { error: 'Full name must be at least 2 characters.' };
        payload.name = name;
    }

    const mobile = d.mobile.trim();
    if (mobile) {
        if (!PHONE_RE.test(mobile)) return { error: 'Mobile number is invalid (7–20 digits; + - ( ) allowed).' };
        payload.phone = mobile;
    }

    if (d.dob) payload.dateOfBirth = d.dob;
    if (d.gender) payload.gender = genderToApi(d.gender);
    if (d.bloodGroup) payload.bloodGroup = d.bloodGroup;

    payload.address = d.address.trim();
    payload.allergies = parseList(d.allergies);
    payload.chronicConditions = parseList(d.medicalConditions);

    const ec = {};
    const en = d.emergencyName.trim();
    const ep = d.emergencyPhone.trim();
    const er = d.emergencyRelation.trim();
    if (en) ec.name = en;
    if (ep) {
        if (!PHONE_RE.test(ep)) return { error: 'Emergency contact number is invalid (7–20 digits; + - ( ) allowed).' };
        ec.phone = ep;
    }
    if (er) ec.relation = er;
    if (Object.keys(ec).length) payload.emergencyContact = ec;

    return { payload };
};

export default function Profile() {
    const { user, setUser } = useAuth();
    const [profile, setProfile] = useState(emptyProfile);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(emptyProfile);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Load the profile from the REST API (GET /api/profile). The patientProfile
    // is embedded in the returned user.
    const load = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const { user: freshUser } = await profileService.get();
            setProfile(fromApi(freshUser));
        } catch (e) {
            setLoadError(apiErrorMessage(e, 'Could not load your profile.'));
            setProfile(fromApi(user)); // fall back to the identity from AuthContext
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    const handleEdit = () => {
        setDraft({ ...profile });
        setEditing(true);
    };

    const handleCancel = () => {
        setEditing(false);
        setDraft(emptyProfile);
    };

    // Save to PUT /api/profile, surfacing validation and request errors.
    const handleSave = async () => {
        const { payload, error } = buildPayload(draft);
        if (error) { showToast(error, 'error'); return; }
        setSaving(true);
        try {
            const updated = await profileService.update(payload);
            const flat = fromApi(updated);
            setProfile(flat);
            setDraft(flat);
            setEditing(false);
            setUser(updated); // keep AuthContext (e.g. sidebar name) in sync
            showToast('Profile saved!', 'success');
        } catch (e) {
            showToast(apiErrorMessage(e, 'Could not save profile.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const initials = profile.fullName
        ? profile.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() ?? 'U';

    const age = profile.dob
        ? Math.floor((Date.now() - new Date(profile.dob)) / (1000 * 60 * 60 * 24 * 365.25))
        : null;

    const val = editing ? draft : profile;
    const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: 'calc(100vh - 85px)' }}>
                <div className="loading-spinner" />
                <p>Loading your profile...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1>My Profile</h1>
                    <p>Manage your personal and medical information</p>
                </div>
                {!editing ? (
                    <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={handleEdit}>
                        <Edit3 size={15} /> Edit Profile
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-outline btn-sm" style={{ width: 'auto' }} onClick={handleCancel} disabled={saving}>
                            <X size={15} /> Cancel
                        </button>
                        <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={handleSave} disabled={saving}>
                            {saving ? <><div className="loading-spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Saving...</> : <><Save size={15} /> Save Changes</>}
                        </button>
                    </div>
                )}
            </div>

            <div className="page-body">
                {loadError && (
                    <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#C62828', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span>{loadError}</span>
                        <button className="btn btn-outline btn-sm" onClick={load}>Retry</button>
                    </div>
                )}

                {/* Profile Hero Card */}
                <div className="profile-hero">
                    <div className="profile-avatar-ring">
                        <div className="profile-avatar-large">{initials}</div>
                    </div>
                    <div className="profile-hero-info">
                        <h2>{profile.fullName || 'Your Name'}</h2>
                        <p>{user?.email}</p>
                        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                            {profile.bloodGroup && (
                                <span className="profile-chip chip-red">
                                    <Droplets size={13} /> {profile.bloodGroup}
                                </span>
                            )}
                            {age !== null && age > 0 && (
                                <span className="profile-chip chip-blue">
                                    <Calendar size={13} /> {age} years old
                                </span>
                            )}
                            {profile.gender && (
                                <span className="profile-chip chip-purple">
                                    <UserCircle size={13} /> {profile.gender}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="profile-grid">
                    {/* Personal Information */}
                    <div className="profile-section">
                        <div className="profile-section-header">
                            <User size={18} />
                            <h3>Personal Information</h3>
                        </div>
                        <div className="profile-fields">
                            <ProfileField
                                label="Full Name" icon={<User size={15} />}
                                value={val.fullName} editing={editing}
                                onChange={v => set('fullName', v)}
                                placeholder="Enter your full name"
                            />
                            <ProfileField
                                label="Date of Birth" icon={<Calendar size={15} />}
                                value={val.dob} editing={editing} type="date"
                                onChange={v => set('dob', v)}
                            />
                            <ProfileField
                                label="Gender" icon={<UserCircle size={15} />}
                                value={val.gender} editing={editing} type="select"
                                options={GENDER_OPTIONS} onChange={v => set('gender', v)}
                                placeholder="Select gender"
                            />
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="profile-section">
                        <div className="profile-section-header">
                            <Phone size={18} />
                            <h3>Contact Information</h3>
                        </div>
                        <div className="profile-fields">
                            <ProfileField
                                label="Email Address" icon={<Mail size={15} />}
                                value={user?.email} editing={false}
                                placeholder="—"
                            />
                            <ProfileField
                                label="Mobile Number" icon={<Phone size={15} />}
                                value={val.mobile} editing={editing} type="tel"
                                onChange={v => set('mobile', v)}
                                placeholder="+91 XXXXXXXXXX"
                            />
                            <ProfileField
                                label="Address" icon={<MapPin size={15} />}
                                value={val.address} editing={editing} type="textarea"
                                onChange={v => set('address', v)}
                                placeholder="Enter your home address"
                            />
                        </div>
                    </div>

                    {/* Medical Information */}
                    <div className="profile-section">
                        <div className="profile-section-header">
                            <Heart size={18} />
                            <h3>Medical Information</h3>
                        </div>
                        <div className="profile-fields">
                            <ProfileField
                                label="Blood Group" icon={<Droplets size={15} />}
                                value={val.bloodGroup} editing={editing} type="select"
                                options={BLOOD_GROUPS} onChange={v => set('bloodGroup', v)}
                                placeholder="Select blood group"
                            />
                            <ProfileField
                                label="Known Allergies" icon={<AlertCircle size={15} />}
                                value={val.allergies} editing={editing} type="textarea"
                                onChange={v => set('allergies', v)}
                                placeholder="Comma-separated, e.g. Penicillin, Peanuts, Latex"
                            />
                            <ProfileField
                                label="Medical Conditions" icon={<ShieldPlus size={15} />}
                                value={val.medicalConditions} editing={editing} type="textarea"
                                onChange={v => set('medicalConditions', v)}
                                placeholder="Comma-separated, e.g. Diabetes, Hypertension"
                            />
                        </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="profile-section">
                        <div className="profile-section-header">
                            <AlertCircle size={18} />
                            <h3>Emergency Contact</h3>
                        </div>
                        <div className="profile-fields">
                            <ProfileField
                                label="Contact Name" icon={<User size={15} />}
                                value={val.emergencyName} editing={editing}
                                onChange={v => set('emergencyName', v)}
                                placeholder="Name of emergency contact"
                            />
                            <ProfileField
                                label="Contact Number" icon={<Phone size={15} />}
                                value={val.emergencyPhone} editing={editing} type="tel"
                                onChange={v => set('emergencyPhone', v)}
                                placeholder="+91 XXXXXXXXXX"
                            />
                            <ProfileField
                                label="Relationship" icon={<Users size={15} />}
                                value={val.emergencyRelation} editing={editing}
                                onChange={v => set('emergencyRelation', v)}
                                placeholder="e.g. Spouse, Parent, Sibling"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className={`toast ${toast.type}`} style={{ zIndex: 9999 }}>
                    {toast.type === 'success'
                        ? <CheckCircle size={18} style={{ color: '#2E7D32', flexShrink: 0 }} />
                        : <AlertCircle size={18} style={{ color: '#C62828', flexShrink: 0 }} />}
                    <span className="toast-message">{toast.message}</span>
                </div>
            )}
        </div>
    );
}

// ─── Reusable Profile Field ────────────────────────────────────────────────────
function ProfileField({ label, icon, value, editing, onChange, type = 'text', placeholder, options }) {
    const empty = !value || value === '';

    if (editing && type === 'select') {
        return (
            <div className="profile-field">
                <label className="profile-field-label">{icon} {label}</label>
                <select
                    className="profile-field-input"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                >
                    <option value="">{placeholder}</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
        );
    }

    if (editing && type === 'textarea') {
        return (
            <div className="profile-field">
                <label className="profile-field-label">{icon} {label}</label>
                <textarea
                    className="profile-field-input profile-field-textarea"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={2}
                />
            </div>
        );
    }

    if (editing) {
        return (
            <div className="profile-field">
                <label className="profile-field-label">{icon} {label}</label>
                <input
                    type={type}
                    className="profile-field-input"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                />
            </div>
        );
    }

    // Read-only display
    return (
        <div className="profile-field">
            <label className="profile-field-label">{icon} {label}</label>
            <div className={`profile-field-value ${empty ? 'empty' : ''}`}>
                {empty ? '—' : value}
            </div>
        </div>
    );
}
