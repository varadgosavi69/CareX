// Lab result record — a single numeric test result for a patient with an
// optional reference range for normal/abnormal classification in later phases.

import mongoose from 'mongoose';

const labResultSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // CareX User model (role = patient)
      required: [true, 'patientId is required'],
      index: true,
    },
    testName: {
      type: String,
      required: [true, 'testName is required'],
      trim: true,
      maxlength: [200, 'testName cannot exceed 200 characters'],
      // Examples: "HbA1c", "LDL Cholesterol", "Serum Creatinine", "CBC — WBC"
    },
    value: {
      type: Number,
      required: [true, 'value is required'],
    },
    unit: {
      type: String,
      required: [true, 'unit is required'],
      trim: true,
      maxlength: [50, 'unit cannot exceed 50 characters'],
      // Examples: "g/dL", "mg/dL", "mmol/L", "%", "10^3/µL"
    },
    referenceRange: {
      type: String,
      trim: true,
      maxlength: [100, 'referenceRange cannot exceed 100 characters'],
      // Examples: "70-100", "< 200", "4.0-5.6%"
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
    labName: {
      type: String,
      trim: true,
      maxlength: [200, 'labName cannot exceed 200 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'notes cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

// Fast patient-timeline queries, sorted oldest → newest.
labResultSchema.index({ patientId: 1, recordedAt: 1 });

const LabResult = mongoose.model('LabResult', labResultSchema);

export default LabResult;
