// Risk route — GET /api/risk/:patientId
// Returns the rule-based risk assessment for a patient.
// Restricted to doctor and admin; patient self-access added in Phase 7.

import { Router }              from 'express';
import { z }                   from 'zod';
import mongoose                from 'mongoose';
import { protect, authorize }  from '../middlewares/auth.middleware.js';
import { validate }            from '../middlewares/validate.js';
import { ROLES }               from '../utils/constants.js';
import { getPatientRisk }      from '../controllers/risk.controller.js';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid ObjectId');

const riskParamsSchema = z.object({
  params: z.object({ patientId: objectId }),
});

const router = Router();

/**
 * GET /api/risk/:patientId
 * Auth: doctor | admin
 */
router.get(
  '/:patientId',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(riskParamsSchema),
  getPatientRisk
);

export default router;
