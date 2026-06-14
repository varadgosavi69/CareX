// Shared helpers for integration tests: spin up users/doctors/appointments
// through the real API so tests exercise the full stack.

import request from 'supertest';
import User from '../src/models/User.js';
import { ROLES } from '../src/utils/constants.js';

let counter = 0;
// Unique-enough identifier so multiple accounts in one test don't collide.
export const uid = () => `${Date.now()}_${(counter += 1)}`;

export const bearer = (token) => `Bearer ${token}`;

// Availability covering every weekday so any future date/slot is bookable.
const WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];
export const allDayAvailability = WEEKDAYS.map((day) => ({
  day,
  startTime: '00:00',
  endTime: '23:00',
}));

// A future ISO datetime (default ~7 days out) for booking.
export const futureDate = (daysAhead = 7) =>
  new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

/** Register a patient and return their access token + profile. */
export const registerPatient = async (app, overrides = {}) => {
  const creds = {
    name: 'Pat Patient',
    email: `patient_${uid()}@test.com`,
    password: 'password123',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(creds);
  return { token: res.body.data.accessToken, user: res.body.data.user, creds };
};

/** Create an admin directly (no public signup) and log in for a token. */
export const createAdmin = async (app, overrides = {}) => {
  const creds = {
    email: `admin_${uid()}@test.com`,
    password: 'password123',
    ...overrides,
  };
  await User.create({
    name: 'Ada Admin',
    email: creds.email,
    password: creds.password,
    role: ROLES.ADMIN,
  });
  const res = await request(app).post('/api/auth/login').send(creds);
  return { token: res.body.data.accessToken, creds };
};

/** Register a doctor (pending) via the public endpoint. */
export const registerDoctor = async (app, overrides = {}) => {
  const creds = {
    name: 'Doc Doctor',
    email: `doctor_${uid()}@test.com`,
    password: 'password123',
    specialty: 'Cardiology',
    consultationFee: 500,
    availability: allDayAvailability,
    ...overrides,
  };
  const res = await request(app).post('/api/doctors/register').send(creds);
  return { doctor: res.body.data.doctor, creds, res };
};

/**
 * Register a doctor, approve them as admin, and log the doctor in.
 * Returns everything later tests need (ids, tokens, fee).
 */
export const setupApprovedDoctor = async (app, adminToken, overrides = {}) => {
  const { doctor, creds } = await registerDoctor(app, overrides);

  await request(app)
    .patch(`/api/doctors/${doctor._id}/status`)
    .set('Authorization', bearer(adminToken))
    .send({ status: 'approved' });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: creds.email, password: creds.password });

  return {
    doctorId: doctor._id,
    doctorUserId: doctor.user._id || doctor.user,
    doctorToken: login.body.data.accessToken,
    fee: doctor.consultationFee,
    creds,
  };
};

/** Book an appointment as a patient. Returns the created appointment. */
export const bookAppointment = async (app, patientToken, doctorId, overrides = {}) => {
  const body = {
    doctorId,
    scheduledAt: futureDate(),
    slot: '10:00-10:30',
    reason: 'Checkup',
    ...overrides,
  };
  const res = await request(app)
    .post('/api/appointments')
    .set('Authorization', bearer(patientToken))
    .send(body);
  return { appointment: res.body.data?.appointment, res, body };
};
