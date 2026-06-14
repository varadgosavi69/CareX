// Auth API calls. On register/login/refresh we stash the returned access token
// in memory (via the client) so subsequent requests are authenticated.

import api, { setAccessToken } from '../client';

export const register = async ({ name, email, password, phone }) => {
  const { data } = await api.post('/auth/register', { name, email, password, phone });
  setAccessToken(data.data.accessToken);
  return data.data.user;
};

export const login = async ({ email, password }) => {
  const { data } = await api.post('/auth/login', { email, password });
  setAccessToken(data.data.accessToken);
  return data.data.user;
};

export const me = async () => {
  const { data } = await api.get('/auth/me');
  return data.data.user;
};

// Exchange the httpOnly refresh cookie for a fresh access token.
export const refresh = async () => {
  const { data } = await api.post('/auth/refresh');
  setAccessToken(data.data.accessToken);
  return data.data.accessToken;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
};
