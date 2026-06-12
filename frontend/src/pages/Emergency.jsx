import React, { useState } from 'react';
import { Phone, AlertTriangle, ShieldAlert, MapPin, ChevronDown, ChevronUp, Heart, Wind, Flame, Scissors } from 'lucide-react';

const FIRST_AID_GUIDES = [
    {
        title: 'CPR (Cardiopulmonary Resuscitation)',
        icon: <Heart size={18} color="#C62828" />,
        color: '#C62828',
        bg: '#FFEBEE',
        steps: [
            'Call 108 immediately before starting CPR.',
            'Place the person on their back on a firm surface.',
            'Kneel beside them and place heel of hand on center of chest.',
            'Press down firmly at least 5cm (2 inches), 100–120 times per minute.',
            'After 30 compressions, tilt head back, lift chin, and give 2 rescue breaths.',
            'Continue 30:2 cycle until help arrives or the person recovers.',
        ],
        note: '🚨 Only perform CPR if the person is unresponsive and not breathing normally.',
    },
    {
        title: 'Choking — Heimlich Maneuver',
        icon: <Wind size={18} color="#1565C0" />,
        color: '#1565C0',
        bg: '#E3F2FD',
        steps: [
            'Ask "Are you choking?" — if they cannot speak/cough, act immediately.',
            'Stand behind the person and wrap arms around their waist.',
            'Make a fist with one hand and place it thumb-side on abdomen (above navel, below ribs).',
            'Grasp fist with other hand and give quick upward thrusts.',
            'Repeat until object is dislodged or person loses consciousness.',
            'If unconscious, begin CPR and call 108.',
        ],
        note: 'For infants: use 5 back blows + 5 chest thrusts instead.',
    },
    {
        title: 'Burns — First Aid',
        icon: <Flame size={18} color="#E65100" />,
        color: '#E65100',
        bg: '#FFF3E0',
        steps: [
            'Remove person from source of heat/flame safely.',
            'Cool the burn under cool (not ice cold) running water for 20 minutes.',
            'Do NOT apply butter, toothpaste, or ice.',
            'Remove jewelry/tight items near the burn gently.',
            'Cover loosely with clean cling film or a non-fluffy bandage.',
            'Seek medical attention for burns larger than your hand or on face/hands/genitals.',
        ],
        note: 'Call 108 for severe burns with charred or white skin.',
    },
    {
        title: 'Bleeding — Wound Control',
        icon: <Scissors size={18} color="#AD1457" />,
        color: '#AD1457',
        bg: '#FCE4EC',
        steps: [
            'Wear gloves if available. Stay calm.',
            'Apply firm, direct pressure with a clean cloth or bandage.',
            'Do NOT remove the cloth — add more material on top if soaked.',
            'Elevate the injured area above the heart if possible.',
            'Keep pressure for at least 10–15 minutes continuously.',
            'Call 108 if bleeding does not slow after 15 minutes, or if wound is deep.',
        ],
        note: 'For embedded objects: do NOT remove them — pack around them instead.',
    },
];

