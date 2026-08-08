// Vital signs record — stores a single timed measurement for a patient.
// Blood pressure uses a {systolic, diastolic} sub-document; all other types
// store a single numeric `value.single`. Indexed for patient timeline queries.

import mongoose from 'mongoose';

// Vital type enum — extend here as new sensor types are added in later phases.
export const VITAL_TYPES = Object.freeze([
  'BloodPressure',
  'HeartRate',
  'Temperature',
  'SpO2',
  'BloodGlucose',
]);

// Flexible value container. One of `single` or `{systolic, diastolic}` will be
// populated depending on the vital type (enforced by the pre-validate hook).
const vitalValueSchema = new mongoose.Schema(
  {
    // All non-BP types: HeartRate, Temperature, SpO2, BloodGlucose
    single: { type: Number },
    // BloodPressure only
    systolic: { type: Number },
    diastolic: { type: Number },
  },
  { _id: false }
);

const vitalSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // CareX User model (role = patient)
      required: [true, 'patientId is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Vital type is required'],
      enum: {
        values: VITAL_TYPES,
        message: 'type must be one of: BloodPressure, HeartRate, Temperature, SpO2, BloodGlucose',
      },
    },
    value: {
      type: vitalValueSchema,
      required: [true, 'value is required'],
    },
    unit: {
      type: String,
      required: [true, 'unit is required'],
      trim: true,
      maxlength: 20,
      // Examples: "mmHg", "bpm", "°C", "%", "mg/dL"
    },
    recordedAt: {
      type: Date,
      required: [true, 'recordedAt is required'],
      default: Date.now,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // CareX User whose role is 'doctor' or 'admin'
      required: [true, 'recordedBy is required'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// Fast patient-timeline queries, sorted oldest → newest.
vitalSchema.index({ patientId: 1, recordedAt: 1 });

// Enforce correct value shape per vital type before saving.
vitalSchema.pre('validate', function (next) {
  const { type, value } = this;
  if (!value) return next();

  if (type === 'BloodPressure') {
    if (value.systolic == null || value.diastolic == null) {
      return next(
        new Error('BloodPressure vitals require value.systolic and value.diastolic')
      );
    }
  } else if (type != null) {
    if (value.single == null) {
      return next(new Error(`${type} vitals require value.single`));
    }
  }
  return next();
});

const Vital = mongoose.model('Vital', vitalSchema);

export default Vital;
