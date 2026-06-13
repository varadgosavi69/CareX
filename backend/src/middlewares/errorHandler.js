// Global error handler — the single place where every error becomes an HTTP
// response. Must be registered LAST, after all routes and the notFound handler.
// Keeps the standard { success, message, data } shape and hides internals in prod.

import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { env } from '../config/env.js';

// Translate common non-ApiError failures into clean, client-safe ApiErrors.
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Mongoose: invalid ObjectId / cast failure.
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // Mongoose: schema validation failed.
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.badRequest('Validation failed', errors);
  }

  // MongoDB: duplicate key (unique index violation).
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`Duplicate value for '${field}'`);
  }

  // JWT errors.
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Token expired');
  }

  // Multer upload errors (e.g. file too large, unexpected field).
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large (max 5 MB)'
        : `Upload error: ${err.message}`;
    return ApiError.badRequest(message);
  }

  // Fallback: treat as an unexpected 500.
  return new ApiError(err.statusCode || 500, err.message || 'Internal server error');
};

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
const errorHandler = (err, req, res, _next) => {
  const apiError = normalizeError(err);

  // Log full details server-side; never send stack traces to clients in prod.
  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${apiError.statusCode}: ${err.stack || err.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${apiError.statusCode}: ${apiError.message}`);
  }

  const body = {
    success: false,
    message: apiError.message,
    data: null,
  };

  if (apiError.errors && apiError.errors.length > 0) {
    body.errors = apiError.errors;
  }

  // Expose the stack only in non-production environments for debugging.
  if (!env.isProd && err.stack) {
    body.stack = err.stack;
  }

  res.status(apiError.statusCode).json(body);
};

export default errorHandler;
