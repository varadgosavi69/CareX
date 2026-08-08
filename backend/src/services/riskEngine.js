// Risk scoring orchestrator.
//
// Pipeline for a given patientId:
//   1. Fetch the last N readings per vital type and per lab test name from DB
//   2. Run threshold rules (riskRules.js) on each individual reading
//   3. Run trend detection (trendDetector.js) on each same-type series
//   4. Accumulate a weighted score from all flags
//   5. Map the numeric score to a riskLevel: Low / Moderate / High
//   6. Return { riskLevel, score, reasons[], assessedAt }
//
// Score thresholds (tunable):
//   0–3   → Low
//   4–7   → Moderate
//   8+    → High
//
// Weight contributions:
//   Threshold breach (from riskRules):  weight 1–3 per flagged reading
//   Trend extra weight (from detector): weight 0–3 added once per type
//   Multiple abnormal readings of the same type get capped at 2× the
//   single-reading weight to avoid runaway scores from many data points.

import Vital     from '../models/Vital.js';
import LabResult from '../models/LabResult.js';
import { VITAL_RULE_MAP, checkLabResult } from './riskRules.js';
import { detectTrend }                    from './trendDetector.js';

// ─── Tuning constants ─────────────────────────────────────────────────────────

/** Maximum readings per type fetched for scoring. Older data is less relevant. */
const READINGS_PER_TYPE = 10;

/** Score band boundaries. */
const SCORE_THRESHOLDS = Object.freeze({
  LOW:      { max: 3,  label: 'Low' },
  MODERATE: { max: 7,  label: 'Moderate' },
  HIGH:     { max: Infinity, label: 'High' },
});

// ─── Score → risk level ───────────────────────────────────────────────────────

const scoreToLevel = (score) => {
  if (score <= SCORE_THRESHOLDS.LOW.max)      return SCORE_THRESHOLDS.LOW.label;
  if (score <= SCORE_THRESHOLDS.MODERATE.max) return SCORE_THRESHOLDS.MODERATE.label;
  return SCORE_THRESHOLDS.HIGH.label;
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

/**
 * Fetch the last N vitals per type for a patient.
 * Returns a Map<vitalType, reading[]> where each array is oldest → newest.
 */
const fetchVitalsByType = async (patientId) => {
  const grouped = new Map();

  // Fetch all vital types concurrently
  await Promise.all(
    Object.keys(VITAL_RULE_MAP).map(async (type) => {
      const docs = await Vital.find({ patientId, type })
        .sort({ recordedAt: -1 })
        .limit(READINGS_PER_TYPE)
        .lean();

      if (docs.length > 0) {
        // Reverse so array is oldest → newest for trend analysis
        grouped.set(type, docs.reverse());
      }
    })
  );

  return grouped;
};

/**
 * Fetch the last N lab results per test name for a patient.
 * Returns a Map<testName, reading[]> where each array is oldest → newest.
 */
const fetchLabResultsByTest = async (patientId) => {
  // Get all distinct test names for this patient first
  const allLabs = await LabResult.find({ patientId })
    .sort({ recordedAt: -1 })
    .lean();

  // Group by testName — take only the most recent READINGS_PER_TYPE per name
  const grouped = new Map();
  for (const doc of allLabs) {
    const name = doc.testName;
    if (!grouped.has(name)) grouped.set(name, []);
    if (grouped.get(name).length < READINGS_PER_TYPE) {
      grouped.get(name).unshift(doc); // prepend to maintain oldest-first order
    }
  }

  return grouped;
};

// ─── Scoring logic ────────────────────────────────────────────────────────────

/**
 * Score a group of same-type readings:
 *   - Run the threshold rule on EVERY reading; cap total breach weight at 2×single
 *   - Run trend detection on the full series; add trend weight once
 *
 * Returns { score: number, reasons: string[] }
 */
const scoreReadingGroup = (readings, ruleChecker) => {
  if (!readings || readings.length === 0) return { score: 0, reasons: [] };

  const reasons = [];
  let breachScore = 0;
  let maxSingleBreachWeight = 0;
  let breachCount = 0;

  for (const reading of readings) {
    const result = ruleChecker(reading);
    if (result.flagged) {
      breachCount++;
      maxSingleBreachWeight = Math.max(maxSingleBreachWeight, result.weight);
      // Include reason for the MOST RECENT flagged reading (last item in oldest→newest array)
      if (reading === readings[readings.length - 1]) {
        reasons.push(result.reason);
      }
    }
  }

  if (breachCount > 0) {
    // Cap at 2× the single-reading weight regardless of how many readings breach
    breachScore = Math.min(breachCount * maxSingleBreachWeight, maxSingleBreachWeight * 2);
  }

  // Trend detection (needs ≥ 2 readings)
  const trendResult = detectTrend(readings);
  const trendScore = trendResult.weight;

  if (trendScore > 0) {
    reasons.push(trendResult.reason);
  }

  return { score: breachScore + trendScore, reasons };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the risk score for a patient.
 *
 * @param {string|import('mongoose').Types.ObjectId} patientId
 * @returns {Promise<{
 *   riskLevel: 'Low'|'Moderate'|'High',
 *   score: number,
 *   reasons: string[],
 *   assessedAt: Date
 * }>}
 */
export const computeRisk = async (patientId) => {
  // Fetch all data concurrently
  const [vitalGroups, labGroups] = await Promise.all([
    fetchVitalsByType(patientId),
    fetchLabResultsByTest(patientId),
  ]);

  let totalScore = 0;
  const allReasons = [];

  // ── Score each vital type ─────────────────────────────────────────────────
  for (const [type, readings] of vitalGroups.entries()) {
    const ruleChecker = VITAL_RULE_MAP[type];
    if (!ruleChecker) continue;

    const { score, reasons } = scoreReadingGroup(readings, ruleChecker);
    totalScore += score;
    allReasons.push(...reasons);
  }

  // ── Score each lab test ───────────────────────────────────────────────────
  for (const [, readings] of labGroups.entries()) {
    const { score, reasons } = scoreReadingGroup(readings, checkLabResult);
    totalScore += score;
    allReasons.push(...reasons);
  }

  return {
    riskLevel:  scoreToLevel(totalScore),
    score:      totalScore,
    reasons:    allReasons,
    assessedAt: new Date(),
  };
};
