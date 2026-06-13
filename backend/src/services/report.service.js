// Report business logic. Patients upload medical files (stored on Cloudinary),
// list their own, and delete their own (which also removes the Cloudinary asset).

import Report from '../models/Report.js';
import Appointment from '../models/Appointment.js';
import ApiError from '../utils/ApiError.js';
import { uploadToCloudinary, deleteFromCloudinary } from './upload.service.js';

/**
 * Upload and record a new report for the patient.
 */
export const createReport = async (patientId, file, { appointmentId } = {}) => {
  if (!file) throw ApiError.badRequest('A file is required');

  // If linked to an appointment, it must belong to this patient.
  if (appointmentId) {
    const appointment = await Appointment.findOne({ _id: appointmentId, patient: patientId });
    if (!appointment) throw ApiError.badRequest('Invalid appointment for this patient');
  }

  const result = await uploadToCloudinary(file.buffer, { folder: 'carex/reports' });

  return Report.create({
    patient: patientId,
    appointment: appointmentId || null,
    fileUrl: result.secure_url,
    publicId: result.public_id,
    fileName: file.originalname,
    fileType: file.mimetype,
  });
};

/**
 * List the patient's own reports, newest first.
 */
export const listReports = (patientId) =>
  Report.find({ patient: patientId }).sort({ uploadedAt: -1 });

/**
 * Delete the patient's own report (and its Cloudinary asset).
 */
export const deleteReport = async (patientId, reportId) => {
  const report = await Report.findById(reportId);
  if (!report) throw ApiError.notFound('Report not found');

  if (!report.patient.equals(patientId)) {
    throw ApiError.forbidden('You can only delete your own reports');
  }

  // Remove the underlying asset first; PDFs are stored as the "image" type.
  await deleteFromCloudinary(report.publicId);
  await report.deleteOne();
};
