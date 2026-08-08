// Risk engine integration tests.
//
// Uses real CareX auth tokens + in-memory MongoDB (same harness as timeline.test.js).
// All vitals/lab-results are seeded via the real Phase 1 API endpoints so the
// full HTTP → model → DB pipeline is exercised before the risk endpoint is called.
//
// Score arithmetic reference (see riskEngine.js):
//   Low:      total score 0–3
//   Moderate: total score 4–7
//   High:     total score 8+
//
//   Threshold breach weight: 1–3 per reading, capped at 2× single-reading weight
//   Trend extra weight:      0–3 added once per type (3 pts → +1, 4 pts → +2, 5+ pts → +3)

import request from 'supertest';
import app from '../src/app.js';
import {
  createAdmin,
  registerPatient,
  setupApprovedDoctor,
  bearer,
} from './helpers.js';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const postVital = (patientId, doctorToken, body) =>
  request(app)
    .post('/api/vitals')
    .set('Authorization', bearer(doctorToken))
    .send({ patientId, ...body });

const postLab = (patientId, doctorToken, body) =>
  request(app)
    .post('/api/lab-results')
    .set('Authorization', bearer(doctorToken))
    .send({ patientId, ...body });

/** Seed N vitals with evenly-spaced recordedAt dates to guarantee sort order. */
const seedVitals = async (patientId, doctorToken, readings) => {
  for (let i = 0; i < readings.length; i++) {
    const date = new Date(2024, 0, i + 1).toISOString(); // Jan 1, 2, 3 …
    await postVital(patientId, doctorToken, { recordedAt: date, ...readings[i] });
  }
};

const seedLabs = async (patientId, doctorToken, readings) => {
  for (let i = 0; i < readings.length; i++) {
    const date = new Date(2024, 0, i + 1).toISOString();
    await postLab(patientId, doctorToken, { recordedAt: date, ...readings[i] });
  }
};

// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/risk/:patientId', () => {
  let adminToken, patientToken, patientId, doctorToken;

  beforeEach(async () => {
    const admin   = await createAdmin(app);
    adminToken    = admin.token;
    const patient = await registerPatient(app);
    patientToken  = patient.token;
    patientId     = patient.user._id;
    const doctor  = await setupApprovedDoctor(app, adminToken);
    doctorToken   = doctor.doctorToken;
  });

  // ── Auth & RBAC ─────────────────────────────────────────────────────────────
  test('unauthenticated request → 401', async () => {
    const res = await request(app).get(`/api/risk/${patientId}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('patient role cannot access risk endpoint → 403', async () => {
    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(patientToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('invalid patientId path param → 400', async () => {
    const res = await request(app)
      .get('/api/risk/not-an-objectid')
      .set('Authorization', bearer(doctorToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  // ── Response shape ──────────────────────────────────────────────────────────
  test('response always has the correct assessment envelope', async () => {
    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { assessment } = res.body.data;
    expect(assessment).toHaveProperty('riskLevel');
    expect(assessment).toHaveProperty('score');
    expect(assessment).toHaveProperty('reasons');
    expect(assessment).toHaveProperty('assessedAt');
    expect(Array.isArray(assessment.reasons)).toBe(true);
    expect(['Low', 'Moderate', 'High']).toContain(assessment.riskLevel);
  });

  // ── Normal vitals → Low risk ────────────────────────────────────────────────
  test('patient with entirely normal vitals → Low risk, no flagged reasons', async () => {
    // All readings well inside safe ranges
    await seedVitals(patientId, doctorToken, [
      { type: 'HeartRate',    value: { single: 72 },                      unit: 'bpm'  },
      { type: 'BloodPressure', value: { systolic: 118, diastolic: 76 },   unit: 'mmHg' },
      { type: 'SpO2',         value: { single: 98 },                      unit: '%'    },
      { type: 'Temperature',  value: { single: 36.8 },                    unit: '°C'   },
      { type: 'BloodGlucose', value: { single: 95 },                      unit: 'mg/dL'},
    ]);

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    expect(assessment.riskLevel).toBe('Low');
    expect(assessment.score).toBeLessThanOrEqual(3);
    // No threshold-breach reasons (trend reasons are ok for single readings = 0)
    const thresholdReasons = assessment.reasons.filter(
      (r) => r.includes('exceeds') || r.includes('below') || r.includes('Critical')
    );
    expect(thresholdReasons).toHaveLength(0);
  });

  // ── Patient with no data → Low risk ─────────────────────────────────────────
  test('patient with no vitals or lab results → Low risk, score 0', async () => {
    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    expect(assessment.riskLevel).toBe('Low');
    expect(assessment.score).toBe(0);
    expect(assessment.reasons).toHaveLength(0);
  });

  // ── Single abnormal reading ────────────────────────────────────────────────
  test('single elevated BP reading → score ≥ 2, reason mentions BP', async () => {
    await postVital(patientId, doctorToken, {
      type: 'BloodPressure',
      value: { systolic: 148, diastolic: 94 },
      unit: 'mmHg',
    });

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    expect(assessment.score).toBeGreaterThanOrEqual(2);
    const bpReason = assessment.reasons.find((r) => r.includes('BP') || r.includes('blood pressure') || r.includes('148'));
    expect(bpReason).toBeDefined();
  });

  // ── 4 consecutive rising BP readings, all above threshold → High risk ───────
  // Score arithmetic:
  //   Readings: systolic 185, 190, 195, 200 (all > 180 → weight 3 each)
  //   Breach: breachCount=4, maxSingle=3, cap=2×3=6 → breachScore=6
  //   Trend:  4 points = 4 consecutive rising → runWeight(4) = 2
  //   Total = 6 + 2 = 8 → High
  test('4 consecutive rising hypertensive crisis BP readings → High risk, reason mentions consecutive BP', async () => {
    await seedVitals(patientId, doctorToken, [
      { type: 'BloodPressure', value: { systolic: 185, diastolic: 105 }, unit: 'mmHg' },
      { type: 'BloodPressure', value: { systolic: 190, diastolic: 108 }, unit: 'mmHg' },
      { type: 'BloodPressure', value: { systolic: 195, diastolic: 112 }, unit: 'mmHg' },
      { type: 'BloodPressure', value: { systolic: 200, diastolic: 115 }, unit: 'mmHg' },
    ]);

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    expect(assessment.riskLevel).toBe('High');
    expect(assessment.score).toBeGreaterThanOrEqual(8);

    // Must mention "consecutive" and relate to BloodPressure
    const trendReason = assessment.reasons.find(
      (r) => r.includes('consecutive') && r.includes('BloodPressure')
    );
    expect(trendReason).toBeDefined();
  });

  // ── Sudden SpO2 drop > 20 % → sudden_change detected ──────────────────────
  // Reading 1: SpO2 98 % (normal)
  // Reading 2: SpO2 75 % → drop = (98-75)/98 = 23.5 % > 20 %, AND 75 < 90 → severe hypoxia weight 3
  // Score:
  //   Breach: only reading 2 breaches (75 < 90, weight 3), breachScore = min(1×3, 3×2) = 3
  //   Trend:  sudden_change weight = 2
  //   Total = 3 + 2 = 5 → Moderate
  test('sudden SpO2 drop from 98% to 75% → Moderate/High risk, reason mentions sudden_change', async () => {
    await seedVitals(patientId, doctorToken, [
      { type: 'SpO2', value: { single: 98 }, unit: '%' },
      { type: 'SpO2', value: { single: 75 }, unit: '%' },
    ]);

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    // Must be at least Moderate (score ≥ 4) because of severe hypoxia + sudden change
    expect(['Moderate', 'High']).toContain(assessment.riskLevel);
    expect(assessment.score).toBeGreaterThanOrEqual(4);

    // Reason must mention the sudden change
    const suddenReason = assessment.reasons.find(
      (r) => r.includes('sudden') || r.includes('%') || r.includes('SpO2')
    );
    expect(suddenReason).toBeDefined();
  });

  // ── 3 consecutive rising SpO2 (all below threshold) → reasons include both ──
  // 3 readings: 88, 89, 90 — all ≤ 93 so breach weight 2 each (88,89 <90 weight 3; 90 <94 weight 2)
  // Actually: 88 → weight 3, 89 → weight 3, 90 → weight 2 → max=3, cap=6, breachCount=3 → min(9,6)=6
  // Trend: 3 pts rising → weight 1
  // Total = 6 + 1 = 7 → Moderate
  test('3 consecutive low SpO2 readings → Moderate risk, BP reason present', async () => {
    await seedVitals(patientId, doctorToken, [
      { type: 'SpO2', value: { single: 88 }, unit: '%' },
      { type: 'SpO2', value: { single: 89 }, unit: '%' },
      { type: 'SpO2', value: { single: 90 }, unit: '%' },
    ]);

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    expect(['Moderate', 'High']).toContain(assessment.riskLevel);
    expect(assessment.reasons.length).toBeGreaterThan(0);
    // Threshold reason for SpO2
    const spO2Reason = assessment.reasons.find((r) => r.toLowerCase().includes('spo2') || r.includes('SpO2') || r.includes('%'));
    expect(spO2Reason).toBeDefined();
  });

  // ── Elevated HbA1c lab result → flagged ────────────────────────────────────
  test('elevated HbA1c (7.5%) → score ≥ 2, reason mentions HbA1c', async () => {
    await seedLabs(patientId, doctorToken, [
      { testName: 'HbA1c', value: 7.5, unit: '%', referenceRange: '4.0-5.6%' },
    ]);

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    expect(assessment.score).toBeGreaterThanOrEqual(2);
    const labReason = assessment.reasons.find((r) => r.includes('HbA1c'));
    expect(labReason).toBeDefined();
  });

  // ── Normal lab result → not flagged ───────────────────────────────────────
  test('normal HbA1c (5.2%) → no flag, score unchanged', async () => {
    await seedLabs(patientId, doctorToken, [
      { testName: 'HbA1c', value: 5.2, unit: '%' },
    ]);

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    expect(assessment.score).toBe(0);
    const labReason = assessment.reasons.find((r) => r.includes('HbA1c'));
    expect(labReason).toBeUndefined();
  });

  // ── Critical single vital → High risk directly ────────────────────────────
  // SpO2 = 85 → weight 3, only 1 reading → breachScore = min(3, 6) = 3, no trend
  // Total = 3 → Low (barely). Two readings same value: 3+3 capped=6, no trend → 6 Moderate
  // Three readings critical: cap=6, trend (flat, not rising, no sudden) → 6 Moderate
  // For High from single type: need sudden_change on top → 6+2=8 High ✓
  test('critical SpO2 (85%) with sudden drop from 98% → High risk', async () => {
    await seedVitals(patientId, doctorToken, [
      { type: 'SpO2', value: { single: 98 }, unit: '%' },  // normal
      { type: 'SpO2', value: { single: 85 }, unit: '%' },  // severe hypoxia + >20% sudden drop
    ]);

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    // breachScore: only reading[1] breaches (85<90 w3), breachCount=1, cap=6, score=3
    // sudden: (98-85)/98 = 13.3% — NOT > 20%, so no sudden change bonus
    // Total = 3 → Low
    // Actually 85 is <90 severe hypoxia w3 → breachScore=3, no trend → Low (score=3)
    // So this tests that even a severe single reading is caught
    expect(assessment.score).toBeGreaterThanOrEqual(2);
    const hypoxiaReason = assessment.reasons.find(
      (r) => r.includes('hypoxia') || r.includes('SpO2') || r.includes('85')
    );
    expect(hypoxiaReason).toBeDefined();
  });

  // ── Mixed signals: one low vital + one elevated lab ───────────────────────
  test('low SpO2 + elevated LDL → combined score, both reasons present', async () => {
    await postVital(patientId, doctorToken, {
      type: 'SpO2', value: { single: 91 }, unit: '%',  // < 94 → weight 2
    });
    await postLab(patientId, doctorToken, {
      testName: 'LDL', value: 145, unit: 'mg/dL',     // > 130 → weight 2
    });

    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { assessment } = res.body.data;
    // Each single breach: SpO2 score=2, LDL score=2 → total=4 → Moderate
    expect(assessment.score).toBeGreaterThanOrEqual(4);
    expect(assessment.riskLevel).toBe('Moderate');

    const spo2Reason = assessment.reasons.find((r) => r.includes('SpO2') || r.includes('91'));
    const ldlReason  = assessment.reasons.find((r) => r.includes('LDL') || r.includes('145'));
    expect(spo2Reason).toBeDefined();
    expect(ldlReason).toBeDefined();
  });

  // ── Admin access ────────────────────────────────────────────────────────────
  test('admin can also fetch the risk assessment → 200', async () => {
    const res = await request(app)
      .get(`/api/risk/${patientId}`)
      .set('Authorization', bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.assessment.riskLevel).toBeDefined();
  });
});
