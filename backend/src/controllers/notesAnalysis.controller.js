// Notes analysis controller — fetches all clinical notes for a patient from
// Prescription, Vital, and LabResult, runs keyword extraction on each, persists
// the results in NoteAnalysis (upsert so re-runs are idempotent), and returns
// the combined analysis.

import asyncHandler    from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import Prescription    from '../models/Prescription.js';
import Vital           from '../models/Vital.js';
import LabResult       from '../models/LabResult.js';
import NoteAnalysis    from '../models/NoteAnalysis.js';
import { analyzeNoteText } from '../services/notesAnalyzer.js';

// ─── Source collectors ────────────────────────────────────────────────────────

/**
 * Gather all note-bearing documents for a patient across three sources.
 * Returns an array of { sourceType, refId, text } objects — only entries
 * with non-empty text are included.
 */
const collectNoteSources = async (patientId) => {
  const [prescriptions, vitals, labResults] = await Promise.all([
    Prescription.find({ patient: patientId }).select('notes').lean(),
    Vital.find({ patientId }).select('notes').lean(),
    LabResult.find({ patientId }).select('notes').lean(),
  ]);

  const sources = [];

  for (const rx of prescriptions) {
    if (rx.notes?.trim()) {
      sources.push({ sourceType: 'Prescription', refId: rx._id, text: rx.notes });
    }
  }
  for (const v of vitals) {
    if (v.notes?.trim()) {
      sources.push({ sourceType: 'Vital', refId: v._id, text: v.notes });
    }
  }
  for (const lab of labResults) {
    if (lab.notes?.trim()) {
      sources.push({ sourceType: 'LabResult', refId: lab._id, text: lab.notes });
    }
  }

  return sources;
};

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * GET /api/notes-analysis/:patientId
 *
 * 1. Collects all notes for the patient from Prescription / Vital / LabResult
 * 2. Runs keyword extraction on each note
 * 3. Upserts results into NoteAnalysis (idempotent on re-call)
 * 4. Returns:
 *    {
 *      totalNotes:    number,
 *      flaggedNotes:  number,
 *      analyses:      NoteAnalysis[],
 *      summary: {
 *        allMatchedSymptoms:       string[],   // deduplicated union
 *        allMatchedRiskIndicators: string[],   // deduplicated union
 *        anyFlagged:               boolean,
 *      }
 *    }
 *
 * Auth: doctor | admin
 */
export const analyzePatientNotes = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const sources = await collectNoteSources(patientId);

  // Run analysis + upsert concurrently for each note source
  const analyses = await Promise.all(
    sources.map(async ({ sourceType, refId, text }) => {
      const { matchedSymptoms, matchedRiskIndicators, flagged } =
        analyzeNoteText(text);

      // Upsert so repeated calls don't create duplicate records
      const doc = await NoteAnalysis.findOneAndUpdate(
        { noteRefId: refId, sourceType },
        {
          $set: {
            patientId,
            noteText: text,
            matchedSymptoms,
            matchedRiskIndicators,
            flagged,
          },
        },
        { upsert: true, new: true }
      );

      return doc;
    })
  );

  // Also return any previously stored analyses for notes that no longer have text
  // (e.g. a prescription note was cleared) so the history is complete
  const allStored = await NoteAnalysis.find({ patientId })
    .sort({ createdAt: -1 })
    .lean();

  // Build deduplicated summary across all analyses
  const allMatchedSymptoms = [
    ...new Set(allStored.flatMap((a) => a.matchedSymptoms)),
  ];
  const allMatchedRiskIndicators = [
    ...new Set(allStored.flatMap((a) => a.matchedRiskIndicators)),
  ];
  const anyFlagged = allStored.some((a) => a.flagged);

  sendSuccess(res, {
    message: 'Patient notes analysis complete.',
    data: {
      totalNotes:   allStored.length,
      flaggedNotes: allStored.filter((a) => a.flagged).length,
      analyses:     allStored,
      summary: {
        allMatchedSymptoms,
        allMatchedRiskIndicators,
        anyFlagged,
      },
    },
  });
});
