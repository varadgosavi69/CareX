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
import Prescription from '../models/Prescription.js';

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

/**
 * Normalise a Prescription document into a timeline event.
 * `date` is createdAt — when the prescription was written.
 * `summary` lists the first medicine name (plus count if there are more).
 */
const normalizePrescription = (rx) => {
  const [first, ...rest] = rx.medicines ?? [];
  const medicineSummary = first
    ? rest.length > 0
      ? `${first.name} +${rest.length} more`
      : first.name
    : 'No medicines listed';

  return {
    type: 'Prescription',
    date: rx.createdAt,
    summary: `Prescription – ${medicineSummary}`,
    refId: rx._id,
    meta: {
      medicines: rx.medicines ?? [],
      notes: rx.notes ?? null,
      appointmentId: rx.appointment ?? null,
      doctor: rx.doctor ?? null,
    },
  };
};

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

/**
 * Fetch and normalise all prescriptions for `patientId`.
 * Prescriptions are linked to a patient directly; doctor is populated for display.
 */
const fetchPrescriptions = async (patientId) => {
  const docs = await Prescription.find({ patient: patientId })
    .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } })
    .sort({ createdAt: -1 })
    .lean();

  return docs.map(normalizePrescription);
};

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * GET /api/timeline/:patientId
 * Returns the unified patient timeline (appointments only in this step).
 * Auth: doctor | admin
 */
export const getTimeline = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const appointments  = await fetchAppointments(patientId);
  const prescriptions = await fetchPrescriptions(patientId);

  // Steps 3-5 will add more sources here; Step 6 merges and sorts everything.
  const timeline = [...appointments, ...prescriptions];

  sendSuccess(res, {
    message: 'Patient timeline fetched.',
    data: { count: timeline.length, timeline },
  });
});
