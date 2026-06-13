// Winston logger. Pretty, colorized output in development; structured JSON in
// production. File transports capture errors and a combined log under /logs.

import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Human-friendly single-line format for local development.
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => {
    return `${ts} [${level}] ${stack || message}`;
  })
);

// Machine-readable format for production log aggregation.
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: env.isDev ? 'debug' : 'info',
  format: env.isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  // Don't crash the process on a logging error.
  exitOnError: false,
});

// Persist logs to disk outside of tests to keep test output clean.
if (!env.isTest) {
  logger.add(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  );
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}

// Silence noisy output during automated tests.
if (env.isTest) {
  logger.silent = true;
}

// A stream adapter so morgan can pipe HTTP logs through winston.
export const morganStream = {
  write: (message) => logger.http?.(message.trim()) ?? logger.info(message.trim()),
};

export default logger;
