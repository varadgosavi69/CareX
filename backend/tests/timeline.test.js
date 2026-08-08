// Timeline integration tests — verifies the unified GET /api/timeline/:patientId
// endpoint using real CareX auth tokens and a real in-memory MongoDB.
//
// Covers:
//  • All 5 record types appear in the response
//  • Records are sorted newest → oldest (date descending)
//  • Normalised envelope shape: { type, date, summary, refId, meta }
//  • Auth/RBAC: 401 without token, 403 for patient role, 400 for bad patientId

import { jest } from '@jest/globals';
import request from 'supertest';

// ── Mock Cloudinary BEFORE app import so report.service uses the fake ──────────
jest.unstable_mockModule('../src/services/upload.service.js', () => ({
  uploadToCloudinary: jest.fn(async () => ({
    secure_url: 'https://res.cloudinary.com/demo/test-report.pdf',
    public_id: 'carex/reports/timeline_test_001',
  })),
  deleteFromCloudinary: jest.fn(async () => ({ result: 'ok' })),
}));

const { default: app } = await import('../src/app.js');

import {
  createAdmin,
  registerPatient,
  setupApprovedDoctor,
  bookAppointment,
  bearer,
} from './helpers.js';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

/** Book an appointment and approve it so a prescription can be written. */
const bookAndApprove = async (patientToken, doctorId, doctorToken, overrides = {}) => {
  const { appointment } = await bookAppointment(app, patientToken, doctorId, overrides);
  await request(app)
    .patch(`/api/appointments/${appointment._id}/status`)
    .set('Authorization', bearer(doctorToken))
    .send({ status: 'approved' });
  return appointment;
};

/** Write a prescription for an approved appointment. */
const writePrescription = (appointmentId, doctorToken, medicines = [{ name: 'Amoxicillin', dosage: '500mg' }]) =>
  request(app)
    .post(`/api/appointments/${appointmentId}/prescription`)
    .set('Authorization', bearer(doctorToken))
    .send({ medicines, notes: 'Take after meals' });

/** Upload a report (Cloudinary is mocked). */
const uploadReport = (patientToken) => {
  const pdf = Buffer.from('%PDF-1.4 fake');
  return request(app)
    .post('/api/reports')
    .set('Authorization', bearer(patientToken))
    .attach('file', pdf, { filename: 'bloodwork.pdf', contentType: 'application/pdf' });
};

/** Record a vital via the Phase 1 endpoint. */
const recordVital = (patientId, doctorToken, overrides = {}) =>
  request(app)
    .post('/api/vitals')
    .set('Authorization', bearer(doctorToken))
    .send({
      patientId,
      type: 'HeartRate',
      value: { single: 72 },
      unit: 'bpm',
      ...overrides,
    });

/** Record a lab result via the Phase 1 endpoint. */
const recordLabResult = (patientId, doctorToken, overrides = {}) =>
  request(app)
    .post('/api/lab-results')
    .set('Authorization', bearer(doctorToken))
    .send({
      patientId,
      testName: 'HbA1c',
      value: 5.8,
      unit: '%',
      referenceRange: '4.0-5.6%',
      ...overrides,
    });

