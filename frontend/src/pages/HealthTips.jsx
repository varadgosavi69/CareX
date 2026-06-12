import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ChevronRight, Star, BookOpen, Zap, Shield, Apple, Activity, Wind, Brain, Droplets, Sun } from 'lucide-react';

const TIPS_DATA = [
    {
        category: 'Heart Health',
        icon: '❤️',
        color: '#C62828',
        bg: '#FFEBEE',
        spec: 'Cardiologist',
        tips: [
            { title: 'Walk 10,000 Steps Daily', body: 'Regular walking reduces risk of heart disease by up to 30%. Even 30 minutes of brisk walking daily makes a big difference.', tag: 'Exercise' },
            { title: 'Reduce Sodium Intake', body: 'High sodium raises blood pressure. Keep daily intake under 2,300mg. Avoid processed foods and canned soups.', tag: 'Diet' },
            { title: 'Monitor Blood Pressure', body: 'Check your BP monthly. Normal is below 120/80 mmHg. High BP often has no symptoms — get tested regularly.', tag: 'Screening' },
        ],
    },
    {
        category: 'Mental Wellness',
        icon: '🧘',
        color: '#00695C',
        bg: '#E0F2F1',
        spec: 'Psychiatrist',
        tips: [
            { title: 'Practice Deep Breathing', body: '5 minutes of diaphragmatic breathing daily reduces cortisol. Try the 4-7-8 technique: inhale 4s, hold 7s, exhale 8s.', tag: 'Mindfulness' },
            { title: 'Limit Screen Time Before Bed', body: 'Blue light suppresses melatonin. Put devices away 1 hour before sleep for better sleep quality and mood.', tag: 'Sleep' },
            { title: 'Stay Socially Connected', body: 'Strong social bonds add years to your life. Call a friend, join a club, or volunteer to boost mental wellbeing.', tag: 'Lifestyle' },
        ],
    },
    {
        category: 'Bone & Joint Health',
        icon: '🦴',
        color: '#33691E',
        bg: '#F1F8E9',
        spec: 'Orthopedic',
        tips: [
            { title: 'Calcium & Vitamin D', body: 'Adults need 1,000mg calcium and 600 IU Vitamin D daily. Dairy, leafy greens, fortified foods, and sunlight are great sources.', tag: 'Nutrition' },
            { title: 'Stretch Every Hour', body: 'Desk workers should stand and stretch every 50–60 minutes. Simple neck rolls and shoulder shrugs prevent chronic pain.', tag: 'Exercise' },
            { title: 'Maintain Healthy Weight', body: 'Each kg of extra weight adds 4kg of pressure on knees. Losing just 5–10% of body weight significantly reduces joint pain.', tag: 'Wellness' },
        ],
    },
    {
        category: 'Dental Care',
        icon: '🦷',
        color: '#6A1B9A',
        bg: '#F3E5F5',
        spec: 'BDS',
        tips: [
            { title: 'Brush Twice, Floss Once', body: 'Brush for 2 full minutes morning and night. Floss daily to remove plaque between teeth that brushing misses.', tag: 'Hygiene' },
            { title: 'Oil Pulling', body: '10–15 minutes of swishing coconut or sesame oil daily reduces harmful bacteria and promotes gum health.', tag: 'Natural Care' },
            { title: 'Visit Your Dentist Biannually', body: 'Early detection of cavities, gum disease, and oral cancer saves time, money, and pain. Book every 6 months.', tag: 'Screening' },
        ],
    },
    {
        category: 'Skin Health',
        icon: '🧴',
        color: '#E65100',
        bg: '#FFF3E0',
        spec: 'Dermatologist',
        tips: [
            { title: 'SPF 30+ Every Day', body: 'UV damage is cumulative. Apply broad-spectrum SPF 30 or higher daily — even on cloudy days or indoors near windows.', tag: 'Protection' },
            { title: 'Hydrate from Inside Out', body: 'Drink 8+ glasses of water daily. Foods rich in omega-3 (fish, walnuts) keep skin supple and combat inflammation.', tag: 'Nutrition' },
            { title: 'Keep Showers Short & Cool', body: 'Long hot showers strip natural oils. Limit to 5–10 minutes with lukewarm water, then moisturize immediately after.', tag: 'Hygiene' },
        ],
    },
    {
        category: 'General Wellness',
        icon: '🏥',
        color: '#0277BD',
        bg: '#E1F5FE',
        spec: 'General Physician',
        tips: [
            { title: 'Annual Health Checkup', body: 'A full blood panel, BMI, BP, and blood sugar test yearly catches problems early when they\'re easiest to treat.', tag: 'Screening' },
            { title: 'Sleep 7–9 Hours', body: 'Chronic sleep deprivation increases risk of obesity, diabetes, and heart disease. Consistent sleep & wake times improve quality.', tag: 'Sleep' },
            { title: 'Eat the Rainbow', body: 'Each color of fruit/vegetable contains different phytonutrients. Aim for 5+ servings of varied color produce daily.', tag: 'Nutrition' },
        ],
    },
];

