// Central API router. Every domain router is mounted here under /api.
// Later phases (auth, doctors, appointments, ...) add their routers below.

import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

export default router;
