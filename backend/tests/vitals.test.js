// Vitals + Lab Results integration tests.
// Verifies the full HTTP → middleware → Zod validation → controller → MongoDB
// stack that was merged from Phase 1 into the real CareX backend.

import request from 'supertest';
import app from '../src/app.js';
import {
  registerPatient,
  createAdmin,
  setupApprovedDoctor,
  bearer,
} from './helpers.js';

// ─── Shared state across tests in this file ────────────────────────────────────
let adminToken;
let patientToken;
let patientId;
let doctorToken;

beforeEach(async () => {
  const admin = await createAdmin(app);
  adminToken = admin.token;

  const patient = await registerPatient(app);
  patientToken = patient.token;
  patientId = patient.user._id;

  const doctor = await setupApprovedDoctor(app, adminToken);
  doctorToken = doctor.doctorToken;
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/vitals
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/vitals', () => {
  test('doctor can record a HeartRate vital → 201', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(doctorToken))
      .send({
        patientId,
        type: 'HeartRate',
        value: { single: 78 },
        unit: 'bpm',
        recordedAt: '2024-01-10T08:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vital.type).toBe('HeartRate');
    expect(res.body.data.vital.value.single).toBe(78);
    expect(res.body.data.vital.unit).toBe('bpm');
    // recordedBy must be set from the JWT, not the request body
    expect(res.body.data.vital.recordedBy).toBeDefined();
  });

  test('doctor can record a BloodPressure vital with systolic+diastolic → 201', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(doctorToken))
      .send({
        patientId,
        type: 'BloodPressure',
        value: { systolic: 120, diastolic: 80 },
        unit: 'mmHg',
        recordedAt: '2024-01-15T09:30:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.vital.value.systolic).toBe(120);
    expect(res.body.data.vital.value.diastolic).toBe(80);
  });

  test('admin can record a vital → 201', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(adminToken))
      .send({
        patientId,
        type: 'Temperature',
        value: { single: 37.2 },
        unit: '°C',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.vital.type).toBe('Temperature');
  });

  test('unauthenticated request → 401', async () => {
    const res = await request(app).post('/api/vitals').send({
      patientId,
      type: 'HeartRate',
      value: { single: 72 },
      unit: 'bpm',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('patient role cannot record a vital → 403', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(patientToken))
      .send({
        patientId,
        type: 'HeartRate',
        value: { single: 72 },
        unit: 'bpm',
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('invalid vital type → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(doctorToken))
      .send({
        patientId,
        type: 'Cholesterol', // not in enum
        value: { single: 200 },
        unit: 'mg/dL',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('BloodPressure missing diastolic → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(doctorToken))
      .send({
        patientId,
        type: 'BloodPressure',
        value: { systolic: 120 }, // missing diastolic
        unit: 'mmHg',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  test('non-BP vital missing value.single → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(doctorToken))
      .send({
        patientId,
        type: 'HeartRate',
        value: {}, // missing single
        unit: 'bpm',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  test('invalid patientId in body → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .set('Authorization', bearer(doctorToken))
      .send({
        patientId: 'not-a-valid-objectid',
        type: 'HeartRate',
        value: { single: 72 },
        unit: 'bpm',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/vitals/:patientId
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/vitals/:patientId', () => {
  // Seed three vitals with different dates and types before each GET test
  beforeEach(async () => {
    const auth = bearer(doctorToken);
    await request(app).post('/api/vitals').set('Authorization', auth)
      .send({ patientId, type: 'SpO2',         value: { single: 98 }, unit: '%',    recordedAt: '2024-01-08T07:00:00.000Z' });
    await request(app).post('/api/vitals').set('Authorization', auth)
      .send({ patientId, type: 'HeartRate',    value: { single: 78 }, unit: 'bpm',  recordedAt: '2024-01-10T08:00:00.000Z' });
    await request(app).post('/api/vitals').set('Authorization', auth)
      .send({ patientId, type: 'BloodPressure', value: { systolic: 120, diastolic: 80 }, unit: 'mmHg', recordedAt: '2024-01-15T09:30:00.000Z' });
  });

  test('doctor fetches all vitals for a patient → 200, sorted oldest→newest', async () => {
    const res = await request(app)
      .get(`/api/vitals/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(3);

    const vitals = res.body.data.vitals;
    // Chronological order: SpO2 (Jan 8) → HeartRate (Jan 10) → BP (Jan 15)
    expect(vitals[0].type).toBe('SpO2');
    expect(vitals[1].type).toBe('HeartRate');
    expect(vitals[2].type).toBe('BloodPressure');

    // populate sanity — patientId and recordedBy should be objects, not bare IDs
    expect(typeof vitals[0].patientId).toBe('object');
    expect(typeof vitals[0].recordedBy).toBe('object');
    expect(vitals[0].patientId.name).toBeDefined();
    expect(vitals[0].recordedBy.name).toBeDefined();
  });

  test('filter by type=BloodPressure → 1 result', async () => {
    const res = await request(app)
      .get(`/api/vitals/${patientId}?type=BloodPressure`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.vitals[0].type).toBe('BloodPressure');
  });

  test('filter by date range → only matching records', async () => {
    // from Jan 9 to Jan 11 should return only HeartRate (Jan 10)
    const res = await request(app)
      .get(`/api/vitals/${patientId}?from=2024-01-09T00:00:00.000Z&to=2024-01-11T23:59:59.000Z`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.vitals[0].type).toBe('HeartRate');
  });

  test('unauthenticated request → 401', async () => {
    const res = await request(app).get(`/api/vitals/${patientId}`);
    expect(res.status).toBe(401);
  });

  test('patient role cannot read vitals → 403', async () => {
    const res = await request(app)
      .get(`/api/vitals/${patientId}`)
      .set('Authorization', bearer(patientToken));
    expect(res.status).toBe(403);
  });

  test('invalid patientId path param → 400', async () => {
    const res = await request(app)
      .get('/api/vitals/not-a-valid-objectid')
      .set('Authorization', bearer(doctorToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/lab-results
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/lab-results', () => {
  test('doctor can record a lab result → 201', async () => {
    const res = await request(app)
      .post('/api/lab-results')
      .set('Authorization', bearer(doctorToken))
      .send({
        patientId,
        testName: 'HbA1c',
        value: 5.8,
        unit: '%',
        referenceRange: '4.0-5.6%',
        recordedAt: '2024-01-12T07:00:00.000Z',
        labName: 'City Diagnostics',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.labResult.testName).toBe('HbA1c');
    expect(res.body.data.labResult.value).toBe(5.8);
    expect(res.body.data.labResult.referenceRange).toBe('4.0-5.6%');
    expect(res.body.data.labResult.recordedBy).toBeDefined();
  });

  test('admin can record a lab result → 201', async () => {
    const res = await request(app)
      .post('/api/lab-results')
      .set('Authorization', bearer(adminToken))
      .send({ patientId, testName: 'CBC — WBC', value: 7.2, unit: '10^3/µL' });
    expect(res.status).toBe(201);
  });

  test('unauthenticated request → 401', async () => {
    const res = await request(app).post('/api/lab-results')
      .send({ patientId, testName: 'LDL', value: 130, unit: 'mg/dL' });
    expect(res.status).toBe(401);
  });

  test('patient role cannot record a lab result → 403', async () => {
    const res = await request(app)
      .post('/api/lab-results')
      .set('Authorization', bearer(patientToken))
      .send({ patientId, testName: 'LDL', value: 130, unit: 'mg/dL' });
    expect(res.status).toBe(403);
  });

  test('missing testName → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/lab-results')
      .set('Authorization', bearer(doctorToken))
      .send({ patientId, value: 5.8, unit: '%' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('missing value → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/lab-results')
      .set('Authorization', bearer(doctorToken))
      .send({ patientId, testName: 'LDL', unit: 'mg/dL' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  test('invalid patientId → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/lab-results')
      .set('Authorization', bearer(doctorToken))
      .send({ patientId: 'bad-id', testName: 'LDL', value: 130, unit: 'mg/dL' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/lab-results/:patientId
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/lab-results/:patientId', () => {
  beforeEach(async () => {
    const auth = bearer(doctorToken);
    await request(app).post('/api/lab-results').set('Authorization', auth)
      .send({ patientId, testName: 'HbA1c',    value: 5.8, unit: '%',        recordedAt: '2024-01-12T07:00:00.000Z', referenceRange: '4.0-5.6%' });
    await request(app).post('/api/lab-results').set('Authorization', auth)
      .send({ patientId, testName: 'CBC — WBC', value: 7.2, unit: '10^3/µL', recordedAt: '2024-02-01T08:00:00.000Z' });
  });

  test('doctor fetches all lab results → 200, sorted oldest→newest', async () => {
    const res = await request(app)
      .get(`/api/lab-results/${patientId}`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(2);

    const labs = res.body.data.labResults;
    // HbA1c (Jan 12) must come before CBC (Feb 1)
    expect(labs[0].testName).toBe('HbA1c');
    expect(labs[1].testName).toMatch(/CBC/);

    // populate sanity
    expect(labs[0].patientId.name).toBeDefined();
    expect(labs[0].recordedBy.name).toBeDefined();
  });

  test('filter by testName (case-insensitive partial) → 1 result', async () => {
    const res = await request(app)
      .get(`/api/lab-results/${patientId}?testName=hba1c`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.labResults[0].testName).toBe('HbA1c');
  });

  test('filter by date range → only matching records', async () => {
    // Jan 12 only
    const res = await request(app)
      .get(`/api/lab-results/${patientId}?from=2024-01-01T00:00:00.000Z&to=2024-01-31T23:59:59.000Z`)
      .set('Authorization', bearer(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.labResults[0].testName).toBe('HbA1c');
  });

  test('unauthenticated request → 401', async () => {
    const res = await request(app).get(`/api/lab-results/${patientId}`);
    expect(res.status).toBe(401);
  });

  test('patient role cannot read lab results → 403', async () => {
    const res = await request(app)
      .get(`/api/lab-results/${patientId}`)
      .set('Authorization', bearer(patientToken));
    expect(res.status).toBe(403);
  });

  test('invalid patientId path param → 400', async () => {
    const res = await request(app)
      .get('/api/lab-results/not-a-valid-objectid')
      .set('Authorization', bearer(doctorToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
