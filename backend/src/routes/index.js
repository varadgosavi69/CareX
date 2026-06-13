// Central API router. Every domain router is mounted here under /api.
// Later phases (auth, doctors, appointments, ...) add their routers below.

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import doctorRoutes from './doctor.routes.js';
import appointmentRoutes from './appointment.routes.js';
import ratingRoutes from './rating.routes.js';
import reportRoutes from './report.routes.js';
import profileRoutes from './profile.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/ratings', ratingRoutes);
router.use('/reports', reportRoutes);
router.use('/profile', profileRoutes);

export default router;
