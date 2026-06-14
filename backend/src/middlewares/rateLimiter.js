// Centralized rate limiters — the single source of truth for request throttling.
// `globalLimiter` is a baseline applied to the whole API; `authLimiter` is a
// tighter limit for credential endpoints to slow brute-force attempts.
// Limits are relaxed under NODE_ENV=test so the suite isn't throttled.

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Throttle responses reuse the standard error shape, including a stable code.
const limitMessage = (message) => ({
  success: false,
  message,
  code: 'TOO_MANY_REQUESTS',
  data: null,
});

export const globalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: env.isTest ? 100000 : 300, // requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('Too many requests, please try again later.'),
});

export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: env.isTest ? 1000 : 20, // much tighter for login/register/refresh
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('Too many attempts, please try again later.'),
});
