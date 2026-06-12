import React, { useState, useEffect } from 'react';
import { Brain, Search, ChevronRight, AlertTriangle, CheckCircle, Stethoscope, X, History, Clock, Percent } from 'lucide-react';

// ─── Symptom → Specialist Rule Engine ────────────────────────────────────────
const SYMPTOM_RULES = [
    {
        keywords: ['chest pain', 'chest tightness', 'heart', 'palpitation', 'shortness of breath', 'breathing', 'breathless', 'irregular heartbeat'],
        specialist: 'Cardiologist', icon: '❤️', color: '#C62828', bg: '#FFEBEE', urgency: 'high',
        description: 'Symptoms suggest a possible cardiac or respiratory issue.',
        advice: 'Seek immediate medical attention if chest pain is severe. Avoid physical exertion.',
        commonConditions: ['Angina', 'Heart Attack', 'Arrhythmia', 'Pulmonary Embolism'],
    },
    {
        keywords: ['headache', 'migraine', 'seizure', 'numbness', 'memory loss', 'confusion', 'dizziness', 'fainting', 'paralysis', 'tremor', 'nerve', 'brain'],
        specialist: 'Neurologist', icon: '🧠', color: '#4527A0', bg: '#EDE7F6', urgency: 'medium',
        description: 'Symptoms point to a possible neurological condition.',
        advice: 'Avoid driving if dizzy. Note when symptoms started and their duration.',
        commonConditions: ['Migraine', 'Epilepsy', 'Parkinson\'s Disease', 'Stroke'],
    },
    {
        keywords: ['tooth', 'teeth', 'gum', 'dental', 'toothache', 'cavity', 'jaw pain', 'mouth sore', 'bleeding gums'],
        specialist: 'BDS', icon: '🦷', color: '#6A1B9A', bg: '#F3E5F5', urgency: 'low',
        description: 'Symptoms indicate a dental or oral health issue.',
        advice: 'Rinse with warm salt water. Avoid very hot or cold foods.',
        commonConditions: ['Tooth Decay', 'Gingivitis', 'Root Canal Infection', 'Periodontitis'],
    },
    {
        keywords: ['ear', 'hearing loss', 'ear pain', 'ringing', 'tinnitus', 'nose bleed', 'sinus', 'throat', 'tonsil', 'hoarse voice', 'ear discharge', 'sneezing', 'nasal'],
        specialist: 'ENT', icon: '👂', color: '#00838F', bg: '#E0F7FA', urgency: 'low',
        description: 'Symptoms suggest an ear, nose or throat condition.',
        advice: 'Avoid inserting objects in ears. Keep hydrated to soothe throat.',
        commonConditions: ['Sinusitis', 'Tinnitus', 'Tonsillitis', 'Ear Infection'],
    },
    {
        keywords: ['rash', 'itching', 'acne', 'skin', 'eczema', 'psoriasis', 'hair loss', 'dandruff', 'fungal', 'allergy', 'hives', 'blistering'],
        specialist: 'Dermatologist', icon: '🧴', color: '#E65100', bg: '#FFF3E0', urgency: 'low',
        description: 'Symptoms suggest a skin or allergic condition.',
        advice: 'Avoid scratching. Use mild soap. Wear loose, breathable clothing.',
        commonConditions: ['Eczema', 'Psoriasis', 'Fungal Infection', 'Contact Dermatitis'],
    },
    {
        keywords: ['joint pain', 'bone', 'fracture', 'back pain', 'knee', 'shoulder', 'spine', 'arthritis', 'muscle', 'sprain', 'swollen joint', 'hip', 'elbow'],
        specialist: 'Orthopedic', icon: '🦴', color: '#33691E', bg: '#F1F8E9', urgency: 'medium',
        description: 'Symptoms indicate a musculoskeletal or bone/joint issue.',
        advice: 'Rest the affected area. Apply ice for 20 minutes. Avoid heavy lifting.',
        commonConditions: ['Arthritis', 'Fracture', 'Slip Disc', 'Ligament Tear'],
    },
    {
        keywords: ['child', 'baby', 'infant', 'toddler', 'vaccination', 'fever child', 'growth', 'pediatric', 'newborn', 'developmental'],
        specialist: 'Pediatrician', icon: '👶', color: '#1565C0', bg: '#E3F2FD', urgency: 'medium',
        description: 'Symptoms are child-specific and need pediatric evaluation.',
        advice: 'Monitor temperature. Ensure child is hydrated. Keep child comfortable.',
        commonConditions: ['Childhood Fever', 'Ear Infections', 'Asthma', 'Growth Disorders'],
    },
    {
        keywords: ['period', 'menstrual', 'pregnancy', 'ovarian', 'uterus', 'vaginal', 'gynaecology', 'gynecology', 'female', 'hormonal', 'menopause', 'fertility'],
        specialist: 'Gynecologist', icon: '🌸', color: '#AD1457', bg: '#FCE4EC', urgency: 'medium',
        description: 'Symptoms relate to female reproductive health.',
        advice: 'Keep a menstrual diary. Track symptoms and their duration.',
        commonConditions: ['PCOS', 'Endometriosis', 'UTI', 'Hormonal Imbalance'],
    },
    {
        keywords: ['anxiety', 'depression', 'stress', 'mental', 'panic attack', 'mood', 'insomnia', 'sleep', 'hallucination', 'bipolar', 'ocd', 'phobia', 'trauma'],
        specialist: 'Psychiatrist', icon: '🧘', color: '#00695C', bg: '#E0F2F1', urgency: 'medium',
        description: 'Symptoms indicate a mental health condition that needs professional support.',
        advice: 'Breathe slowly. Reach out to someone you trust. Avoid isolating yourself.',
        commonConditions: ['Anxiety Disorder', 'Depression', 'Insomnia', 'PTSD'],
    },
    {
        keywords: ['herbal', 'ayurveda', 'natural treatment', 'immunity', 'digestion ayur', 'chronic', 'holistic'],
        specialist: 'BAMS', icon: '🌿', color: '#2E7D32', bg: '#E8F5E9', urgency: 'low',
        description: 'You may benefit from Ayurvedic or holistic treatment.',
        advice: 'Maintain a balanced diet. Consider lifestyle modifications.',
        commonConditions: ['Chronic Fatigue', 'Digestive Issues', 'Immunity Problems', 'Stress'],
    },
    {
        keywords: ['fever', 'cold', 'flu', 'cough', 'vomiting', 'diarrhea', 'stomach', 'nausea', 'fatigue', 'weakness', 'weight loss', 'appetite', 'general', 'body pain'],
        specialist: 'General Physician', icon: '🏥', color: '#0277BD', bg: '#E1F5FE', urgency: 'low',
        description: 'General symptoms that can be managed by a general physician first.',
        advice: 'Rest well. Stay hydrated. Monitor temperature if feverish.',
        commonConditions: ['Viral Fever', 'Gastroenteritis', 'Common Cold', 'General Weakness'],
    },
];

