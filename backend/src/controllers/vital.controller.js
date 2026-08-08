// Vital controllers — thin HTTP layer, delegates nothing to a service layer
// (vitals have no complex business logic in Phase 1; a service layer will be
// added in Phase 5 when trend detection is introduced).

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import Vital from '../models/Vital.js';

/**
 * POST /api/vitals
 * Record a new vital for a patient.
 * Auth: doctor | admin
 */
export const addVital = asyncHandler(async (req, res) => {
  const { patientId, type, value, unit, recordedAt, notes } = req.body;

  const vital = await Vital.create({
    patientId,
    type,
    value,
    unit,
    recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    recordedBy: req.user._id, // sourced from JWT — never from the request body
    notes,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Vital recorded successfully.',
    data: { vital },
  });
});

/**
 * GET /api/vitals/:patientId
 * Fetch all vitals for a patient, sorted oldest → newest.
 * Query params: type, from, to, limit (all optional)
 * Auth: doctor | admin
 */
export const getVitalsByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { type, from, to, limit } = req.query ?? {};

  const filter = { patientId };

  if (type) filter.type = type;

  if (from || to) {
    filter.recordedAt = {};
    if (from) filter.recordedAt.$gte = new Date(from);
    if (to)   filter.recordedAt.$lte = new Date(to);
  }

  const cap = Math.min(parseInt(limit, 10) || 100, 500);

  const vitals = await Vital.find(filter)
    .sort({ recordedAt: 1 }) // oldest → newest (chronological timeline)
    .limit(cap)
    .populate('patientId', 'name email role')
    .populate('recordedBy', 'name email role');

  sendSuccess(res, {
    message: 'Vitals fetched successfully.',
    data: { count: vitals.length, vitals },
  });
});
