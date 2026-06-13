// JWT helpers — sign/verify access and refresh tokens. Secrets and lifetimes
// come from the validated env config. Tokens carry { sub: userId, role }.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiry });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiry });

export const verifyAccessToken = (token) =>
  jwt.verify(token, env.jwt.accessSecret);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, env.jwt.refreshSecret);

/**
 * Convert a short duration string ("15m", "7d", "1h", "30s") to milliseconds.
 * Used to align the refresh cookie's maxAge with the refresh token lifetime.
 */
export const durationToMs = (value) => {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(String(value).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // sensible default: 7 days
  const amount = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return amount * unit;
};
