// Appointment tests: server-validated booking, double-booking 409, patient
// cancel, and doctor approve/complete lifecycle.

import request from 'supertest';
import app from '../src/app.js';
import {
  createAdmin,
  registerPatient,
  registerDoctor,
  setupApprovedDoctor,
  bookAppointment,
  bearer,
  futureDate,
} from './helpers.js';

describe('Appointments', () => {
  test('a patient books an appointment with fee snapshot', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { token: patientToken } = await registerPatient(app);
    const { doctorId, fee } = await setupApprovedDoctor(app, adminToken);

    const { res, appointment } = await bookAppointment(app, patientToken, doctorId);
    expect(res.status).toBe(201);
    expect(appointment.status).toBe('pending');
    expect(appointment.consultationFee).toBe(fee);
  });

  test('double-booking the same doctor + slot returns 409', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { token: patientToken } = await registerPatient(app);
    const { doctorId } = await setupApprovedDoctor(app, adminToken);

    const when = futureDate();
    const first = await bookAppointment(app, patientToken, doctorId, { scheduledAt: when });
    expect(first.res.status).toBe(201);

    const second = await bookAppointment(app, patientToken, doctorId, { scheduledAt: when });
    expect(second.res.status).toBe(409);
    expect(second.res.body.code).toBe('CONFLICT');
  });

  test('booking an unapproved doctor is rejected', async () => {
    const { token: patientToken } = await registerPatient(app);
    // Register but do NOT approve.
    const { doctor } = await registerDoctor(app);

    const { res } = await bookAppointment(app, patientToken, doctor._id);
    expect(res.status).toBe(404);
  });

  test('a patient cancels their own pending appointment', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { token: patientToken } = await registerPatient(app);
    const { doctorId } = await setupApprovedDoctor(app, adminToken);

    const { appointment } = await bookAppointment(app, patientToken, doctorId);

    const cancel = await request(app)
      .patch(`/api/appointments/${appointment._id}/cancel`)
      .set('Authorization', bearer(patientToken))
      .send();
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.appointment.status).toBe('cancelled');
  });

  test('the assigned doctor approves then completes an appointment', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { token: patientToken } = await registerPatient(app);
    const { doctorId, doctorToken } = await setupApprovedDoctor(app, adminToken);

    const { appointment } = await bookAppointment(app, patientToken, doctorId);

    const approve = await request(app)
      .patch(`/api/appointments/${appointment._id}/status`)
      .set('Authorization', bearer(doctorToken))
      .send({ status: 'approved' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.appointment.status).toBe('approved');

    const complete = await request(app)
      .patch(`/api/appointments/${appointment._id}/status`)
      .set('Authorization', bearer(doctorToken))
      .send({ status: 'completed' });
    expect(complete.status).toBe(200);
    expect(complete.body.data.appointment.status).toBe('completed');
  });

  test('a patient cannot access another patient\'s appointment', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { token: patientA } = await registerPatient(app);
    const { token: patientB } = await registerPatient(app);
    const { doctorId } = await setupApprovedDoctor(app, adminToken);

    const { appointment } = await bookAppointment(app, patientA, doctorId);

    const res = await request(app)
      .get(`/api/appointments/${appointment._id}`)
      .set('Authorization', bearer(patientB));
    expect(res.status).toBe(403);
  });
});
