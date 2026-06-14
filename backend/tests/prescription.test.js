// Prescription tests: a doctor writes a prescription for their own approved
// appointment; the owning patient can read it, an unrelated patient cannot.

import request from 'supertest';
import app from '../src/app.js';
import {
  createAdmin,
  registerPatient,
  setupApprovedDoctor,
  bookAppointment,
  bearer,
} from './helpers.js';

// Book an appointment and move it to "approved" so it can be prescribed.
const bookApprovedAppointment = async () => {
  const { token: adminToken } = await createAdmin(app);
  const { token: patientToken } = await registerPatient(app);
  const { doctorId, doctorToken } = await setupApprovedDoctor(app, adminToken);
  const { appointment } = await bookAppointment(app, patientToken, doctorId);

  await request(app)
    .patch(`/api/appointments/${appointment._id}/status`)
    .set('Authorization', bearer(doctorToken))
    .send({ status: 'approved' });

  return { appointmentId: appointment._id, patientToken, doctorToken };
};

describe('Prescriptions', () => {
  test('doctor creates a prescription and the patient can read it', async () => {
    const { appointmentId, patientToken, doctorToken } = await bookApprovedAppointment();

    const create = await request(app)
      .post(`/api/appointments/${appointmentId}/prescription`)
      .set('Authorization', bearer(doctorToken))
      .send({ medicines: [{ name: 'Aspirin', dosage: '75mg', frequency: 'daily' }], notes: 'Rest' });
    expect(create.status).toBe(201);

    const read = await request(app)
      .get(`/api/appointments/${appointmentId}/prescription`)
      .set('Authorization', bearer(patientToken));
    expect(read.status).toBe(200);
    expect(read.body.data.prescription.medicines[0].name).toBe('Aspirin');
  });

  test('a doctor cannot prescribe for an appointment that is not theirs', async () => {
    const { appointmentId } = await bookApprovedAppointment();
    // A second, unrelated approved doctor.
    const { token: adminToken } = await createAdmin(app);
    const { doctorToken: otherDoctor } = await setupApprovedDoctor(app, adminToken);

    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/prescription`)
      .set('Authorization', bearer(otherDoctor))
      .send({ medicines: [{ name: 'Ibuprofen' }] });
    expect(res.status).toBe(403);
  });

  test('an unrelated patient cannot read the prescription', async () => {
    const { appointmentId, doctorToken } = await bookApprovedAppointment();
    await request(app)
      .post(`/api/appointments/${appointmentId}/prescription`)
      .set('Authorization', bearer(doctorToken))
      .send({ medicines: [{ name: 'Aspirin' }] });

    const { token: stranger } = await registerPatient(app);
    const res = await request(app)
      .get(`/api/appointments/${appointmentId}/prescription`)
      .set('Authorization', bearer(stranger));
    expect(res.status).toBe(403);
  });
});
