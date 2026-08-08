// Timeline controller — builds a unified, chronologically-sorted view of every
// clinical event for a patient: appointments, prescriptions, uploaded reports,
// vitals, and lab results.
//
// Each source is normalised to the same envelope:
//   { type, date, summary, refId, meta }
//
// `meta` is a small, type-specific payload that the frontend can use to render
// a richer card without needing to call additional endpoints.
//
// The controller is built incrementally across Phase 2 commits. Each step adds
// one source; the final merge+sort step (Step 6) combines them all.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import Appointment from '../models/Appointment.js';

// ─── Normalizers ──────────────────────────────────────────────────────────────

/**
 * Normalise a Mongoose Appointment document into a timeline event.
 * `date` is scheduledAt — the moment the clinical encounter was planned.
 */
const normalizeAppointment = (appt) => ({
  type: 'Appointment',
  date: appt.scheduledAt,
  summary: `Appointment – ${appt.status}${appt.category ? ` (${appt.category})` : ''}`,
  refId: appt._id,
  meta: {
    status: appt.status,
    slot: appt.slot,
    category: appt.category ?? null,
    reason: appt.reason ?? null,
    consultationFee: appt.consultationFee,
    paymentStatus: appt.paymentStatus,
    doctor: appt.doctor ?? null,
  },
});

// ─── Fetchers (one per source, composed in Step 6) ───────────────────────────

/**
 * Fetch and normalise all appointments for `patientId`.
 * Returns an array of normalised timeline events sorted by date.
 */
const fetchAppointments = async (patientId) => {
  const docs = await Appointment.find({ patient: patientId })
    .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } })
    .sort({ scheduledAt: -1 })
    .lean();

  return docs.map(normalizeAppointment);
};

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * GET /api/timeline/:patientId
 * Returns the unified patient timeline (appointments only in this step).
 * Auth: doctor | admin
 */
export const getTimeline = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const appointments = await fetchAppointments(patientId);

  // Steps 2-5 will add more sources here; Step 6 merges and sorts everything.
  const timeline = [...appointments];

  sendSuccess(res, {
    message: 'Patient timeline fetched.',
    data: { count: timeline.length, timeline },
  });
});
