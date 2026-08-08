// Trend and anomaly detector.
//
// Works on a sorted array of same-type readings (oldest → newest) and produces
// a trend assessment with a human-readable reason and an extra weight that the
// risk engine adds on top of any threshold-breach weight.
//
// Two detection strategies:
//
//   1. CONSECUTIVE DIRECTION — 3 or more readings that move strictly in the
//      same direction (each value higher/lower than the one before it).
//      Weighted by how many consecutive steps were found:
//        3 steps → weight +1  (concerning)
//        4 steps → weight +2  (worrying)
//        5+      → weight +3  (urgent escalation)
//
//   2. SUDDEN CHANGE — any single step where the relative change between two
//      consecutive readings exceeds 20 % of the earlier value.
//      Weight: +2 (abrupt changes are clinically more dangerous than slow drift)
//
// Return shape:
//   { trend: 'rising'|'falling'|'sudden_change'|'stable', reason: string, weight: number }
//
// If both patterns are present in the same series the one with the higher weight
// is returned (caller can also run both separately if needed).
//
// IMPORTANT: readings must be sorted oldest → newest before calling.
// Blood pressure uses a composite "mean arterial pressure" proxy so that a
// single numeric series can represent both systolic and diastolic movement.

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract a single comparable numeric value from a reading.
 * For BloodPressure this uses MAP ≈ diastolic + (systolic − diastolic)/3,
 * which captures the combined haemodynamic load in one number.
 * For all other vital types the stored `value.single` is used directly.
 * For lab results the top-level `value` field is used.
 */
const extractNumeric = (reading) => {
  // Lab result — plain numeric field
  if (reading.testName !== undefined) return reading.value ?? null;

  // Vital — BP uses MAP proxy
  if (reading.type === 'BloodPressure') {
    const { systolic, diastolic } = reading.value ?? {};
    if (systolic == null || diastolic == null) return null;
    return diastolic + (systolic - diastolic) / 3;
  }

  // All other vitals use `value.single`
  return reading.value?.single ?? null;
};

/**
 * Friendly label for the reading: vital type or lab test name.
 */
const label = (reading) =>
  reading.testName ? reading.testName : (reading.type ?? 'measurement');

// ─── Detection strategies ─────────────────────────────────────────────────────

/**
 * Detect the longest run of strictly increasing or decreasing consecutive steps.
 * Returns the run length and direction, or null if no run of ≥ 3 is found.
 *
 * @param {number[]} values  Numeric series, oldest first.
 * @returns {{ direction: 'rising'|'falling', runLength: number } | null}
 */
const longestConsecutiveRun = (values) => {
  if (values.length < 3) return null;

  let bestDirection = null;
  let bestLength = 0;

  let currentDirection = null;
  let currentLength = 1;

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff === 0) {
      // Flat step resets the run
      currentDirection = null;
      currentLength = 1;
      continue;
    }
    const dir = diff > 0 ? 'rising' : 'falling';

    if (dir === currentDirection) {
      currentLength += 1;
    } else {
      currentDirection = dir;
      currentLength = 2; // current pair is step 1 of a new run
    }

    if (currentLength > bestLength) {
      bestLength = currentLength;
      bestDirection = currentDirection;
    }
  }

  // A run of N steps means N+1 readings — we report the step count (N)
  // because "3 consecutive rising readings" means 3 upward steps (4 points).
  // The task spec says "3+ consecutive readings moving in the same direction",
  // so we use the point count: bestLength here is the number of points in the
  // current streak (including the starting point), which equals steps + 1.
  // We want ≥ 3 points (= ≥ 2 steps).
  if (bestLength >= 3) {
    return { direction: bestDirection, runLength: bestLength };
  }
  return null;
};

/**
 * Find the largest single-step relative change in the series.
 * Returns { index, pct } of the step, or null if none exceeds 20 %.
 *
 * @param {number[]} values  Numeric series, oldest first.
 */
const largestSuddenChange = (values) => {
  if (values.length < 2) return null;

  let maxPct = 0;
  let maxIndex = -1;

  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    if (prev === 0) continue; // avoid division by zero
    const pct = Math.abs((values[i] - prev) / prev) * 100;
    if (pct > maxPct) {
      maxPct = pct;
      maxIndex = i;
    }
  }

  if (maxPct > 20) return { index: maxIndex, pct: maxPct };
  return null;
};

// ─── Weight helpers ───────────────────────────────────────────────────────────

/** Extra weight for a consecutive run based on its length. */
const runWeight = (runLength) => {
  if (runLength >= 5) return 3;
  if (runLength >= 4) return 2;
  return 1; // 3 points
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a sorted array of same-type readings (oldest → newest) for trends.
 *
 * @param {object[]} readings  Vital or LabResult documents (plain objects), oldest first.
 * @returns {{ trend: string, reason: string, weight: number }}
 */
export const detectTrend = (readings) => {
  if (!readings || readings.length < 2) {
    return { trend: 'stable', reason: 'Insufficient data for trend analysis.', weight: 0 };
  }

  const values = readings.map(extractNumeric).filter((v) => v != null);
  if (values.length < 2) {
    return { trend: 'stable', reason: 'Insufficient numeric data for trend analysis.', weight: 0 };
  }

  const name = label(readings[0]);

  // ── Strategy 1: consecutive direction ────────────────────────────────────
  const run = longestConsecutiveRun(values);

  // ── Strategy 2: sudden change ─────────────────────────────────────────────
  const sudden = largestSuddenChange(values);

  // Build candidate results and return the one with higher weight
  const candidates = [];

  if (run) {
    const w = runWeight(run.runLength);
    const dir = run.direction === 'rising' ? 'rising' : 'falling';
    candidates.push({
      trend: dir,
      reason: `${name}: ${run.runLength} consecutive ${dir} readings detected`,
      weight: w,
    });
  }

  if (sudden) {
    candidates.push({
      trend: 'sudden_change',
      reason: `${name}: sudden ${sudden.pct.toFixed(1)}% change between consecutive readings`,
      weight: 2,
    });
  }

  if (candidates.length === 0) {
    return { trend: 'stable', reason: `${name}: readings are stable.`, weight: 0 };
  }

  // Return highest-weight candidate (sudden_change beats a mild run)
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0];
};

/**
 * Convenience: run detectTrend on each group of same-type readings independently.
 *
 * @param {Map<string, object[]>} groupedReadings  Map of type/testName → readings (oldest first).
 * @returns {Array<{ label: string, trend: string, reason: string, weight: number }>}
 */
export const detectAllTrends = (groupedReadings) => {
  const results = [];
  for (const [key, readings] of groupedReadings.entries()) {
    const result = detectTrend(readings);
    if (result.trend !== 'stable' || result.weight > 0) {
      results.push({ label: key, ...result });
    }
  }
  return results;
};
