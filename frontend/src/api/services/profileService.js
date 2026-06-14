// Profile API calls (the current user's own account).

import api from '../client';

export const get = async () => {
  const { data } = await api.get('/profile');
  return data.data; // { user, doctorProfile }
};

export const update = async (payload) => {
  const { data } = await api.put('/profile', payload);
  return data.data.user;
};
