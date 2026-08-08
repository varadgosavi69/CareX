// Doctor notes text analyzer.
//
// analyzeNoteText(text) scans free-form clinical note text for keywords from
// the NOTES_KEYWORDS dictionary and returns a structured result.
//
// Matching strategy:
//   - Lowercases both the text and each keyword before comparing
//   - Uses word-boundary-aware substring matching so 'fever' matches
//     "high fever" but NOT "hay fever" edge cases are handled by phrase
//     specificity in the dictionary (multi-word phrases naturally avoid most
//     false positives)
//   - Each keyword is matched at most once (deduped) even if it appears
//     multiple times in the note
//
// Return shape:
//   {
//     matchedSymptoms:       string[],   // keywords from symptoms category
//     matchedRiskIndicators: string[],   // keywords from riskIndicators category
//     flagged:               boolean,    // true if any riskIndicator OR ≥2 symptoms
//     symptomCount:          number,
//     riskIndicatorCount:    number,
//   }
//
// Edge cases:
//   - null / undefined / empty string → all empty, flagged: false
//   - Non-string input → coerced to string via String()

import NOTES_KEYWORDS from './notesKeywords.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build a compiled regex for a keyword that handles word boundaries correctly
 * for both single-word and multi-word phrases.
 *
 * For phrases (contains a space) we just do a case-insensitive substring match
 * because word boundaries around spaces are tricky.
 * For single words we use \b on both sides.
 *
 * The compiled regexes are cached at module load time so repeated calls to
 * analyzeNoteText() don't recompile them.
 */
const compilePattern = (keyword) => {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Multi-word phrase: simple substring match (the phrase itself is specific enough)
  if (keyword.includes(' ')) return new RegExp(escaped, 'i');
  // Single word: require word boundaries
  return new RegExp(`\\b${escaped}\\b`, 'i');
};

// Pre-compile all patterns once at module initialisation.
const SYMPTOM_PATTERNS = NOTES_KEYWORDS.symptoms.map((kw) => ({
  keyword: kw,
  regex: compilePattern(kw),
}));

const RISK_PATTERNS = NOTES_KEYWORDS.riskIndicators.map((kw) => ({
  keyword: kw,
  regex: compilePattern(kw),
}));

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a single note text string for clinical keywords.
 *
 * @param {string|null|undefined} text  Free-form doctor note text.
 * @returns {{
 *   matchedSymptoms:       string[],
 *   matchedRiskIndicators: string[],
 *   flagged:               boolean,
 *   symptomCount:          number,
 *   riskIndicatorCount:    number,
 * }}
 */
export const analyzeNoteText = (text) => {
  const empty = {
    matchedSymptoms:       [],
    matchedRiskIndicators: [],
    flagged:               false,
    symptomCount:          0,
    riskIndicatorCount:    0,
  };

  if (!text) return empty;

  const normalized = String(text).trim();
  if (normalized.length === 0) return empty;

  // Match symptoms
  const matchedSymptoms = SYMPTOM_PATTERNS
    .filter(({ regex }) => regex.test(normalized))
    .map(({ keyword }) => keyword);

  // Match risk indicators
  const matchedRiskIndicators = RISK_PATTERNS
    .filter(({ regex }) => regex.test(normalized))
    .map(({ keyword }) => keyword);

  // flagged = any risk indicator hit OR 2+ symptoms hit
  const flagged =
    matchedRiskIndicators.length > 0 || matchedSymptoms.length >= 2;

  return {
    matchedSymptoms,
    matchedRiskIndicators,
    flagged,
    symptomCount:          matchedSymptoms.length,
    riskIndicatorCount:    matchedRiskIndicators.length,
  };
};

/**
 * Analyse multiple note texts and aggregate the results.
 * Useful when a patient has several prescriptions / notes.
 *
 * @param {Array<{ text: string, sourceType: string, refId: string }>} noteSources
 * @returns {Array<{
 *   sourceType: string,
 *   refId:      string,
 *   analysis:   ReturnType<typeof analyzeNoteText>,
 * }>}
 */
export const analyzeAllNotes = (noteSources) =>
  noteSources
    .filter(({ text }) => text && String(text).trim().length > 0)
    .map(({ text, sourceType, refId }) => ({
      sourceType,
      refId,
      analysis: analyzeNoteText(text),
    }));
