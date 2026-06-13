// Centralized environment configuration.
// Loads `.env`, validates required variables, and exposes a typed `env` object.
// Importing this module is the single source of truth for configuration — never
// read `process.env` directly elsewhere.

import dotenv from 'dotenv';

dotenv.config();

/**
 * Read a required env var or throw a clear startup error.
 * Failing fast here prevents the app from booting in a half-configured state.
 */
const required = (key) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Copy .env.example to .env and fill it in.`
    );
  }
  return value;
};

/** Read an optional env var with a fallback default. */
const optional = (key, fallback) => {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
};

const NODE_ENV = optional('NODE_ENV', 'development');

export const env = {
  nodeEnv: NODE_ENV,
  isProd: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  isDev: NODE_ENV === 'development',

  port: Number(optional('PORT', 5000)),

  // In the test environment the DB URI is supplied by mongodb-memory-server,
  // so it is not required up front.
  mongoUri: NODE_ENV === 'test' ? optional('MONGO_URI', '') : required('MONGO_URI'),

  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),

  jwt: {
    accessSecret: NODE_ENV === 'test'
      ? optional('JWT_ACCESS_SECRET', 'test_access_secret')
      : required('JWT_ACCESS_SECRET'),
    refreshSecret: NODE_ENV === 'test'
      ? optional('JWT_REFRESH_SECRET', 'test_refresh_secret')
      : required('JWT_REFRESH_SECRET'),
    accessExpiry: optional('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: optional('JWT_REFRESH_EXPIRY', '7d'),
  },
};

export default env;
