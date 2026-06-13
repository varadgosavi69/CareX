// Auth business logic: registration, login, refresh-token rotation, logout.
// Controllers stay thin and delegate here. The refresh token is persisted on
// the user (select:false) so it can be validated and revoked server-side.

import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../utils/constants.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

// Issue a fresh access/refresh token pair for a user.
const issueTokens = (user) => {
  const payload = { sub: user._id.toString(), role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

// Persist the current refresh token so it can be rotated/revoked later.
const persistRefreshToken = async (user, refreshToken) => {
  user.refreshToken = refreshToken;
  await user.save();
};

/**
 * Register a new patient. Doctors/admins are created through other flows.
 */
export const registerPatient = async ({ name, email, password, phone }) => {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('Email is already registered');

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: ROLES.PATIENT,
  });

  const tokens = issueTokens(user);
  await persistRefreshToken(user, tokens.refreshToken);

  return { user, ...tokens };
};

/**
 * Authenticate any role by email + password.
 * Returns the user (without password) plus a token pair.
 */
export const login = async ({ email, password }) => {
  // Need the password hash for comparison, so explicitly select it.
  const user = await User.findOne({ email }).select('+password');
  // Same generic message whether the email or password is wrong (no enumeration).
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

  const tokens = issueTokens(user);
  await persistRefreshToken(user, tokens.refreshToken);

  // Drop the hash before the object travels back up.
  user.password = undefined;
  return { user, ...tokens };
};

/**
 * Rotate a refresh token: verify the presented token, confirm it matches the
 * one stored for the user, then issue a brand-new pair (old one invalidated).
 */
export const rotateRefreshToken = async (presentedToken) => {
  if (!presentedToken) throw ApiError.unauthorized('Refresh token missing');

  let decoded;
  try {
    decoded = verifyRefreshToken(presentedToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.sub).select('+refreshToken');
  // Reject if the user is gone or the token doesn't match what's on file
  // (e.g. it was already rotated or the user logged out).
  if (!user || user.refreshToken !== presentedToken) {
    throw ApiError.unauthorized('Refresh token is no longer valid');
  }

  const tokens = issueTokens(user);
  await persistRefreshToken(user, tokens.refreshToken);

  return { user, ...tokens };
};

/**
 * Log out by clearing the stored refresh token, invalidating future refreshes.
 */
export const logout = async (userId) => {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
};
