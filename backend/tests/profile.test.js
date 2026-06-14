// Profile tests: GET returns account + embedded patientProfile (no secrets),
// PUT deep-merges medical fields, and the strict validator rejects garbage.

import request from 'supertest';
import app from '../src/app.js';
import { registerPatient, bearer } from './helpers.js';

describe('Profile', () => {
  test('GET returns the account without password/refreshToken', async () => {
    const { token } = await registerPatient(app, { name: 'Pat One' });

    const res = await request(app).get('/api/profile').set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshToken).toBeUndefined();
  });

  test('PUT updates name + medical fields, GET reflects them', async () => {
    const { token } = await registerPatient(app);

    const put = await request(app)
      .put('/api/profile')
      .set('Authorization', bearer(token))
      .send({
        name: 'Updated Name',
        phone: '+91 9876543210',
        gender: 'male',
        bloodGroup: 'O+',
        height: 178,
        weight: 72,
        allergies: ['Penicillin', 'Peanuts'],
        chronicConditions: ['Asthma'],
        address: '12 MG Road',
        emergencyContact: { name: 'Kin', phone: '9998887776', relation: 'Brother' },
      });
    expect(put.status).toBe(200);

    const get = await request(app).get('/api/profile').set('Authorization', bearer(token));
    const { user } = get.body.data;
    expect(user.name).toBe('Updated Name');
    expect(user.patientProfile.bloodGroup).toBe('O+');
    expect(user.patientProfile.allergies).toEqual(['Penicillin', 'Peanuts']);
    expect(user.patientProfile.emergencyContact.name).toBe('Kin');
  });

  test('PUT deep-merges patientProfile (does not wipe unspecified fields)', async () => {
    const { token } = await registerPatient(app);

    await request(app)
      .put('/api/profile')
      .set('Authorization', bearer(token))
      .send({ bloodGroup: 'A+', emergencyContact: { name: 'Kin', phone: '1112223334', relation: 'Sister' } });

    // Update only the emergency phone; name/relation and bloodGroup must survive.
    await request(app)
      .put('/api/profile')
      .set('Authorization', bearer(token))
      .send({ emergencyContact: { phone: '9998887770' } });

    const get = await request(app).get('/api/profile').set('Authorization', bearer(token));
    const { patientProfile } = get.body.data.user;
    expect(patientProfile.bloodGroup).toBe('A+');
    expect(patientProfile.emergencyContact.phone).toBe('9998887770');
    expect(patientProfile.emergencyContact.name).toBe('Kin');
    expect(patientProfile.emergencyContact.relation).toBe('Sister');
  });

  test('rejects unknown fields and invalid enums (400)', async () => {
    const { token } = await registerPatient(app);

    const unknown = await request(app)
      .put('/api/profile')
      .set('Authorization', bearer(token))
      .send({ hacker: 'yes' });
    expect(unknown.status).toBe(400);

    const badBlood = await request(app)
      .put('/api/profile')
      .set('Authorization', bearer(token))
      .send({ bloodGroup: 'Z+' });
    expect(badBlood.status).toBe(400);

    const badRole = await request(app)
      .put('/api/profile')
      .set('Authorization', bearer(token))
      .send({ role: 'admin' });
    expect(badRole.status).toBe(400);
  });
});
