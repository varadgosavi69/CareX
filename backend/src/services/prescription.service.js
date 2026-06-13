// Prescription business logic. A doctor writes one prescription per appointment
// (only for their own approved/completed appointments); the owning patient,
// the assigned doctor, or an admin may read it.

import Prescription from '../models/Prescription.js';
import Appointment from '../models/Appointment.js';
import ApiError from '../utils/ApiError.js';
import { ROLES, APPOINTMENT_STATUS } from '../utils/constants.js';

const WRITABLE_STATUSES = [APPOINTMENT_STATUS.APPROVED, APPOINTMENT_STATUS.COMPLETED];

// Load an appointment with the doctor's user id for ownership checks.
const findAppointmentWithDoctorUser = (id) =>
  Appointment.findById(id).populate({ path: 'doctor', select: 'user' });

/**
 * Doctor creates a prescription for one of their appointments.
 */
export const createPrescription = async (doctorUser, appointmentId, { medicines, notes }) => {
  const appointment = await findAppointmentWithDoctorUser(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  // Must be the doctor assigned to this appointment.
  if (!appointment.doctor?.user?.equals(doctorUser._id)) {
    throw ApiError.forbidden('You can only prescribe for your own appointments');
  }

  if (!WRITABLE_STATUSES.includes(appointment.status)) {
    throw ApiError.badRequest(
      'Prescriptions can only be added to approved or completed appointments'
    );
  }

  const existing = await Prescription.findOne({ appointment: appointmentId });
  if (existing) {
    throw ApiError.conflict('A prescription already exists for this appointment');
  }

  const prescription = await Prescription.create({
    appointment: appointment._id,
    doctor: appointment.doctor._id,
    patient: appointment.patient,
    medicines,
    notes,
  });

  return prescription;
};

/**
 * Read the prescription for an appointment — owning patient, assigned doctor,
 * or admin only.
 */
export const getPrescription = async (user, appointmentId) => {
  const prescription = await Prescription.findOne({ appointment: appointmentId })
    .populate({ path: 'doctor', select: 'user specialty', populate: { path: 'user', select: 'name' } })
    .populate('patient', 'name email');

  if (!prescription) throw ApiError.notFound('Prescription not found');

  const isAdmin = user.role === ROLES.ADMIN;
  const isOwnerPatient = prescription.patient._id.equals(user._id);
  const isAssignedDoctor = prescription.doctor?.user?._id?.equals(user._id);

  if (!isAdmin && !isOwnerPatient && !isAssignedDoctor) {
    throw ApiError.forbidden('You do not have access to this prescription');
  }

  return prescription;
};
