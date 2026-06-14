// Rating API calls.

import api from '../client';

// Patient rates a completed appointment (one per appointment).
export const create = async ({ appointmentId, stars, review }) => {
  const { data } = await api.post('/ratings', { appointmentId, stars, review });
  return data.data.rating;
};

// Public: a doctor's ratings (also lives under doctorService.getRatings).
export const listForDoctor = async (doctorId, { page = 1, limit = 20 } = {}) => {
  const { data } = await api.get(`/doctors/${doctorId}/ratings`, { params: { page, limit } });
  return data.data;
};
