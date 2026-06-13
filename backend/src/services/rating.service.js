// Rating business logic. A patient may rate a doctor once per COMPLETED
// appointment. The doctor's avgRating/ratingCount are recomputed automatically
// by the Rating model's post-save hook.

import Rating from '../models/Rating.js';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import ApiError from '../utils/ApiError.js';
import { APPOINTMENT_STATUS } from '../utils/constants.js';

/**
 * Patient creates a rating for one of their completed appointments.
 */
export const createRating = async (patientUser, { appointmentId, stars, review }) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  if (!appointment.patient.equals(patientUser._id)) {
    throw ApiError.forbidden('You can only rate your own appointments');
  }

  if (appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
    throw ApiError.badRequest('You can only rate completed appointments');
  }

  const existing = await Rating.findOne({ appointment: appointmentId });
  if (existing) throw ApiError.conflict('You have already rated this appointment');

  // Post-save hook on the model recomputes the doctor's aggregate rating.
  const rating = await Rating.create({
    patient: patientUser._id,
    doctor: appointment.doctor,
    appointment: appointmentId,
    stars,
    review,
  });

  return rating;
};

/**
 * Public list of a doctor's ratings (paginated).
 */
export const listDoctorRatings = async (doctorId, { page, limit }) => {
  const doctor = await Doctor.findById(doctorId).select('avgRating ratingCount');
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Rating.find({ doctor: doctorId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient', 'name')
      .select('stars review createdAt patient'),
    Rating.countDocuments({ doctor: doctorId }),
  ]);

  return {
    items,
    avgRating: doctor.avgRating,
    ratingCount: doctor.ratingCount,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};