// ══════════════════════════════════════════════════════════════════════════════
// Main test suite
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/timeline/:patientId', () => {
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
    const res = await request(app).get(`/api/timeline/${patientId}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('patient role cannot access timeline → 403', async () => {
    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(patientToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('invalid patientId path param → 400', async () => {
    const res = await request(app)
      .get('/api/timeline/not-a-valid-objectid')
      .set('Authorization', bearer(doctorToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  // ── Empty timeline ──────────────────────────────────────────────────────────
  test('patient with no records returns empty timeline → 200', async () => {
    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.timeline).toEqual([]);
  });

  // ── Envelope shape ──────────────────────────────────────────────────────────
  test('each timeline event has the correct normalised shape', async () => {
    await recordVital(patientId, doctorToken);

    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const [event] = res.body.data.timeline;
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('date');
    expect(event).toHaveProperty('summary');
    expect(event).toHaveProperty('refId');
    expect(event).toHaveProperty('meta');
    expect(typeof event.summary).toBe('string');
  });

  // ── All 5 types appear ──────────────────────────────────────────────────────
  test('all 5 record types appear when each has been created', async () => {
    // 1. Appointment (books and stays pending — still shows in timeline)
    await bookAppointment(app, patientToken, doctorId);

    // 2. Prescription (needs approved appointment)
    const appt = await bookAndApprove(patientToken, doctorId, doctorToken);
    await writePrescription(appt._id, doctorToken);

    // 3. Report (Cloudinary mocked)
    await uploadReport(patientToken);

    // 4. Vital
    await recordVital(patientId, doctorToken);

    // 5. Lab result
    await recordLabResult(patientId, doctorToken);

    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);

    const types = res.body.data.timeline.map((e) => e.type);
    expect(types).toContain('Appointment');
    expect(types).toContain('Prescription');
    expect(types).toContain('Report');
    expect(types).toContain('Vital');
    expect(types).toContain('LabResult');
  });

  // ── Chronological sort (newest first) ──────────────────────────────────────
  test('records are sorted newest → oldest regardless of type', async () => {
    // Insert records with explicit, well-separated dates so the order is deterministic.
    // Jan 2024 vital (oldest)
    await recordVital(patientId, doctorToken, {
      type: 'SpO2',
      value: { single: 98 },
      unit: '%',
      recordedAt: '2024-01-05T08:00:00.000Z',
    });

    // Mar 2024 lab result
    await recordLabResult(patientId, doctorToken, {
      testName: 'LDL',
      value: 130,
      unit: 'mg/dL',
      recordedAt: '2024-03-10T10:00:00.000Z',
    });

    // Jun 2024 vital (newest clinical measurement)
    await recordVital(patientId, doctorToken, {
      type: 'BloodGlucose',
      value: { single: 95 },
      unit: 'mg/dL',
      recordedAt: '2024-06-20T07:30:00.000Z',
    });

    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const timeline = res.body.data.timeline;
    expect(timeline.length).toBe(3);

    // Dates must be monotonically decreasing
    for (let i = 0; i < timeline.length - 1; i++) {
      const curr = new Date(timeline[i].date).getTime();
      const next = new Date(timeline[i + 1].date).getTime();
      expect(curr).toBeGreaterThanOrEqual(next);
    }

    // Explicit order: BloodGlucose (Jun) → LDL (Mar) → SpO2 (Jan)
    expect(timeline[0].meta.vitalType ?? timeline[0].meta.testName).toBe('BloodGlucose');
    expect(timeline[1].meta.testName).toBe('LDL');
    expect(timeline[2].meta.vitalType).toBe('SpO2');
  });

  // ── Mixed-type chronological merge ─────────────────────────────────────────
  test('appointment, prescription, vital, and lab result merge correctly in date order', async () => {
    // Vital recorded on Feb 1 (will be 3rd)
    await recordVital(patientId, doctorToken, {
      type: 'HeartRate',
      value: { single: 76 },
      unit: 'bpm',
      recordedAt: '2024-02-01T09:00:00.000Z',
    });

    // Lab result recorded on Apr 15 (will be 1st — newest)
    await recordLabResult(patientId, doctorToken, {
      testName: 'Serum Creatinine',
      value: 1.1,
      unit: 'mg/dL',
      recordedAt: '2024-04-15T11:00:00.000Z',
    });

    // Approve an appointment (scheduledAt is set by bookAppointment ~7 days out,
    // so it will be in the future and thus newer than both clinical records)
    const appt = await bookAndApprove(patientToken, doctorId, doctorToken);
    const apptDate = new Date(appt.scheduledAt).getTime();

    // Write a prescription for it (createdAt will be ~now, also after the Apr lab)
    await writePrescription(appt._id, doctorToken, [
      { name: 'Metformin', dosage: '500mg', frequency: 'twice daily' },
      { name: 'Aspirin', dosage: '75mg' },
    ]);

    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    const timeline = res.body.data.timeline;
    expect(timeline.length).toBe(4);

    // Whole list must be sorted newest → oldest
    for (let i = 0; i < timeline.length - 1; i++) {
      const curr = new Date(timeline[i].date).getTime();
      const next = new Date(timeline[i + 1].date).getTime();
      expect(curr).toBeGreaterThanOrEqual(next);
    }

    // Oldest two entries must be the Vital (Feb 1) and LabResult (Apr 15)
    // The Appointment and Prescription are both newer (future scheduledAt / now)
    const types = timeline.map((e) => e.type);
    expect(types).toContain('Appointment');
    expect(types).toContain('Prescription');
    expect(types).toContain('Vital');
    expect(types).toContain('LabResult');

    // Vital must be last (oldest date)
    expect(timeline[timeline.length - 1].type).toBe('Vital');
  });

  // ── Summary strings ─────────────────────────────────────────────────────────
  test('Vital summary contains type and value+unit', async () => {
    await recordVital(patientId, doctorToken, {
      type: 'Temperature',
      value: { single: 37.5 },
      unit: '°C',
    });
    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    const vital = res.body.data.timeline.find((e) => e.type === 'Vital');
    expect(vital.summary).toMatch(/Temperature/);
    expect(vital.summary).toMatch(/37\.5/);
    expect(vital.summary).toMatch(/°C/);
  });

  test('BloodPressure summary uses systolic/diastolic format', async () => {
    await recordVital(patientId, doctorToken, {
      type: 'BloodPressure',
      value: { systolic: 118, diastolic: 76 },
      unit: 'mmHg',
    });
    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    const vital = res.body.data.timeline.find((e) => e.type === 'Vital');
    expect(vital.summary).toMatch(/118\/76/);
    expect(vital.summary).toMatch(/mmHg/);
  });

  test('LabResult summary includes testName, value, unit, and reference range', async () => {
    await recordLabResult(patientId, doctorToken, {
      testName: 'HbA1c',
      value: 5.8,
      unit: '%',
      referenceRange: '4.0-5.6%',
    });
    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    const lab = res.body.data.timeline.find((e) => e.type === 'LabResult');
    expect(lab.summary).toMatch(/HbA1c/);
    expect(lab.summary).toMatch(/5\.8/);
    expect(lab.summary).toMatch(/%/);
    expect(lab.summary).toMatch(/4\.0-5\.6%/);
  });

  test('Prescription summary shows first medicine name', async () => {
    const appt = await bookAndApprove(patientToken, doctorId, doctorToken);
    await writePrescription(appt._id, doctorToken, [
      { name: 'Paracetamol', dosage: '500mg' },
      { name: 'Ibuprofen', dosage: '400mg' },
    ]);
    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    const rx = res.body.data.timeline.find((e) => e.type === 'Prescription');
    expect(rx.summary).toMatch(/Paracetamol/);
    // Two medicines → "+1 more"
    expect(rx.summary).toMatch(/\+1 more/);
  });

  // ── Admin access ────────────────────────────────────────────────────────────
  test('admin can also fetch the timeline', async () => {
    await recordVital(patientId, doctorToken);
    const res = await request(app)
      .get(`/api/timeline/${patientId}`)
      .set('Authorization', bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThanOrEqual(1);
  });
});
