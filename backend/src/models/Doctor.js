// Doctor profile — extends a User (role=doctor) with professional details,
// availability, approval status, and aggregated rating stats.

import mongoose from 'mongoose';
import {
  SPECIALTIES,
  DOCTOR_STATUS,
  DOCTOR_STATUS_VALUES,
  WEEKDAYS,
} from '../utils/constants.js';

// A single recurring availability window, e.g. Monday 09:00–13:00.
const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    // 24h "HH:mm" strings.
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:mm'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:mm'],
    },
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    // One Doctor profile per User.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    specialty: {
      type: String,
      enum: SPECIALTIES,
      required: [true, 'Specialty is required'],
    },
    qualifications: {
      type: String,
      trim: true,
      default: '',
    },
    experienceYears: {
      type: Number,
      min: [0, 'Experience cannot be negative'],
      default: 0,
    },
    consultationFee: {
      type: Number,
      min: [0, 'Consultation fee cannot be negative'],
      default: 0,
    },
    availability: {
      type: [availabilitySchema],
      default: [],
    },
    status: {
      type: String,
      enum: DOCTOR_STATUS_VALUES,
      default: DOCTOR_STATUS.PENDING,
    },
    // Maintained automatically by the Rating model.
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Fast directory queries: list approved doctors filtered by specialty.
doctorSchema.index({ status: 1, specialty: 1 });

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