const TAG_COLORS = {
    Exercise: { bg: '#E3F2FD', color: '#1565C0' },
    Diet: { bg: '#E8F5E9', color: '#2E7D32' },
    Screening: { bg: '#FFF8E1', color: '#E65100' },
    Nutrition: { bg: '#E8F5E9', color: '#2E7D32' },
    Sleep: { bg: '#EDE7F6', color: '#4527A0' },
    Lifestyle: { bg: '#E0F7FA', color: '#00838F' },
    Mindfulness: { bg: '#E0F2F1', color: '#00695C' },
    Wellness: { bg: '#F3E5F5', color: '#6A1B9A' },
    Hygiene: { bg: '#FFF3E0', color: '#E65100' },
    'Natural Care': { bg: '#E8F5E9', color: '#2E7D32' },
    Protection: { bg: '#FFEBEE', color: '#C62828' },
};

export default function HealthTips() {
    const [activeCategory, setActiveCategory] = useState('all');
    const [savedTips, setSavedTips] = useState(() => {
        try { return JSON.parse(localStorage.getItem('savedHealthTips') || '[]'); } catch { return []; }
    });
    const navigate = useNavigate();

    const toggleSave = (key) => {
        setSavedTips(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
            localStorage.setItem('savedHealthTips', JSON.stringify(next));
            return next;
        });
    };

    const visibleCategories = activeCategory === 'all'
        ? TIPS_DATA
        : TIPS_DATA.filter(c => c.category === activeCategory);

    const totalTips = TIPS_DATA.reduce((s, c) => s + c.tips.length, 0);

    return (
        <div>
            <div className="page-header">
                <h1>💡 Health Tips</h1>
                <p>Evidence-based tips to keep you healthy, by specialist category</p>
            </div>

            <div className="page-body">
                {/* Banner */}
                <div style={{
                    background: 'linear-gradient(135deg, #0D47A1, #0097A7)',
                    borderRadius: 18, padding: '24px 28px', marginBottom: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <BookOpen size={22} color="white" />
                            <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>Your Daily Health Library</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: 0 }}>
                            {totalTips} curated tips across {TIPS_DATA.length} categories · Updated regularly
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 14 }}>
                        {[
                            { icon: <Zap size={20} color="white" />, label: 'Quick Wins' },
                            { icon: <Shield size={20} color="white" />, label: 'Prevention' },
                            { icon: <Apple size={20} color="white" />, label: 'Nutrition' },
                        ].map(item => (
                            <div key={item.label} style={{ textAlign: 'center' }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: 'rgba(255,255,255,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 4, backdropFilter: 'blur(4px)',
                                }}>{item.icon}</div>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Saved tips pill */}
                {savedTips.length > 0 && (
                    <div style={{
                        background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12,
                        padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#8D6E00',
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <Star size={15} fill="#F59E0B" color="#F59E0B" />
                        <strong>{savedTips.length} tip{savedTips.length !== 1 ? 's' : ''} saved</strong> — Tap ☆ on any tip to bookmark it for quick access
                    </div>
                )}

                {/* Category filter tabs */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                    <button
                        onClick={() => setActiveCategory('all')}
                        style={{
                            padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                            background: activeCategory === 'all' ? '#0D47A1' : '#F1F5F9',
                            color: activeCategory === 'all' ? 'white' : '#64748B',
                            transition: 'all 0.2s',
                        }}
                    >
                        All ({totalTips})
                    </button>
                    {TIPS_DATA.map(cat => (
                        <button
                            key={cat.category}
                            onClick={() => setActiveCategory(cat.category)}
                            style={{
                                padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                                background: activeCategory === cat.category ? cat.color : '#F1F5F9',
                                color: activeCategory === cat.category ? 'white' : '#64748B',
                                transition: 'all 0.2s',
                            }}
                        >
                            {cat.icon} {cat.category}
                        </button>
                    ))}
                </div>

                {/* Tips grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                    {visibleCategories.map(cat => (
                        <div key={cat.category}>
                            {/* Category header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                marginBottom: 16, flexWrap: 'wrap', gap: 12
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 12,
                                        background: cat.bg, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: 22,
                                        border: `1.5px solid ${cat.color}30`,
                                    }}>{cat.icon}</div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>{cat.category}</div>
                                        <div style={{ fontSize: 12, color: '#64748B' }}>{cat.tips.length} tips</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/dashboard/book')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                        background: cat.bg, color: cat.color, fontWeight: 600,
                                        fontSize: 12, fontFamily: 'inherit',
                                    }}
                                >
                                    Book {cat.spec} <ChevronRight size={13} />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                                {cat.tips.map((tip, i) => {
                                    const key = `${cat.category}-${i}`;
                                    const isSaved = savedTips.includes(key);
                                    const tagStyle = TAG_COLORS[tip.tag] || { bg: '#F1F5F9', color: '#64748B' };
                                    return (
                                        <div key={i} style={{
                                            background: 'white', borderRadius: 14,
                                            border: `2px solid ${isSaved ? cat.color + '40' : '#E2E8F0'}`,
                                            padding: '18px 20px',
                                            boxShadow: isSaved ? `0 4px 16px ${cat.color}12` : '0 2px 8px rgba(0,0,0,0.04)',
                                            transition: 'all 0.25s',
                                            position: 'relative',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                                <span style={{
                                                    background: tagStyle.bg, color: tagStyle.color,
                                                    fontSize: 11, fontWeight: 700, padding: '3px 10px',
                                                    borderRadius: 20, letterSpacing: '0.03em',
                                                }}>
                                                    {tip.tag}
                                                </span>
                                                <button
                                                    onClick={() => toggleSave(key)}
                                                    title={isSaved ? 'Remove bookmark' : 'Save tip'}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        padding: 2, color: isSaved ? '#F59E0B' : '#CBD5E1',
                                                        transition: 'color 0.2s',
                                                    }}
                                                >
                                                    <Star size={18} fill={isSaved ? '#F59E0B' : 'none'} />
                                                </button>
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', marginBottom: 8 }}>
                                                {tip.title}
                                            </div>
                                            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                                                {tip.body}
                                            </p>
                                            {/* Color accent bar */}
                                            <div style={{
                                                position: 'absolute', left: 0, top: '20%', bottom: '20%',
                                                width: 3, background: cat.color, borderRadius: '0 4px 4px 0', opacity: 0.6,
                                            }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div style={{
                    marginTop: 32, background: '#F8FAFF', borderRadius: 16,
                    border: '1.5px solid #E0E7FF', padding: '20px 24px',
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                }}>
                    <Activity size={28} color="#0277BD" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', marginBottom: 2 }}>Stay Proactive with Preventive Care</div>
                        <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                            Regular checkups catch health issues before they become serious. Book your annual wellness appointment today.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard/book')}
                        className="btn btn-primary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        Book a Checkup <ChevronRight size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}
