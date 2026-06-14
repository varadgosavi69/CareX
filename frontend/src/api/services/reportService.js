// Medical report API calls (Cloudinary-backed uploads).

import api from '../client';

// Upload a report file (multipart). Optionally tie it to an appointment.
export const upload = async (file, { appointmentId } = {}) => {
  const form = new FormData();
  form.append('file', file);
  if (appointmentId) form.append('appointmentId', appointmentId);
  const { data } = await api.post('/reports', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.report;
};

// List the current patient's own reports.
export const list = async () => {
  const { data } = await api.get('/reports');
  return data.data.reports;
};

// Delete one of the patient's own reports.
export const remove = async (id) => {
  const { data } = await api.delete(`/reports/${id}`);
  return data;
};
