// Doctor geolocation tests: lat/lng convenience fields, the ?near radius
// filter, and a doctor setting their own location via PATCH /me.

import request from 'supertest';
import app from '../src/app.js';
import { createAdmin, registerDoctor, bearer } from './helpers.js';

const approve = (adminToken, id) =>
  request(app)
    .patch(`/api/doctors/${id}/status`)
    .set('Authorization', bearer(adminToken))
    .send({ status: 'approved' });

describe('Doctor geo', () => {
  test('approved doctors expose lat/lng and are filterable by ?near', async () => {
    const { token: adminToken } = await createAdmin(app);

    // One doctor in Nagpur, one far away in Mumbai (~700 km).
    const nagpur = await registerDoctor(app, {
      specialty: 'Cardiology', location: { lat: 21.1458, lng: 79.0882, address: 'Nagpur' },
    });
    await approve(adminToken, nagpur.doctor._id);

    const mumbai = await registerDoctor(app, {
      specialty: 'Cardiology', location: { lat: 19.0760, lng: 72.8777, address: 'Mumbai' },
    });
    await approve(adminToken, mumbai.doctor._id);

    // No geo filter: both listed, each with numeric lat/lng convenience fields.
    const all = await request(app).get('/api/doctors');
    expect(all.body.data.doctors).toHaveLength(2);
    expect(typeof all.body.data.doctors[0].lat).toBe('number');
    expect(typeof all.body.data.doctors[0].lng).toBe('number');

    // Within 5 km of Nagpur centre: only the Nagpur doctor.
    const near = await request(app).get('/api/doctors?near=21.1458,79.0882&radius=5');
    expect(near.status).toBe(200);
    expect(near.body.data.doctors).toHaveLength(1);
    expect(near.body.data.doctors[0].location.address).toBe('Nagpur');
  });

  test('a doctor sets their own location via PATCH /me; bad coords rejected', async () => {
    const { token: adminToken } = await createAdmin(app);
    const { doctor, creds } = await registerDoctor(app, { specialty: 'ENT' });
    await approve(adminToken, doctor._id);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    const token = login.body.data.accessToken;

    const ok = await request(app)
      .patch('/api/doctors/me')
      .set('Authorization', bearer(token))
      .send({ location: { lat: 21.15, lng: 79.09, address: 'My Clinic' } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.doctor.lat).toBeCloseTo(21.15);
    expect(ok.body.data.doctor.lng).toBeCloseTo(79.09);

    const bad = await request(app)
      .patch('/api/doctors/me')
      .set('Authorization', bearer(token))
      .send({ location: { lat: 200, lng: 79 } });
    expect(bad.status).toBe(400);
  });
});
