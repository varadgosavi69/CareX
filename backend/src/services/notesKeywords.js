// Doctor notes keyword dictionary.
//
// Two categories are defined:
//   symptoms        — clinical observations that a patient may present with
//   riskIndicators  — language that signals deterioration, urgency, or non-response
//
// Each entry is a lowercase string; the analyzer does case-insensitive matching
// so "Chest Pain" in a note will match the 'chest pain' entry.
//
// Keep entries as specific phrases (not single letters) to avoid false positives.
// Single-word entries are acceptable only when the word is unambiguously clinical
// (e.g. 'cyanosis', 'tachycardia').
//
// To extend: simply add entries to either array. No code changes needed elsewhere.

const NOTES_KEYWORDS = Object.freeze({

  symptoms: Object.freeze([
    // Cardiovascular
    'chest pain',
    'chest tightness',
    'palpitations',
    'irregular heartbeat',
    'shortness of breath',
    'breathlessness',
    'dyspnea',
    'edema',
    'swelling in legs',

    // Neurological
    'dizziness',
    'vertigo',
    'headache',
    'migraine',
    'confusion',
    'disorientation',
    'seizure',
    'fainting',
    'syncope',
    'numbness',
    'tingling',
    'weakness',

    // Gastrointestinal
    'nausea',
    'vomiting',
    'abdominal pain',
    'stomach pain',
    'diarrhea',
    'constipation',
    'bloating',
    'loss of appetite',
    'difficulty swallowing',

    // Respiratory
    'cough',
    'persistent cough',
    'wheezing',
    'hemoptysis',
    'coughing blood',
    'nasal congestion',
    'runny nose',

    // Systemic / General
    'fever',
    'high temperature',
    'chills',
    'night sweats',
    'fatigue',
    'extreme tiredness',
    'weight loss',
    'unexplained weight loss',
    'weight gain',
    'loss of consciousness',
    'insomnia',
    'sleep disturbance',

    // Musculoskeletal
    'joint pain',
    'muscle pain',
    'myalgia',
    'arthralgia',
    'back pain',
    'neck stiffness',

    // Dermatological
    'rash',
    'skin rash',
    'itching',
    'jaundice',
    'yellowing of skin',
    'cyanosis',
    'pallor',

    // Urological / Renal
    'painful urination',
    'dysuria',
    'blood in urine',
    'hematuria',
    'reduced urine output',
    'polyuria',
    'frequent urination',

    // Endocrine / Metabolic
    'excessive thirst',
    'polydipsia',
    'blurred vision',
    'vision changes',
    'cold intolerance',
    'heat intolerance',
  ]),

  riskIndicators: Object.freeze([
    // Trend language
    'worsening',
    'deteriorating',
    'progressively worse',
    'rapid deterioration',
    'getting worse',
    'declining',

    // Non-response
    'not responding to treatment',
    'treatment resistant',
    'refractory',
    'no improvement',
    'failed to respond',
    'unresponsive to',

    // Recurrence
    'recurring',
    'recurrent',
    'relapsing',
    'repeated episodes',
    'chronic recurrence',

    // Severity
    'severe',
    'critical',
    'life-threatening',
    'acute',
    'extreme',
    'excruciating',
    'unbearable',
    'intolerable',

    // Urgency / Escalation
    'urgent referral',
    'immediate attention',
    'emergency',
    'requires hospitalization',
    'admit to hospital',
    'hospital admission',
    'intensive care',
    'icu',
    'escalate',

    // Complication flags
    'complications',
    'complication noted',
    'adverse reaction',
    'suspected sepsis',
    'sepsis',
    'organ failure',
    'cardiac arrest',
    'respiratory failure',
    'multi-organ',
    'anaphylaxis',

    // Medication risk
    'overdose',
    'toxicity',
    'drug interaction',
    'contraindicated',
    'allergy noted',
    'allergic reaction',
  ]),

});

export default NOTES_KEYWORDS;
