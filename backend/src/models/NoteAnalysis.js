// NoteAnalysis — stores the keyword-extraction result for a single clinical note.
// Kept as a separate collection so analysis results can be queried, aggregated,
// and re-run independently without modifying the source documents.
//
// sourceType: which collection the note came from ('Prescription' | 'Vital' | 'LabResult')
// noteRefId:  ObjectId of the source document
// patientId:  denormalised for fast patient-scoped queries

import mongoose from 'mongoose';

const noteAnalysisSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'patientId is required'],
      index: true,
    },
    // Which collection the note text came from
    sourceType: {
      type: String,
      required: [true, 'sourceType is required'],
      enum: {
        values: ['Prescription', 'Vital', 'LabResult'],
        message: "sourceType must be 'Prescription', 'Vital', or 'LabResult'",
      },
    },
    // _id of the source document (Prescription, Vital, or LabResult)
    noteRefId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'noteRefId is required'],
    },
    // The original note text that was analysed (stored for auditability)
    noteText: {
      type: String,
      trim: true,
      maxlength: [2000, 'noteText cannot exceed 2000 characters'],
    },
    // Keywords matched from the symptoms category
    matchedSymptoms: {
      type: [String],
      default: [],
    },
    // Keywords matched from the riskIndicators category
    matchedRiskIndicators: {
      type: [String],
      default: [],
    },
    // true if any riskIndicator matched OR ≥ 2 symptoms matched
    flagged: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
);

// Fast patient-scoped queries; compound index also supports filtering by source type
noteAnalysisSchema.index({ patientId: 1, createdAt: -1 });
noteAnalysisSchema.index({ patientId: 1, sourceType: 1 });

// Prevent duplicate analyses for the same source document
noteAnalysisSchema.index({ noteRefId: 1, sourceType: 1 }, { unique: true });

const NoteAnalysis = mongoose.model('NoteAnalysis', noteAnalysisSchema);

export default NoteAnalysis;
