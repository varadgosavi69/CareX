// Notes analysis route — GET /api/notes-analysis/:patientId
// Extracts and returns keyword analysis from all clinical notes for a patient.
// Restricted to doctor and admin in Phase 1.

import { Router }             from 'express';
import { z }                  from 'zod';
import mongoose               from 'mongoose';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { validate }           from '../middlewares/validate.js';
import { ROLES }              from '../utils/constants.js';
import { analyzePatientNotes } from '../controllers/notesAnalysis.controller.js';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid ObjectId');

const notesAnalysisParamsSchema = z.object({
  params: z.object({ patientId: objectId }),
});

const router = Router();

/**
 * GET /api/notes-analysis/:patientId
 * Auth: doctor | admin
 */
router.get(
  '/:patientId',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(notesAnalysisParamsSchema),
  analyzePatientNotes
);

export default router;