const URGENCY_CONFIG = {
    high: { label: 'High Urgency — Seek Immediate Help', color: '#C62828', bg: '#FFEBEE', icon: '🚨' },
    medium: { label: 'Medium Urgency — Book Appointment Soon', color: '#E65100', bg: '#FFF8E1', icon: '⚠️' },
    low: { label: 'Low Urgency — Schedule a Routine Visit', color: '#2E7D32', bg: '#E8F5E9', icon: '✅' },
};

const MAX_KEYWORDS_PER_RULE = Math.max(...SYMPTOM_RULES.map(r => r.keywords.length));

function analyzeSymptoms(text) {
    if (!text.trim()) return [];
    const lower = text.toLowerCase();
    const scored = SYMPTOM_RULES.map(rule => {
        const matches = rule.keywords.filter(kw => lower.includes(kw));
        const confidence = Math.min(100, Math.round((matches.length / Math.min(rule.keywords.length, 5)) * 100));
        return { ...rule, matches, score: matches.length, confidence };
    }).filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
}

const COMMON_SYMPTOMS = [
    'Chest pain and shortness of breath',
    'Severe headache and dizziness',
    'Toothache and swollen gums',
    'Ear pain and hearing loss',
    'Skin rash and itching',
    'Joint pain and stiffness',
    'Anxiety and sleep problems',
    'Fever, cough and weakness',
    'Child fever and ear pain',
];

const HISTORY_KEY = 'symptomCheckerHistory';

