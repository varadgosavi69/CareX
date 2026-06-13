// Auth routes. A tighter rate limiter guards the credential endpoints to slow
// brute-force attempts (further hardened in Phase 7).

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';
import { env } from '../config/env.js';

const router = Router();

// Stricter limit on auth endpoints than the global API limiter.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isTest ? 1000 : 20, // relaxed during tests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts, please try again later.',
    data: null,
  },
});

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.me);

export default router;
