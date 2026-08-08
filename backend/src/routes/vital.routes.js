// Vital routes.
// All endpoints require a valid JWT. Writes are restricted to doctor/admin;
// reads are also doctor/admin only in Phase 1 — patient self-access will be
// added in Phase 7 behind a consent gate.

import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { ROLES } from '../utils/constants.js';
import { addVitalSchema, getVitalsSchema } from '../validators/vital.validator.js';
import { addVital, getVitalsByPatient } from '../controllers/vital.controller.js';

const router = Router();

/**
 * POST /api/vitals
 * Record a new vital for a patient.
 * Restricted to: doctor, admin
 */
router.post(
  '/',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(addVitalSchema),
  addVital
);

/**
 * GET /api/vitals/:patientId
 * Retrieve all vitals for a patient, sorted oldest → newest.
 * Restricted to: doctor, admin
 */
router.get(
  '/:patientId',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(getVitalsSchema),
  getVitalsByPatient
);

export default router;
