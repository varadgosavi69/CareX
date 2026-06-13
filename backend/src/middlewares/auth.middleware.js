// Authentication + authorization middleware.
// - protect: verifies the Bearer access token and attaches req.user.
// - authorize(...roles): role-based guard, used after protect.

import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * Require a valid access token. Reads `Authorization: Bearer <token>`,
 * verifies it, loads the user, and attaches it as req.user.
 */
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) throw ApiError.unauthorized('Authentication required');

  // jwt errors (invalid/expired) are normalized to 401 by the error handler.
  const decoded = verifyAccessToken(token);

  const user = await User.findById(decoded.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');

  req.user = user;
  next();
});

/**
 * Restrict a route to one or more roles. Must run after `protect`.
 * e.g. authorize('doctor', 'admin')
 */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required'));
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('You do not have permission to perform this action'));
  }
  return next();
};
