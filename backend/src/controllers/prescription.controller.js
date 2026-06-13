// Prescription controllers — thin HTTP layer over prescription.service.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as prescriptionService from '../services/prescription.service.js';

// POST /api/appointments/:id/prescription (doctor)
export const create = asyncHandler(async (req, res) => {
  const prescription = await prescriptionService.createPrescription(
    req.user,
    req.params.id,
    req.body
  );
  sendSuccess(res, {
    statusCode: 201,
    message: 'Prescription created',
    data: { prescription },
  });
});

// GET /api/appointments/:id/prescription (patient/doctor/admin)
export const get = asyncHandler(async (req, res) => {
  const prescription = await prescriptionService.getPrescription(req.user, req.params.id);
  sendSuccess(res, { message: 'Prescription fetched', data: { prescription } });
});
