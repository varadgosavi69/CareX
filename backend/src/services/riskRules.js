// Risk threshold rules for vitals and lab results.
//
// Each rule is a pure function:
//   (reading) → { flagged: boolean, reason: string, weight: number }
//
// `weight` is the base score contribution for a single threshold breach:
//   1 = mild abnormality (worth noting)
//   2 = moderate concern (clearly outside safe range)
//   3 = urgent / potentially dangerous
//
// The trend detector (trendDetector.js) will add extra weight on top of these
// when it finds a pattern across multiple readings.
//
// A `reading` is the plain object stored in the Vital or LabResult collection.
// For vitals:     { type, value: { single? | systolic?, diastolic? }, unit, ... }
// For lab results: { testName, value (Number), unit, ... }

// ─── Vital threshold rules ────────────────────────────────────────────────────

/**
 * Blood Pressure (mmHg)
 * Stage 2 hypertension threshold: systolic > 140 OR diastolic > 90
 * Critically low BP: systolic < 90 OR diastolic < 60 (hypotensive shock risk)
 */
export const checkBloodPressure = (reading) => {
  const { systolic, diastolic } = reading.value ?? {};

  if (systolic == null || diastolic == null) {
    return { flagged: false, reason: '', weight: 0 };
  }

  // Critical high
  if (systolic > 180 || diastolic > 120) {
    return {
      flagged: true,
      reason: `Hypertensive crisis: BP ${systolic}/${diastolic} mmHg (threshold: >180/120)`,
      weight: 3,
    };
  }
  // Stage 2 high
  if (systolic > 140 || diastolic > 90) {
    return {
      flagged: true,
      reason: `Elevated BP ${systolic}/${diastolic} mmHg exceeds threshold of 140/90 mmHg`,
      weight: 2,
    };
  }
  // Low BP
  if (systolic < 90 || diastolic < 60) {
    return {
      flagged: true,
      reason: `Low BP ${systolic}/${diastolic} mmHg is below safe threshold of 90/60 mmHg`,
      weight: 2,
    };
  }

  return { flagged: false, reason: '', weight: 0 };
};

/**
 * Heart Rate (bpm)
 * Tachycardia: > 100 bpm
 * Bradycardia: < 60 bpm
 * Critical tachycardia: > 150 bpm
 */
export const checkHeartRate = (reading) => {
  const value = reading.value?.single;
  if (value == null) return { flagged: false, reason: '', weight: 0 };

  if (value > 150) {
    return {
      flagged: true,
      reason: `Critical tachycardia: Heart rate ${value} bpm exceeds critical threshold of 150 bpm`,
      weight: 3,
    };
  }
  if (value > 100) {
    return {
      flagged: true,
      reason: `Tachycardia: Heart rate ${value} bpm exceeds threshold of 100 bpm`,
      weight: 2,
    };
  }
  if (value < 40) {
    return {
      flagged: true,
      reason: `Critical bradycardia: Heart rate ${value} bpm is below critical threshold of 40 bpm`,
      weight: 3,
    };
  }
  if (value < 60) {
    return {
      flagged: true,
      reason: `Bradycardia: Heart rate ${value} bpm is below threshold of 60 bpm`,
      weight: 1,
    };
  }

  return { flagged: false, reason: '', weight: 0 };
};

/**
 * Temperature (°C)
 * Fever: > 38.0 °C  |  High fever: > 39.5 °C
 * Hypothermia: < 35.0 °C
 */
export const checkTemperature = (reading) => {
  const value = reading.value?.single;
  if (value == null) return { flagged: false, reason: '', weight: 0 };

  if (value > 39.5) {
    return {
      flagged: true,
      reason: `High fever: Temperature ${value} °C exceeds critical threshold of 39.5 °C`,
      weight: 3,
    };
  }
  if (value > 38.0) {
    return {
      flagged: true,
      reason: `Fever: Temperature ${value} °C exceeds threshold of 38.0 °C`,
      weight: 1,
    };
  }
  if (value < 35.0) {
    return {
      flagged: true,
      reason: `Hypothermia: Temperature ${value} °C is below threshold of 35.0 °C`,
      weight: 2,
    };
  }

  return { flagged: false, reason: '', weight: 0 };
};

/**
 * SpO2 — blood oxygen saturation (%)
 * Hypoxia: < 94 %
 * Severe hypoxia: < 90 %
 */
export const checkSpO2 = (reading) => {
  const value = reading.value?.single;
  if (value == null) return { flagged: false, reason: '', weight: 0 };

  if (value < 90) {
    return {
      flagged: true,
      reason: `Severe hypoxia: SpO2 ${value}% is critically below threshold of 90%`,
      weight: 3,
    };
  }
  if (value < 94) {
    return {
      flagged: true,
      reason: `Low SpO2 ${value}% is below safe threshold of 94%`,
      weight: 2,
    };
  }

  return { flagged: false, reason: '', weight: 0 };
};

