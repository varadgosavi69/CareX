// Notes analysis integration tests.
// Uses real CareX auth tokens + in-memory MongoDB.
// Notes are seeded via the existing prescription API so the full pipeline is exercised.

import request from 'supertest';
import app from '../src/app.js';
import {
  createAdmin,
  registerPatient,
  setupApprovedDoctor,
  bookAppointment,
  bearer,
} from './helpers.js';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

/** Book + approve an appointment, then write a prescription with given notes. */
const seedPrescriptionNote = async (patientToken, doctorId, doctorToken, notes) => {
  const { appointment } = await bookAppointment(app, patientToken, doctorId);

  await request(app)
    .patch(`/api/appointments/${appointment._id}/status`)
    .set('Authorization', bearer(doctorToken))
    .send({ status: 'approved' });

  const rx = await request(app)
    .post(`/api/appointments/${appointment._id}/prescription`)
    .set('Authorization', bearer(doctorToken))
    .send({
      medicines: [{ name: 'Paracetamol', dosage: '500mg' }],
      notes,
    });

  return rx.body.data?.prescription;
};

/** Record a vital with notes text. */
const seedVitalNote = (patientId, doctorToken, notes) =>
  request(app)
    .post('/api/vitals')
    .set('Authorization', bearer(doctorToken))
    .send({
      patientId,
      type: 'HeartRate',
      value: { single: 80 },
      unit: 'bpm',
      notes,
    });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/notes-analysis/:patientId', () => {
  let adminToken, patientToken, patientId, doctorToken, doctorId;

  beforeEach(async () => {
    const admin   = await createAdmin(app);
    adminToken    = admin.token;
    const patient = await registerPatient(app);
    patientToken  = patient.token;
    patientId     = patient.user._id;
    const doctor  = await setupApprovedDoctor(app, adminToken);
    doctorToken   = doctor.doctorToken;
    doctorId      = doctor.doctorId;
  });

  // ── Auth & RBAC ─────────────────────────────────────────────────────────────
  test('unauthenticated request → 401', async () => {
    const res = await request(app).get(`/api/notes-analysis/${patientId}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('patient role cannot access notes analysis → 403', async () => {
    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(patientToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('invalid patientId → 400', async () => {
    const res = await request(app)
      .get('/api/notes-analysis/not-an-objectid')
      .set('Authorization', bearer(doctorToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  // ── Response shape ──────────────────────────────────────────────────────────
  test('response has correct envelope shape', async () => {
    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { data } = res.body;
    expect(data).toHaveProperty('totalNotes');
    expect(data).toHaveProperty('flaggedNotes');
    expect(data).toHaveProperty('analyses');
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('allMatchedSymptoms');
    expect(data.summary).toHaveProperty('allMatchedRiskIndicators');
    expect(data.summary).toHaveProperty('anyFlagged');
    expect(Array.isArray(data.analyses)).toBe(true);
  });

  // ── No notes → empty result ─────────────────────────────────────────────────
  test('patient with no notes → totalNotes 0, anyFlagged false', async () => {
    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.totalNotes).toBe(0);
    expect(res.body.data.flaggedNotes).toBe(0);
    expect(res.body.data.summary.anyFlagged).toBe(false);
    expect(res.body.data.summary.allMatchedSymptoms).toHaveLength(0);
    expect(res.body.data.summary.allMatchedRiskIndicators).toHaveLength(0);
  });

  // ── Note with no matching keywords → not flagged ────────────────────────────
  test('prescription note with no clinical keywords → flagged false, empty arrays', async () => {
    await seedPrescriptionNote(
      patientToken, doctorId, doctorToken,
      'Patient attended routine follow-up. Continue current medication.'
    );

    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.totalNotes).toBe(1);
    expect(data.flaggedNotes).toBe(0);
    expect(data.summary.anyFlagged).toBe(false);
    expect(data.analyses[0].matchedSymptoms).toHaveLength(0);
    expect(data.analyses[0].matchedRiskIndicators).toHaveLength(0);
    expect(data.analyses[0].flagged).toBe(false);
  });

  // ── "severe chest pain, worsening" → flagged true, both categories matched ──
  test('"severe chest pain, worsening" → flagged true, matches both categories', async () => {
    await seedPrescriptionNote(
      patientToken, doctorId, doctorToken,
      'Patient presenting with severe chest pain, worsening over the past 3 days. Referred for ECG.'
    );

    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.totalNotes).toBe(1);
    expect(data.flaggedNotes).toBe(1);
    expect(data.summary.anyFlagged).toBe(true);

    const analysis = data.analyses[0];
    expect(analysis.flagged).toBe(true);

    // 'chest pain' should be in matchedSymptoms
    expect(analysis.matchedSymptoms).toContain('chest pain');
    // 'worsening' should be in matchedRiskIndicators
    expect(analysis.matchedRiskIndicators).toContain('worsening');
    // 'severe' should also be in matchedRiskIndicators
    expect(analysis.matchedRiskIndicators).toContain('severe');

    // Summary union should include both
    expect(data.summary.allMatchedSymptoms).toContain('chest pain');
    expect(data.summary.allMatchedRiskIndicators).toContain('worsening');
  });

  // ── 2 symptoms (no risk indicator) → flagged true ──────────────────────────
  test('note with 2 symptoms but no risk indicator → flagged true', async () => {
    await seedPrescriptionNote(
      patientToken, doctorId, doctorToken,
      'Patient reports fever and nausea since yesterday. No vomiting.'
    );

    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const analysis = res.body.data.analyses[0];
    // fever + nausea = 2 symptoms → flagged
    expect(analysis.matchedSymptoms).toContain('fever');
    expect(analysis.matchedSymptoms).toContain('nausea');
    expect(analysis.flagged).toBe(true);
    expect(analysis.matchedRiskIndicators).toHaveLength(0);
  });

  // ── 1 symptom only → not flagged ───────────────────────────────────────────
  test('note with only 1 symptom and no risk indicator → flagged false', async () => {
    await seedPrescriptionNote(
      patientToken, doctorId, doctorToken,
      'Patient complains of mild headache. No other symptoms.'
    );

    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const analysis = res.body.data.analyses[0];
    expect(analysis.matchedSymptoms).toContain('headache');
    expect(analysis.matchedSymptoms).toHaveLength(1);
    expect(analysis.matchedRiskIndicators).toHaveLength(0);
    expect(analysis.flagged).toBe(false);
  });

  // ── Risk indicator alone → flagged true ────────────────────────────────────
  test('note with only a risk indicator → flagged true', async () => {
    await seedPrescriptionNote(
      patientToken, doctorId, doctorToken,
      'Patient is not responding to treatment. Consider changing regimen.'
    );

    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const analysis = res.body.data.analyses[0];
    expect(analysis.matchedRiskIndicators).toContain('not responding to treatment');
    expect(analysis.flagged).toBe(true);
  });

  // ── Vital notes are also analysed ──────────────────────────────────────────
  test('vital note with "acute dizziness" is picked up from vital source', async () => {
    await seedVitalNote(patientId, doctorToken, 'Patient reported acute dizziness during measurement.');

    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const vitalAnalysis = res.body.data.analyses.find(
      (a) => a.sourceType === 'Vital'
    );
    expect(vitalAnalysis).toBeDefined();
    expect(vitalAnalysis.matchedSymptoms).toContain('dizziness');
    expect(vitalAnalysis.matchedRiskIndicators).toContain('acute');
    expect(vitalAnalysis.flagged).toBe(true);
  });

  // ── Multiple notes → summary aggregates correctly ──────────────────────────
  test('multiple notes → summary contains union of all matched keywords', async () => {
    await seedPrescriptionNote(
      patientToken, doctorId, doctorToken,
      'Patient has fever and fatigue.'
    );
    await seedVitalNote(patientId, doctorToken, 'Worsening shortness of breath noted.');

    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary.allMatchedSymptoms).toContain('fever');
    expect(summary.allMatchedSymptoms).toContain('fatigue');
    expect(summary.allMatchedSymptoms).toContain('shortness of breath');
    expect(summary.allMatchedRiskIndicators).toContain('worsening');
    expect(summary.anyFlagged).toBe(true);
  });

  // ── Idempotency — re-calling doesn't duplicate records ─────────────────────
  test('calling endpoint twice does not duplicate analysis records', async () => {
    await seedPrescriptionNote(
      patientToken, doctorId, doctorToken,
      'Patient has severe chest pain.'
    );

    await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    // Call again
    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    // Should still be exactly 1 record, not 2
    expect(res.body.data.totalNotes).toBe(1);
  });

  // ── Admin access ────────────────────────────────────────────────────────────
  test('admin can also fetch notes analysis → 200', async () => {
    const res = await request(app)
      .get(`/api/notes-analysis/${patientId}`)
      .set('Authorization', bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
