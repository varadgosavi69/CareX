// Lab result controllers — thin HTTP layer over the LabResult model.
// A service layer will be added in Phase 5 when risk scoring is introduced.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import LabResult from '../models/LabResult.js';

/**
 * POST /api/lab-results
 * Record a new lab result for a patient.
 * Auth: doctor | admin
 */
export const addLabResult = asyncHandler(async (req, res) => {
  const { patientId, testName, value, unit, referenceRange, recordedAt, labName, notes } =
    req.body;

  const labResult = await LabResult.create({
    patientId,
    testName,
    value,
    unit,
    referenceRange,
    recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    recordedBy: req.user._id, // sourced from JWT — never from the request body
    labName,
    notes,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Lab result recorded successfully.',
    data: { labResult },
  });
});

/**
 * GET /api/lab-results/:patientId
 * Fetch all lab results for a patient, sorted oldest → newest.
 * Query params: testName (partial, case-insensitive), from, to, limit
 * Auth: doctor | admin
 */
export const getLabResultsByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { testName, from, to, limit } = req.query ?? {};

  const filter = { patientId };

  if (testName) {
    filter.testName = { $regex: testName, $options: 'i' };
  }

  if (from || to) {
    filter.recordedAt = {};
    if (from) filter.recordedAt.$gte = new Date(from);
    if (to)   filter.recordedAt.$lte = new Date(to);
  }

  const cap = Math.min(parseInt(limit, 10) || 100, 500);

  const labResults = await LabResult.find(filter)
    .sort({ recordedAt: 1 }) // oldest → newest (chronological timeline)
    .limit(cap)
    .populate('patientId', 'name email role')
    .populate('recordedBy', 'name email role');

  sendSuccess(res, {
    message: 'Lab results fetched successfully.',
    data: { count: labResults.length, labResults },
  });
});
