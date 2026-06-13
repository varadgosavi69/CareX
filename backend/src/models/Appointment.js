// Appointment — a patient's booking with a doctor at a specific time/slot.
// All booking validation (availability, double-booking, fee snapshot) is
// enforced server-side in the appointment service (Phase 4).

import mongoose from 'mongoose';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
} from '../utils/constants.js';

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    // Specialty / category captured at booking time for display & history.
    category: {
      type: String,
      trim: true,
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Appointment date/time is required'],
    },
    // Human-readable slot label, e.g. "10:00-10:30".
    slot: {
      type: String,
      required: [true, 'Slot is required'],
      trim: true,
    },
    // Fee snapshot taken from the doctor at booking time so historical
    // appointments keep the price that applied when they were booked.
    consultationFee: {
      type: Number,
      min: [0, 'Consultation fee cannot be negative'],
      default: 0,
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUS_VALUES,
      default: APPOINTMENT_STATUS.PENDING,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    location: locationSchema,
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PAYMENT_STATUS.UNPAID,
    },
  },
  { timestamps: true }
);

// Lookups by doctor's calendar and by patient's history.
appointmentSchema.index({ doctor: 1, scheduledAt: 1 });
appointmentSchema.index({ patient: 1, scheduledAt: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
