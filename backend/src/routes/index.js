// Central API router. Every domain router is mounted here under /api.
// Later phases (auth, doctors, appointments, ...) add their routers below.

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

export default router;
