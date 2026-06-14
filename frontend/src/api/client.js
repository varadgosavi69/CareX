// Central axios client for the CareX REST API.
//
// - Base URL comes from VITE_API_URL (falls back to local dev).
// - The access token lives in memory only (never localStorage) and is attached
//   to every request; the long-lived refresh token is an httpOnly cookie the
//   browser sends automatically (withCredentials).
// - On a 401, we transparently try the refresh endpoint ONCE and replay the
//   original request, so a silently-expired access token doesn't log the user out.

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// In-memory access token (module-scoped).
let accessToken = null;
export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;

export const api = axios.create({
  baseURL,
  withCredentials: true, // send/receive the refresh-token cookie
});

// Attach the bearer token to outgoing requests.
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Shared in-flight refresh so concurrent 401s only trigger one refresh call.
let refreshPromise = null;

const isAuthFlow = (url = '') =>
  url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/register');

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Try a one-time refresh on 401 (but never for the auth endpoints themselves).
    if (status === 401 && original && !original._retry && !isAuthFlow(original.url)) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || api.post('/auth/refresh');
        const { data } = await refreshPromise;
        refreshPromise = null;
        setAccessToken(data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        refreshPromise = null;
        setAccessToken(null);
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

// Pull a human-readable message out of an axios error (our API uses { message }).
export const apiErrorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || error?.message || fallback;

export default api;
