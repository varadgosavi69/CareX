// Lab result routes.
// All endpoints require a valid JWT. Writes are restricted to doctor/admin;
// reads are also doctor/admin only in Phase 1 — patient self-access will be
// added in Phase 7 behind a consent gate.

import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { ROLES } from '../utils/constants.js';
import {
  addLabResultSchema,
  getLabResultsSchema,
} from '../validators/labResult.validator.js';
import {
  addLabResult,
  getLabResultsByPatient,
} from '../controllers/labResult.controller.js';

const router = Router();

/**
 * POST /api/lab-results
 * Record a new lab result for a patient.
 * Restricted to: doctor, admin
 */
router.post(
  '/',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(addLabResultSchema),
  addLabResult
);

/**
 * GET /api/lab-results/:patientId
 * Retrieve all lab results for a patient, sorted oldest → newest.
 * Restricted to: doctor, admin
 */
router.get(
  '/:patientId',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(getLabResultsSchema),
  getLabResultsByPatient
);

export default router;
