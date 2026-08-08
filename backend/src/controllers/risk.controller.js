// Risk controller — thin HTTP layer over riskEngine.computeRisk.
// Follows the same asyncHandler + sendSuccess pattern used by vital.controller.js.

import asyncHandler      from '../utils/asyncHandler.js';
import { sendSuccess }   from '../utils/ApiResponse.js';
import { computeRisk }   from '../services/riskEngine.js';

/**
 * GET /api/risk/:patientId
 * Computes and returns the rule-based risk assessment for a patient.
 * Auth: doctor | admin
 */
export const getPatientRisk = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const assessment = await computeRisk(patientId);

  sendSuccess(res, {
    message: 'Patient risk assessment computed.',
    data: { assessment },
  });
});
