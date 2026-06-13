// Mongoose connection helper with bounded retries and clear logging.
// Booting fails loudly if the database can't be reached after all retries.

import mongoose from 'mongoose';
import { env } from './env.js';
import logger from '../utils/logger.js';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect to MongoDB, retrying a few times on initial failure.
 * @param {string} [uri] Optional override (used by the test harness).
 */
export const connectDB = async (uri = env.mongoUri) => {
  if (!uri) {
    throw new Error('connectDB: no MongoDB URI provided.');
  }

  // Surface unexpected runtime disconnects.
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected.');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected.');
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
      });
      logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err) {
      logger.error(
        `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`
      );
      if (attempt === MAX_RETRIES) {
        throw err;
      }
      await wait(RETRY_DELAY_MS);
    }
  }

  // Unreachable, but satisfies control-flow analysis.
  return undefined;
};

/** Gracefully close the Mongoose connection (used on shutdown). */
export const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed.');
};

export default connectDB;
