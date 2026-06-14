// Report tests: a patient uploads a medical file (Cloudinary is mocked so no
// network/credentials are needed), lists their own reports, and deletes one.

import { jest } from '@jest/globals';
import request from 'supertest';
import { registerPatient, bearer } from './helpers.js';

// Mock the Cloudinary wrapper BEFORE importing the app, so report.service picks
// up the fake upload/delete instead of hitting the real Cloudinary SDK.
jest.unstable_mockModule('../src/services/upload.service.js', () => ({
  uploadToCloudinary: jest.fn(async () => ({
    secure_url: 'https://res.cloudinary.com/demo/report.pdf',
    public_id: 'carex/reports/abc123',
  })),
  deleteFromCloudinary: jest.fn(async () => ({ result: 'ok' })),
}));

const { default: app } = await import('../src/app.js');

const pdf = Buffer.from('%PDF-1.4 fake pdf bytes');

describe('Reports', () => {
  test('a patient uploads a report and gets the stored Cloudinary URL', async () => {
    const { token } = await registerPatient(app);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', bearer(token))
      .attach('file', pdf, { filename: 'report.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.data.report.fileUrl).toMatch(/cloudinary/);
    expect(res.body.data.report.publicId).toBe('carex/reports/abc123');
    expect(res.body.data.report.fileName).toBe('report.pdf');
  });

  test('upload without a file is rejected', async () => {
    const { token } = await registerPatient(app);
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(400);
  });

  test('a patient lists and deletes their own report', async () => {
    const { token } = await registerPatient(app);

    const upload = await request(app)
      .post('/api/reports')
      .set('Authorization', bearer(token))
      .attach('file', pdf, { filename: 'report.pdf', contentType: 'application/pdf' });
    const reportId = upload.body.data.report._id;

    const list = await request(app)
      .get('/api/reports')
      .set('Authorization', bearer(token));
    expect(list.status).toBe(200);
    expect(list.body.data.reports).toHaveLength(1);

    const del = await request(app)
      .delete(`/api/reports/${reportId}`)
      .set('Authorization', bearer(token));
    expect(del.status).toBe(200);

    const after = await request(app)
      .get('/api/reports')
      .set('Authorization', bearer(token));
    expect(after.body.data.reports).toHaveLength(0);
  });

  test('a patient cannot delete a report they do not own', async () => {
    const { token: owner } = await registerPatient(app);
    const { token: other } = await registerPatient(app);

    const upload = await request(app)
      .post('/api/reports')
      .set('Authorization', bearer(owner))
      .attach('file', pdf, { filename: 'report.pdf', contentType: 'application/pdf' });
    const reportId = upload.body.data.report._id;

    const del = await request(app)
      .delete(`/api/reports/${reportId}`)
      .set('Authorization', bearer(other));
    expect(del.status).toBe(403);
  });
});