/**
 * Blood Glucose (mg/dL)
 * Hyperglycaemia: > 180 mg/dL (post-meal threshold)
 * Critical high: > 300 mg/dL
 * Hypoglycaemia: < 70 mg/dL
 * Critical low: < 54 mg/dL
 */
export const checkBloodGlucose = (reading) => {
  const value = reading.value?.single;
  if (value == null) return { flagged: false, reason: '', weight: 0 };

  if (value > 300) {
    return {
      flagged: true,
      reason: `Critical hyperglycaemia: Blood glucose ${value} mg/dL exceeds critical threshold of 300 mg/dL`,
      weight: 3,
    };
  }
  if (value > 180) {
    return {
      flagged: true,
      reason: `Elevated blood glucose ${value} mg/dL exceeds threshold of 180 mg/dL`,
      weight: 2,
    };
  }
  if (value < 54) {
    return {
      flagged: true,
      reason: `Critical hypoglycaemia: Blood glucose ${value} mg/dL is below critical threshold of 54 mg/dL`,
      weight: 3,
    };
  }
  if (value < 70) {
    return {
      flagged: true,
      reason: `Low blood glucose ${value} mg/dL is below safe threshold of 70 mg/dL`,
      weight: 2,
    };
  }

  return { flagged: false, reason: '', weight: 0 };
};

// ─── Lab result threshold rules ───────────────────────────────────────────────
// Lab rules are keyed by a normalised (lowercase, trimmed) testName prefix so
// partial matches work (e.g. "ldl cholesterol" matches "ldl").

const LAB_RULES = [
  {
    // HbA1c (%)
    match: (name) => name.includes('hba1c') || name.includes('glycated haemoglobin'),
    check: (value) => {
      if (value > 9.0) return { flagged: true, reason: `HbA1c ${value}% critically elevated (threshold >9.0%)`, weight: 3 };
      if (value > 6.5) return { flagged: true, reason: `HbA1c ${value}% exceeds diabetes threshold of 6.5%`, weight: 2 };
      if (value > 5.7) return { flagged: true, reason: `HbA1c ${value}% in pre-diabetic range (5.7–6.5%)`, weight: 1 };
      return null;
    },
  },
  {
    // LDL Cholesterol (mg/dL)
    match: (name) => name.includes('ldl'),
    check: (value) => {
      if (value > 190) return { flagged: true, reason: `LDL ${value} mg/dL critically elevated (threshold >190)`, weight: 3 };
      if (value > 130) return { flagged: true, reason: `LDL ${value} mg/dL exceeds desirable threshold of 130 mg/dL`, weight: 2 };
      return null;
    },
  },
  {
    // Serum Creatinine (mg/dL) — renal function marker
    match: (name) => name.includes('creatinine'),
    check: (value) => {
      if (value > 4.0) return { flagged: true, reason: `Serum creatinine ${value} mg/dL critically elevated (threshold >4.0)`, weight: 3 };
      if (value > 1.2) return { flagged: true, reason: `Serum creatinine ${value} mg/dL exceeds normal threshold of 1.2 mg/dL`, weight: 2 };
      return null;
    },
  },
  {
    // Haemoglobin (g/dL) — anaemia marker
    match: (name) => name.includes('haemoglobin') || name.includes('hemoglobin') || name === 'hb',
    check: (value) => {
      if (value < 7.0) return { flagged: true, reason: `Haemoglobin ${value} g/dL critically low (threshold <7.0)`, weight: 3 };
      if (value < 12.0) return { flagged: true, reason: `Haemoglobin ${value} g/dL below normal threshold of 12.0 g/dL`, weight: 2 };
      return null;
    },
  },
];

/**
 * Evaluate a lab result against all known threshold rules.
 * Unrecognised test names return { flagged: false }.
 */
export const checkLabResult = (reading) => {
  const name = (reading.testName ?? '').toLowerCase().trim();
  const value = reading.value;

  if (value == null) return { flagged: false, reason: '', weight: 0 };

  for (const rule of LAB_RULES) {
    if (rule.match(name)) {
      const result = rule.check(value);
      if (result) return result;
      return { flagged: false, reason: '', weight: 0 };
    }
  }

  // No matching rule — not flagged
  return { flagged: false, reason: '', weight: 0 };
};

// ─── Dispatch table: vital type → checker function ───────────────────────────
export const VITAL_RULE_MAP = Object.freeze({
  BloodPressure: checkBloodPressure,
  HeartRate:     checkHeartRate,
  Temperature:   checkTemperature,
  SpO2:          checkSpO2,
  BloodGlucose:  checkBloodGlucose,
});
