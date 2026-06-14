// Rating tests: a patient may rate only a completed appointment (once), and the
// doctor's aggregate avgRating/ratingCount recompute automatically.

import request from 'supertest';
import app from '../src/app.js';
import {
  createAdmin,
  registerPatient,
  setupApprovedDoctor,
  bookAppointment,
  bearer,
} from './helpers.js';

// Book and drive an appointment all the way to "completed".
const completedAppointment = async () => {
  const { token: adminToken } = await createAdmin(app);
  const { token: patientToken } = await registerPatient(app);
  const { doctorId, doctorToken } = await setupApprovedDoctor(app, adminToken);
  const { appointment } = await bookAppointment(app, patientToken, doctorId);

  await request(app)
    .patch(`/api/appointments/${appointment._id}/status`)
    .set('Authorization', bearer(doctorToken))
    .send({ status: 'approved' });
  await request(app)
    .patch(`/api/appointments/${appointment._id}/status`)
    .set('Authorization', bearer(doctorToken))
    .send({ status: 'completed' });

  return { appointmentId: appointment._id, doctorId, patientToken };
};

describe('Ratings', () => {
  test('rating a completed appointment recomputes the doctor avgRating', async () => {
    const { appointmentId, doctorId, patientToken } = await completedAppointment();

    const rate = await request(app)
      .post('/api/ratings')
      .set('Authorization', bearer(patientToken))
      .send({ appointmentId, stars: 5, review: 'Excellent' });
    expect(rate.status).toBe(201);

    const doctor = await request(app).get(`/api/doctors/${doctorId}`);
    expect(doctor.body.data.doctor.avgRating).toBe(5);
    expect(doctor.body.data.doctor.ratingCount).toBe(1);
  });

  test('rating the same appointment twice returns 409', async () => {
    const { appointmentId, patientToken } = await completedAppointment();

    await request(app)
      .post('/api/ratings')
      .set('Authorization', bearer(patientToken))
      .send({ appointmentId, stars: 4 });

    const second = await request(app)
      .post('/api/ratings')
      .set('Authorization', bearer(patientToken))
      .send({ appointmentId, stars: 3 });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('CONFLICT');
  });

  test('cannot rate an appointment that is not completed (400)', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { token: patientToken } = await registerPatient(app);
    const { doctorId } = await setupApprovedDoctor(app, adminToken);
    const { appointment } = await bookAppointment(app, patientToken, doctorId);

    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', bearer(patientToken))
      .send({ appointmentId: appointment._id, stars: 5 });
    expect(res.status).toBe(400);
  });
});
