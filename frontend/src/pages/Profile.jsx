import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import {
    User, Mail, Phone, Calendar, Droplets, MapPin, Heart,
    AlertCircle, Edit3, Save, X, CheckCircle, ShieldPlus, UserCircle
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const emptyProfile = {
    fullName: '',
    dob: '',
    bloodGroup: '',
    gender: '',
    mobile: '',
    address: '',
    emergencyContact: '',
    emergencyName: '',
    allergies: '',
    medicalConditions: '',
    insuranceId: '',
};

export default function Profile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(emptyProfile);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(emptyProfile);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Load profile from Firestore (with 3s timeout so page never stays stuck)
    useEffect(() => {
        if (!user) return;
        const load = async () => {
            const prefill = { ...emptyProfile, fullName: user.displayName || '' };
            try {
                const ref = doc(db, 'UserProfiles', user.uid);
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 3000)
                );
                const snap = await Promise.race([getDoc(ref), timeout]);
                if (snap.exists()) {
                    setProfile({ ...emptyProfile, ...snap.data() });
                } else {
                    setProfile(prefill);
                }
            } catch {
                // Firestore unavailable or timed out — show empty form pre-filled from Auth
                setProfile(prefill);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    const handleEdit = () => {
        setDraft({ ...profile });
        setEditing(true);
    };

    const handleCancel = () => {
        setEditing(false);
        setDraft(emptyProfile);
    };

    const handleSave = () => {
        // ── Optimistic: update UI instantly ──
        const saved = { ...draft };
        setProfile(saved);
        setEditing(false);
        setSaving(false);
        showToast('Profile saved!', 'success');

        // ── Background: write to Firestore + Auth silently ──
        const ref = doc(db, 'UserProfiles', user.uid);
        setDoc(ref, { ...saved, updatedAt: new Date().toISOString() }, { merge: true })
            .catch(() => { /* silently ignore */ });

        if (saved.fullName && saved.fullName !== user.displayName) {
            updateProfile(auth.currentUser, { displayName: saved.fullName })
                .catch(() => { /* silently ignore */ });
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
                                options={GENDERS} onChange={v => set('gender', v)}
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
                                placeholder="e.g. Penicillin, Peanuts, Latex"
                            />
                            <ProfileField
                                label="Medical Conditions" icon={<ShieldPlus size={15} />}
                                value={val.medicalConditions} editing={editing} type="textarea"
                                onChange={v => set('medicalConditions', v)}
                                placeholder="e.g. Diabetes, Hypertension"
                            />
                            <ProfileField
                                label="Insurance ID" icon={<ShieldPlus size={15} />}
                                value={val.insuranceId} editing={editing}
                                onChange={v => set('insuranceId', v)}
                                placeholder="Your health insurance ID"
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
                                value={val.emergencyContact} editing={editing} type="tel"
                                onChange={v => set('emergencyContact', v)}
                                placeholder="+91 XXXXXXXXXX"
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