function FirstAidAccordion() {
    const [open, setOpen] = useState(null);
    return (
        <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                🩹 First Aid Quick Guide
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FIRST_AID_GUIDES.map((guide, i) => {
                    const isOpen = open === i;
                    return (
                        <div key={i} style={{
                            background: isOpen ? guide.bg : 'white',
                            border: `2px solid ${isOpen ? guide.color + '50' : '#E2E8F0'}`,
                            borderRadius: 14, overflow: 'hidden', transition: 'all 0.25s',
                        }}>
                            <button
                                onClick={() => setOpen(isOpen ? null : i)}
                                style={{
                                    width: '100%', padding: '14px 18px', border: 'none', cursor: 'pointer',
                                    background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, background: guide.bg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: `1.5px solid ${guide.color}30`, flexShrink: 0,
                                    }}>
                                        {guide.icon}
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{guide.title}</span>
                                </div>
                                {isOpen ? <ChevronUp size={18} color="#64748B" /> : <ChevronDown size={18} color="#64748B" />}
                            </button>
                            {isOpen && (
                                <div style={{ padding: '0 18px 16px' }}>
                                    <ol style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
                                        {guide.steps.map((step, si) => (
                                            <li key={si} style={{ marginBottom: 4 }}>{step}</li>
                                        ))}
                                    </ol>
                                    <div style={{
                                        marginTop: 12, background: guide.bg,
                                        border: `1px solid ${guide.color}30`, borderRadius: 8,
                                        padding: '8px 12px', fontSize: 12, color: guide.color, fontWeight: 600,
                                    }}>
                                        {guide.note}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function Emergency() {
    const [called, setCalled] = useState(false);

    const handleEmergency = () => {
        setCalled(true);
        window.location.href = 'tel:108';
        setTimeout(() => setCalled(false), 5000);
    };

    const handleFindHospital = () => {
        window.open('https://www.google.com/maps/search/hospitals+near+me/', '_blank', 'noopener');
    };

    return (
        <div>
            <div className="page-header">
                <h1>Emergency Services</h1>
                <p>Immediate medical assistance & first aid guidance</p>
            </div>

            <div className="page-body">
                <div className="emergency-page">
                    {/* Main emergency button */}
                    <div className="emergency-pulse">
                        <button
                            className="emergency-btn"
                            onClick={handleEmergency}
                            id="emergency-call-btn"
                        >
                            <Phone size={36} fill="white" />
                            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>108</span>
                            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>CALL NOW</span>
                        </button>
                    </div>

                    {/* Info */}
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#C62828', marginBottom: 8 }}>
                            Emergency Ambulance
                        </h2>
                        <p style={{ color: '#64748B', fontSize: 16, maxWidth: 400 }}>
                            Press the button above to immediately dial <strong>108</strong> for an ambulance.
                        </p>
                    </div>

                    {called && (
                        <div style={{
                            background: '#E8F5E9', border: '2px solid #4CAF50', borderRadius: 12,
                            padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
                            color: '#2E7D32', fontWeight: 600, fontSize: 14, maxWidth: 480
                        }}>
                            <Phone size={18} />
                            Initiating call to 108 ambulance services...
                        </div>
                    )}

                    {/* Find Nearby Hospital */}
                    <button
                        onClick={handleFindHospital}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: 'linear-gradient(135deg, #0D47A1, #1976D2)',
                            color: 'white', border: 'none', borderRadius: 14,
                            padding: '14px 28px', fontWeight: 700, fontSize: 15,
                            cursor: 'pointer', fontFamily: 'inherit',
                            boxShadow: '0 4px 16px rgba(13,71,161,0.3)',
                            transition: 'all 0.25s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <MapPin size={20} />
                        Find Nearby Hospital
                    </button>

                    {/* Warning */}
                    <div className="emergency-warning" style={{ maxWidth: 480 }}>
                        <AlertTriangle size={22} color="#F57C00" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <p style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Important Notice</p>
                            <p>Use only in <strong>real emergency situations</strong>. Misuse of emergency services is a punishable offence. This service connects you directly to National Ambulance Service (108).</p>
                        </div>
                    </div>

                    {/* Additional contacts */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 }}>
                        {[
                            { label: 'Ambulance', number: '108', icon: '🚑' },
                            { label: 'Police', number: '100', icon: '👮' },
                            { label: 'Fire Brigade', number: '101', icon: '🚒' },
                            { label: 'Women Helpline', number: '1091', icon: '🆘' },
                        ].map(({ label, number, icon }) => (
                            <a
                                key={number}
                                href={`tel:${number}`}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    gap: 8, background: 'white', border: '2px solid #E0E7FF',
                                    borderRadius: 14, padding: '16px 24px', textDecoration: 'none',
                                    color: '#1E293B', transition: 'all 0.25s', minWidth: 100,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1565C0'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E0E7FF'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                <span style={{ fontSize: 28 }}>{icon}</span>
                                <span style={{ fontSize: 22, fontWeight: 800, color: '#1565C0' }}>{number}</span>
                                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</span>
                            </a>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13 }}>
                        <ShieldAlert size={16} />
                        <span>All emergency calls are free of charge from any phone</span>
                    </div>
                </div>

                {/* First Aid Guide - outside the centered emergency-page flex container */}
                <FirstAidAccordion />
            </div>
        </div>
    );
}
