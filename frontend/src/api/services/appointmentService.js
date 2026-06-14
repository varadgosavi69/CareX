// Appointment API calls.

import api from '../client';

// Book an appointment (patient). body: { doctorId, scheduledAt, slot, reason, location }
export const book = async (payload) => {
  const { data } = await api.post('/appointments', payload);
  return data.data.appointment;
};

// Role-aware list (patient/doctor/admin) with optional status filter + pagination.
export const list = async ({ status, page = 1, limit = 50 } = {}) => {
  const { data } = await api.get('/appointments', { params: { status, page, limit } });
  return data.data; // { appointments, pagination }
};

export const getById = async (id) => {
  const { data } = await api.get(`/appointments/${id}`);
  return data.data.appointment;
};

// Patient cancels their own appointment.
export const cancel = async (id) => {
  const { data } = await api.patch(`/appointments/${id}/cancel`);
  return data.data.appointment;
};

// Doctor/admin changes status: approved | rejected | completed.
export const updateStatus = async (id, status) => {
  const { data } = await api.patch(`/appointments/${id}/status`, { status });
  return data.data.appointment;
};
