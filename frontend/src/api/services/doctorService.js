// Doctor directory API calls.

import api from '../client';

// Public: list approved doctors with optional filters + pagination.
export const list = async ({ specialty, search, page = 1, limit = 50 } = {}) => {
  const { data } = await api.get('/doctors', { params: { specialty, search, page, limit } });
  return data.data; // { doctors, pagination }
};

// Public: a single approved doctor.
export const getById = async (id) => {
  const { data } = await api.get(`/doctors/${id}`);
  return data.data.doctor;
};

// Public: a doctor's ratings list.
export const getRatings = async (id, { page = 1, limit = 20 } = {}) => {
  const { data } = await api.get(`/doctors/${id}/ratings`, { params: { page, limit } });
  return data.data; // { ratings/items, avgRating, ratingCount, pagination }
};

// Public: register as a doctor (creates a pending account).
export const register = async (payload) => {
  const { data } = await api.post('/doctors/register', payload);
  return data.data.doctor;
};

// Doctor: own profile.
export const getMe = async () => {
  const { data } = await api.get('/doctors/me');
  return data.data.doctor;
};

// Doctor: update own availability/fee/qualifications/experience.
export const updateMe = async (payload) => {
  const { data } = await api.patch('/doctors/me', payload);
  return data.data.doctor;
};

// Admin: approve/reject a doctor.
export const updateStatus = async (id, status) => {
  const { data } = await api.patch(`/doctors/${id}/status`, { status });
  return data.data.doctor;
};
