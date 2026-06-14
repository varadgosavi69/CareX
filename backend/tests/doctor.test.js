// Doctor directory tests: registration stays pending and hidden until an admin
// approves, then it appears in the public listing and is filterable.

import request from 'supertest';
import app from '../src/app.js';
import { createAdmin, registerDoctor, bearer } from './helpers.js';

describe('Doctors', () => {
  test('a newly registered doctor is pending and not listed publicly', async () => {
    await registerDoctor(app, { specialty: 'Dermatology' });

    const list = await request(app).get('/api/doctors');
    expect(list.status).toBe(200);
    expect(list.body.data.doctors).toHaveLength(0);
  });

  test('admin approval makes the doctor appear and filterable by specialty', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { doctor } = await registerDoctor(app, { specialty: 'Neurology' });

    const approve = await request(app)
      .patch(`/api/doctors/${doctor._id}/status`)
      .set('Authorization', bearer(adminToken))
      .send({ status: 'approved' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.doctor.status).toBe('approved');

    const all = await request(app).get('/api/doctors');
    expect(all.body.data.doctors).toHaveLength(1);

    const match = await request(app).get('/api/doctors?specialty=Neurology');
    expect(match.body.data.doctors).toHaveLength(1);

    const noMatch = await request(app).get('/api/doctors?specialty=Cardiology');
    expect(noMatch.body.data.doctors).toHaveLength(0);
  });

  test('rejected doctors are not listed', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { doctor } = await registerDoctor(app);

    await request(app)
      .patch(`/api/doctors/${doctor._id}/status`)
      .set('Authorization', bearer(adminToken))
      .send({ status: 'rejected' });

    const list = await request(app).get('/api/doctors');
    expect(list.body.data.doctors).toHaveLength(0);
  });

  test('public single-profile endpoint 404s for a non-approved doctor', async () => {
    const { doctor } = await registerDoctor(app);
    const res = await request(app).get(`/api/doctors/${doctor._id}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
