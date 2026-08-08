// Timeline route — single GET endpoint that returns the unified, chronologically
// sorted patient timeline (appointments, prescriptions, reports, vitals, lab results).
// Restricted to doctor and admin; patient self-access added in Phase 7.

import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { ROLES } from '../utils/constants.js';
import { z } from 'zod';
import mongoose from 'mongoose';
import { getTimeline } from '../controllers/timeline.controller.js';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid ObjectId');

// Validate the :patientId path param
const timelineParamsSchema = z.object({
  params: z.object({ patientId: objectId }),
});

const router = Router();

/**
 * GET /api/timeline/:patientId
 * Unified patient timeline, newest event first.
 * Auth: doctor | admin
 */
router.get(
  '/:patientId',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(timelineParamsSchema),
  getTimeline
);

export default router;
