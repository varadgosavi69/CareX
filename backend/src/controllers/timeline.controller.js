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
import Report from '../models/Report.js';
import Vital from '../models/Vital.js';
import LabResult from '../models/LabResult.js';

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

/**
 * Normalise a Report document into a timeline event.
 * `date` is uploadedAt (the createdAt alias set on the Report schema).
 */
const normalizeReport = (report) => ({
  type: 'Report',
  date: report.uploadedAt,
  summary: `Report uploaded – ${report.fileName ?? report.fileType ?? 'document'}`,
  refId: report._id,
  meta: {
    fileName: report.fileName ?? null,
    fileType: report.fileType ?? null,
    fileUrl: report.fileUrl,
    appointmentId: report.appointment ?? null,
  },
});

/**
 * Normalise a Vital document into a timeline event.
 * `date` is recordedAt — when the measurement was taken.
 * `summary` varies by type: BP gets "120/80 mmHg", others get "78 bpm".
 */
const normalizeVital = (vital) => {
  const { type, value, unit } = vital;
  const valueSummary =
    type === 'BloodPressure'
      ? `${value?.systolic ?? '?'}/${value?.diastolic ?? '?'} ${unit}`
      : `${value?.single ?? '?'} ${unit}`;

  return {
    type: 'Vital',
    date: vital.recordedAt,
    summary: `${type} – ${valueSummary}`,
    refId: vital._id,
    meta: {
      vitalType: type,
      value,
      unit,
      notes: vital.notes ?? null,
      recordedBy: vital.recordedBy ?? null,
    },
  };
};

/**
 * Normalise a LabResult document into a timeline event.
 * `date` is recordedAt — when the sample was taken / result was recorded.
 * `summary` shows testName + value + unit, with reference range if present.
 */
const normalizeLabResult = (lab) => {
  const rangePart = lab.referenceRange ? ` (ref: ${lab.referenceRange})` : '';
  return {
    type: 'LabResult',
    date: lab.recordedAt,
    summary: `${lab.testName} – ${lab.value} ${lab.unit}${rangePart}`,
    refId: lab._id,
    meta: {
      testName: lab.testName,
      value: lab.value,
      unit: lab.unit,
      referenceRange: lab.referenceRange ?? null,
      labName: lab.labName ?? null,
      notes: lab.notes ?? null,
      recordedBy: lab.recordedBy ?? null,
    },
  };
};

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

/**
 * Fetch and normalise all uploaded reports for `patientId`.
 * Sorted by uploadedAt descending (newest first before the final merge sort).
 */
const fetchReports = async (patientId) => {
  const docs = await Report.find({ patient: patientId })
    .sort({ uploadedAt: -1 })
    .lean();

  return docs.map(normalizeReport);
};

/**
 * Fetch and normalise all vitals for `patientId`.
 * recordedBy is populated so the timeline card can show who recorded it.
 */
const fetchVitals = async (patientId) => {
  const docs = await Vital.find({ patientId })
    .populate('recordedBy', 'name email role')
    .sort({ recordedAt: -1 })
    .lean();

  return docs.map(normalizeVital);
};

/**
 * Fetch and normalise all lab results for `patientId`.
 * recordedBy is populated for display on the timeline card.
 */
const fetchLabResults = async (patientId) => {
  const docs = await LabResult.find({ patientId })
    .populate('recordedBy', 'name email role')
    .sort({ recordedAt: -1 })
    .lean();

  return docs.map(normalizeLabResult);
};

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * GET /api/timeline/:patientId
 * Returns the unified patient timeline sorted newest → oldest.
 * All five sources are fetched concurrently then merged into one list.
 * Auth: doctor | admin
 */
export const getTimeline = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  // Fetch all sources concurrently — no inter-dependency between them.
  const [appointments, prescriptions, reports, vitals, labResults] =
    await Promise.all([
      fetchAppointments(patientId),
      fetchPrescriptions(patientId),
      fetchReports(patientId),
      fetchVitals(patientId),
      fetchLabResults(patientId),
    ]);

  // Merge all five arrays then sort by date descending (newest event first).
  // Events with a missing/null date are pushed to the end.
  const timeline = [
    ...appointments,
    ...prescriptions,
    ...reports,
    ...vitals,
    ...labResults,
  ].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da; // descending
  });

  sendSuccess(res, {
    message: 'Patient timeline fetched.',
    data: { count: timeline.length, timeline },
  });
});
