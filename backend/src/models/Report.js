// Report — a medical document uploaded by a patient (stored on Cloudinary).
// May optionally be linked to a specific appointment.

import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Optional association with an appointment.
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
    },
    // Cloudinary public ID — needed to delete the asset later.
    publicId: {
      type: String,
      required: [true, 'Cloudinary public ID is required'],
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
  },
  // timestamps provides uploadedAt-equivalent createdAt; alias for clarity.
  { timestamps: { createdAt: 'uploadedAt', updatedAt: true } }
);

reportSchema.index({ patient: 1, uploadedAt: -1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;
