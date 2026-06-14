// Auth routes. A tighter rate limiter (authLimiter) guards the credential
// endpoints to slow brute-force attempts.

import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.me);

export default router;