function ConfidenceBar({ pct, color }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${pct}%`, background: color,
                    borderRadius: 10, transition: 'width 0.8s ease',
                }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
        </div>
    );
}

export default function SymptomChecker() {
    const [input, setInput] = useState('');
    const [results, setResults] = useState(null);
    const [analyzed, setAnalyzed] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [history, setHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
    });
    const [showHistory, setShowHistory] = useState(false);

    const saveToHistory = (text) => {
        setHistory(prev => {
            const filtered = prev.filter(h => h !== text).slice(0, 7);
            const next = [text, ...filtered];
            localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
            return next;
        });
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem(HISTORY_KEY);
    };

    const runAnalysis = (text) => {
        if (!text.trim()) return;
        setAnalyzing(true);
        setAnalyzed(false);
        // Simulate brief analysis animation (300ms)
        setTimeout(() => {
            const res = analyzeSymptoms(text);
            setResults(res);
            setAnalyzed(true);
            setAnalyzing(false);
            saveToHistory(text.trim());
        }, 350);
    };

    const handleAnalyze = () => runAnalysis(input);
    const handleReset = () => { setInput(''); setResults(null); setAnalyzed(false); };
    const handleQuickSymptom = (s) => { setInput(s); runAnalysis(s); };
    const handleHistoryItem = (h) => { setInput(h); runAnalysis(h); setShowHistory(false); };

    return (
        <div>
            <div className="page-header">
                <h1>🤖 AI Symptom Checker</h1>
                <p>Describe your symptoms and get specialist recommendations</p>
            </div>

            <div className="page-body">
                {/* Disclaimer */}
                <div style={{
                    background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12,
                    padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start'
                }}>
                    <AlertTriangle size={20} color="#F57C00" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 13, color: '#6D4C00' }}>
                        <strong>Disclaimer:</strong> This AI Symptom Checker is for educational purposes only.
                        It does not replace professional medical diagnosis. Always consult a qualified doctor.
                    </div>
                </div>

                {/* Input Card */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: 'linear-gradient(135deg, #0D47A1, #00ACC1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Brain size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>Describe Your Symptoms</div>
                                    <div style={{ fontSize: 12, color: '#64748B' }}>Type in plain language — e.g. "I have chest pain and breathing issues"</div>
                                </div>
                            </div>
                            {history.length > 0 && (
                                <button
                                    onClick={() => setShowHistory(s => !s)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: showHistory ? '#EEF2FF' : '#F1F5F9',
                                        color: showHistory ? '#1565C0' : '#64748B',
                                        border: showHistory ? '1.5px solid #C7D2FE' : '1.5px solid #E2E8F0',
                                        borderRadius: 10, padding: '7px 12px',
                                        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    <History size={14} /> Recent ({history.length})
                                </button>
                            )}
                        </div>

                        {/* History dropdown */}
                        {showHistory && history.length > 0 && (
                            <div style={{
                                background: '#F8FAFF', border: '1.5px solid #E0E7FF', borderRadius: 12,
                                padding: '12px', marginBottom: 16,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Recent Searches
                                    </span>
                                    <button onClick={clearHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 12, fontFamily: 'inherit' }}>
                                        Clear all
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {history.map((h, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleHistoryItem(h)}
                                            style={{
                                                background: 'white', border: '1px solid #E0E7FF', borderRadius: 8,
                                                padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                                                fontFamily: 'inherit', fontSize: 13, color: '#475569',
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <Clock size={13} color="#94A3B8" style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <textarea
                            value={input}
                            onChange={e => { setInput(e.target.value); setAnalyzed(false); }}
                            placeholder={`Describe your symptoms in detail...\n\nExamples:\n• "I have a severe headache with dizziness and nausea"\n• "My child has high fever and ear pain"\n• "Chest pain when breathing deeply, shortness of breath"`}
                            rows={5}
                            style={{
                                width: '100%', padding: '16px', border: '2px solid #E0E7FF',
                                borderRadius: 12, fontFamily: 'inherit', fontSize: 14,
                                color: '#1E293B', background: '#F8FAFF', outline: 'none',
                                resize: 'vertical', transition: 'border-color 0.2s', lineHeight: 1.6,
                                boxSizing: 'border-box',
                            }}
                            onFocus={e => e.target.style.borderColor = '#1565C0'}
                            onBlur={e => e.target.style.borderColor = '#E0E7FF'}
                        />

                        {/* Analyzing progress bar */}
                        {analyzing && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0277BD', marginBottom: 6 }}>
                                    <div style={{ width: 14, height: 14, border: '2px solid #BFDBFE', borderTopColor: '#0277BD', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                    Analyzing symptoms…
                                </div>
                                <div style={{ height: 4, background: '#E0E7FF', borderRadius: 10, overflow: 'hidden' }}>
                                    <div className="analyze-shimmer" style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #0D47A1, #0097A7)', borderRadius: 10, animation: 'analyzeProgress 0.35s ease-out forwards' }} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                            <button className="btn btn-primary" onClick={handleAnalyze} disabled={!input.trim() || analyzing} style={{ flex: 1 }}>
                                <Search size={16} />
                                {analyzing ? 'Analyzing…' : 'Analyze Symptoms'}
                            </button>
                            {analyzed && (
                                <button className="btn btn-outline" onClick={handleReset} style={{ width: 'auto' }}>
                                    <X size={16} /> Reset
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Examples */}
                {!analyzed && !analyzing && (
                    <div style={{ marginBottom: 28 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Quick Examples
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {COMMON_SYMPTOMS.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickSymptom(s)}
                                    style={{
                                        background: 'white', border: '1.5px solid #E0E7FF',
                                        borderRadius: 20, padding: '7px 14px', fontSize: 13,
                                        color: '#1565C0', cursor: 'pointer', fontFamily: 'inherit',
                                        fontWeight: 500, transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#1565C0'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E0E7FF'; }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                {analyzed && results !== null && (
                    <div>
                        {results.length === 0 ? (
                            <div className="card">
                                <div className="empty-state">
                                    <div className="empty-icon">🔍</div>
                                    <h3>No Match Found</h3>
                                    <p>Try using more specific medical terms or common symptom descriptions.</p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
                                    <strong>{results.length}</strong> possible specialist{results.length > 1 ? 's' : ''} found based on your symptoms:
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    {results.map((r, i) => {
                                        const urgency = URGENCY_CONFIG[r.urgency];
                                        return (
                                            <div key={r.specialist} className="card" style={{
                                                border: i === 0 ? `2px solid ${r.color}40` : '2px solid #E0E7FF',
                                                position: 'relative', overflow: 'visible',
                                            }}>
                                                {i === 0 && (
                                                    <div style={{
                                                        position: 'absolute', top: -12, left: 20,
                                                        background: r.color, color: 'white',
                                                        fontSize: 11, fontWeight: 700, padding: '3px 12px',
                                                        borderRadius: 20, letterSpacing: '0.05em',
                                                    }}>
                                                        ⭐ BEST MATCH
                                                    </div>
                                                )}
                                                <div className="card-body">
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                                                        <div style={{
                                                            width: 64, height: 64, borderRadius: 16, background: r.bg,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 30, flexShrink: 0, border: `2px solid ${r.color}30`,
                                                        }}>
                                                            {r.icon}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                                                                <h3 style={{ fontSize: 18, fontWeight: 800, color: r.color }}>{r.specialist}</h3>
                                                                <span style={{
                                                                    background: urgency.bg, color: urgency.color,
                                                                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                                                }}>
                                                                    {urgency.icon} {urgency.label}
                                                                </span>
                                                            </div>

                                                            {/* Confidence score */}
                                                            <div style={{ marginBottom: 12 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                                    <Percent size={13} color={r.color} />
                                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Match Confidence</span>
                                                                </div>
                                                                <ConfidenceBar pct={r.confidence} color={r.color} />
                                                            </div>

                                                            <p style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>{r.description}</p>

                                                            <div style={{ marginBottom: 12 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginRight: 8 }}>Matched symptoms:</span>
                                                                {r.matches.map(m => (
                                                                    <span key={m} style={{
                                                                        background: `${r.color}15`, color: r.color,
                                                                        fontSize: 12, padding: '2px 8px', borderRadius: 12,
                                                                        marginRight: 4, fontWeight: 600, display: 'inline-block', marginBottom: 4,
                                                                    }}>{m}</span>
                                                                ))}
                                                            </div>

                                                            <div style={{ marginBottom: 12 }}>
                                                                <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Possible Conditions</p>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                    {r.commonConditions.map(c => (
                                                                        <span key={c} style={{ background: '#F1F5F9', color: '#475569', fontSize: 12, padding: '3px 10px', borderRadius: 12, fontWeight: 500 }}>{c}</span>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div style={{
                                                                background: `${r.color}08`, border: `1px solid ${r.color}20`,
                                                                borderRadius: 10, padding: '10px 14px',
                                                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                                            }}>
                                                                <CheckCircle size={16} color={r.color} style={{ flexShrink: 0, marginTop: 1 }} />
                                                                <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                                                                    <strong style={{ color: r.color }}>Immediate Advice:</strong> {r.advice}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* CTA */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #0D47A1, #0097A7)',
                                    borderRadius: 16, padding: '24px 28px', marginTop: 24,
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    flexWrap: 'wrap', gap: 16,
                                }}>
                                    <div>
                                        <p style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Ready to book an appointment?</p>
                                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Find a {results[0]?.specialist} near you right now.</p>
                                    </div>
                                    <a href="/dashboard/book" style={{
                                        background: 'white', color: '#0D47A1', padding: '11px 22px',
                                        borderRadius: 10, fontWeight: 700, fontSize: 14,
                                        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <Stethoscope size={16} /> Book Now <ChevronRight size={16} />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
