// Appointment business logic. ALL booking rules are enforced here server-side:
// the doctor must exist and be approved, the slot must fall within the doctor's
// availability, and the same doctor+slot cannot be double-booked.

import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import ApiError from '../utils/ApiError.js';
import {
  ROLES,
  APPOINTMENT_STATUS,
  DOCTOR_STATUS,
  WEEKDAYS,
} from '../utils/constants.js';

// Statuses that occupy a slot (so it can't be booked again).
const ACTIVE_STATUSES = [
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.APPROVED,
  APPOINTMENT_STATUS.COMPLETED,
];

// Map a Date to a weekday name matching WEEKDAYS (Monday-first), using UTC.
const weekdayFromDate = (date) => WEEKDAYS[(date.getUTCDay() + 6) % 7];

// Populate config reused across reads.
const withRefs = (query) =>
  query
    .populate({ path: 'doctor', select: 'specialty consultationFee user', populate: { path: 'user', select: 'name' } })
    .populate('patient', 'name email');

/**
 * Book an appointment (patient). Validates availability + double-booking and
 * snapshots the doctor's fee/specialty onto the appointment.
 */
export const bookAppointment = async (patientId, { doctorId, scheduledAt, slot, reason, location }) => {
  const doctor = await Doctor.findOne({ _id: doctorId, status: DOCTOR_STATUS.APPROVED });
  if (!doctor) throw ApiError.notFound('Doctor not found or not available for booking');

  // Slot must fall within one of the doctor's availability windows for that day.
  const [slotStart, slotEnd] = slot.split('-');
  const weekday = weekdayFromDate(scheduledAt);
  const isWithinAvailability = doctor.availability.some(
    (a) => a.day === weekday && a.startTime <= slotStart && slotEnd <= a.endTime
  );
  if (!isWithinAvailability) {
    throw ApiError.badRequest(
      `The selected slot is outside the doctor's availability on ${weekday}`
    );
  }

  // No double-booking: same doctor + same datetime with an active appointment.
  const clash = await Appointment.findOne({
    doctor: doctor._id,
    scheduledAt,
    status: { $in: ACTIVE_STATUSES },
  });
  if (clash) {
    throw ApiError.conflict('This slot is already booked for the selected doctor');
  }

  const appointment = await Appointment.create({
    patient: patientId,
    doctor: doctor._id,
    category: doctor.specialty,
    scheduledAt,
    slot,
    reason,
    location,
    consultationFee: doctor.consultationFee, // snapshot
    status: APPOINTMENT_STATUS.PENDING,
  });

  return withRefs(Appointment.findById(appointment._id));
};

/**
 * Role-aware listing: patients see their own, doctors see appointments assigned
 * to their doctor profile, admins see all. Supports status filter + pagination.
 */
export const listAppointments = async (user, { status, page, limit }) => {
  const filter = {};
  if (status) filter.status = status;

  if (user.role === ROLES.PATIENT) {
    filter.patient = user._id;
  } else if (user.role === ROLES.DOCTOR) {
    const doctor = await Doctor.findOne({ user: user._id }).select('_id');
    // A doctor with no profile yet simply has no appointments.
    if (!doctor) {
      return { items: [], page, limit, total: 0, totalPages: 0 };
    }
    filter.doctor = doctor._id;
  }
  // admin: no additional filter

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    withRefs(Appointment.find(filter).sort({ scheduledAt: -1 }).skip(skip).limit(limit)),
    Appointment.countDocuments(filter),
  ]);

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
};

// Load an appointment with the doctor's user id available for ownership checks.
const findWithDoctorUser = (id) =>
  Appointment.findById(id).populate({ path: 'doctor', select: 'user specialty consultationFee' });

/**
 * Get one appointment — only the owning patient, the assigned doctor, or admin.
 */
export const getAppointmentById = async (user, id) => {
  const appointment = await withRefs(findWithDoctorUser(id));
  if (!appointment) throw ApiError.notFound('Appointment not found');

  const isAdmin = user.role === ROLES.ADMIN;
  const isOwnerPatient = appointment.patient._id.equals(user._id);
  const isAssignedDoctor = appointment.doctor?.user?._id?.equals(user._id);

  if (!isAdmin && !isOwnerPatient && !isAssignedDoctor) {
    throw ApiError.forbidden('You do not have access to this appointment');
  }
  return appointment;
};

/**
 * Patient cancels their own appointment — only if it's pending/approved and
 * still in the future.
 */
export const cancelAppointment = async (user, id) => {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  if (!appointment.patient.equals(user._id)) {
    throw ApiError.forbidden('You can only cancel your own appointments');
  }

  const cancellable = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.APPROVED];
  if (!cancellable.includes(appointment.status)) {
    throw ApiError.badRequest(`A ${appointment.status} appointment cannot be cancelled`);
  }
  if (appointment.scheduledAt.getTime() <= Date.now()) {
    throw ApiError.badRequest('A past appointment cannot be cancelled');
  }

  appointment.status = APPOINTMENT_STATUS.CANCELLED;
  await appointment.save();
  return withRefs(Appointment.findById(appointment._id));
};

/**
 * Doctor (owning) or admin changes appointment status.
 *   pending  -> approved | rejected
 *   approved -> completed
 */
export const updateAppointmentStatus = async (user, id, status) => {
  const appointment = await findWithDoctorUser(id);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  // Authorization: admin always; doctor only for their own appointment.
  if (user.role !== ROLES.ADMIN) {
    const isAssignedDoctor = appointment.doctor?.user?.equals(user._id);
    if (!isAssignedDoctor) {
      throw ApiError.forbidden('You can only update your own appointments');
    }
  }

  // Enforce valid transitions.
  const { PENDING, APPROVED, REJECTED, COMPLETED } = APPOINTMENT_STATUS;
  if ((status === APPROVED || status === REJECTED) && appointment.status !== PENDING) {
    throw ApiError.badRequest('Only pending appointments can be approved or rejected');
  }
  if (status === COMPLETED && appointment.status !== APPROVED) {
    throw ApiError.badRequest('Only approved appointments can be marked completed');
  }

  appointment.status = status;
  await appointment.save();
  return withRefs(Appointment.findById(appointment._id));
};
