// Auth controllers — thin HTTP layer over auth.service. Handles the refresh
// token cookie (httpOnly) and returns the access token in the JSON body.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { env } from '../config/env.js';
import { durationToMs } from '../utils/jwt.js';
import * as authService from '../services/auth.service.js';

const REFRESH_COOKIE = 'refreshToken';

// Cookie options for the refresh token. In production it must be Secure +
// SameSite=None so it works cross-site (frontend and API on different domains).
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  path: '/api/auth', // only sent to refresh/logout endpoints
  maxAge: durationToMs(env.jwt.refreshExpiry),
});

const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());

const clearRefreshCookie = (res) =>
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });

// POST /api/auth/register — patient signup
export const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.registerPatient(req.body);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Registration successful',
    data: { user, accessToken },
  });
});

// POST /api/auth/login — any role
export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, {
    message: 'Login successful',
    data: { user, accessToken },
  });
});

// POST /api/auth/refresh — new access token from the refresh cookie
export const refresh = asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  const { accessToken, refreshToken } = await authService.rotateRefreshToken(presented);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, {
    message: 'Token refreshed',
    data: { accessToken },
  });
});

// POST /api/auth/logout — clear refresh token (protected)
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user?._id);
  clearRefreshCookie(res);
  sendSuccess(res, { message: 'Logged out successfully' });
});

// GET /api/auth/me — current user (protected)
export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Current user', data: { user: req.user } });
});
