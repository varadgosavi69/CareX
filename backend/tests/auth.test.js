// Auth integration tests: registration, login, /me, refresh, logout, and RBAC.

import request from 'supertest';
import app from '../src/app.js';
import { registerPatient, createAdmin, bearer } from './helpers.js';

describe('Auth', () => {
  test('registers a patient and never returns the password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'New Patient',
      email: 'new@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('new@test.com');
    expect(res.body.data.user.role).toBe('patient');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshToken).toBeUndefined();
    // Refresh token is set as an httpOnly cookie, not in the body.
    expect(res.headers['set-cookie'].join(';')).toMatch(/refreshToken/);
  });

  test('rejects duplicate email registration with 409', async () => {
    await registerPatient(app, { email: 'dupe@test.com' });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dupe', email: 'dupe@test.com', password: 'password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  test('rejects invalid registration input with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'x', email: 'not-an-email', password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  test('logs in with correct credentials and rejects wrong ones', async () => {
    await registerPatient(app, { email: 'login@test.com', password: 'password123' });

    const ok = await request(app).post('/api/auth/login').send({
      email: 'login@test.com', password: 'password123',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeDefined();

    const bad = await request(app).post('/api/auth/login').send({
      email: 'login@test.com', password: 'wrongpass',
    });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('UNAUTHORIZED');
  });

  test('GET /me returns the current user with a valid token, 401 without', async () => {
    const { token } = await registerPatient(app);

    const me = await request(app).get('/api/auth/me').set('Authorization', bearer(token));
    expect(me.status).toBe(200);
    expect(me.body.data.user.password).toBeUndefined();

    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);
  });

  test('refreshes the access token using the refresh cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      name: 'Refresh User', email: 'refresh@test.com', password: 'password123',
    });

    const refreshed = await agent.post('/api/auth/refresh').send();
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeDefined();
  });

  test('logout invalidates further refreshes', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/api/auth/register').send({
      name: 'Logout User', email: 'logout@test.com', password: 'password123',
    });
    const token = reg.body.data.accessToken;

    await agent.post('/api/auth/logout').set('Authorization', bearer(token)).send();

    const refreshed = await agent.post('/api/auth/refresh').send();
    expect(refreshed.status).toBe(401);
  });

  test('RBAC: a patient token is rejected on an admin-only route (403)', async () => {
    const { token: patientToken } = await registerPatient(app);
    const { token: adminToken } = await createAdmin(app);

    // A real doctor id to target (created + left pending).
    const reg = await request(app).post('/api/doctors/register').send({
      name: 'Dr Gate', email: 'drgate@test.com', password: 'password123',
      specialty: 'Cardiology',
    });
    const doctorId = reg.body.data.doctor._id;

    const patientAttempt = await request(app)
      .patch(`/api/doctors/${doctorId}/status`)
      .set('Authorization', bearer(patientToken))
      .send({ status: 'approved' });
    expect(patientAttempt.status).toBe(403);
    expect(patientAttempt.body.code).toBe('FORBIDDEN');

    // Sanity: admin is allowed.
    const adminAttempt = await request(app)
      .patch(`/api/doctors/${doctorId}/status`)
      .set('Authorization', bearer(adminToken))
      .send({ status: 'approved' });
    expect(adminAttempt.status).toBe(200);
  });
});
