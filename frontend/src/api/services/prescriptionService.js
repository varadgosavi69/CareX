// Prescription API calls (nested under an appointment).

import api from '../client';

// Doctor writes a prescription for an appointment.
export const create = async (appointmentId, { medicines, notes }) => {
  const { data } = await api.post(`/appointments/${appointmentId}/prescription`, { medicines, notes });
  return data.data.prescription;
};

// Owning patient / assigned doctor / admin reads it.
export const get = async (appointmentId) => {
  const { data } = await api.get(`/appointments/${appointmentId}/prescription`);
  return data.data.prescription;
};
