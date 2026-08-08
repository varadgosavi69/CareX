// Summary prompt builder.
//
// Constructs a structured, safety-constrained prompt that instructs Gemini to
// synthesise already-computed clinical facts into plain clinician-facing prose.
//
// DESIGN CONSTRAINTS (embedded in the prompt itself):
//   1. Gemini must state risks EXACTLY as provided — no invented risk claims
//   2. No diagnostic language — descriptive summaries only
//   3. The disclaimer is appended by summaryGenerator.js AFTER Gemini responds,
//      so the model cannot accidentally omit or modify it
//
// buildSummaryPrompt() is a pure function — no I/O, easy to unit test.

/**
 * Format a timeline event into a compact single-line string.
 * @param {{ type: string, date: string, summary: string }} event
 */
const formatTimelineEvent = (event) => {
  const date = event.date
    ? new Date(event.date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : 'Unknown date';
  return `• [${event.type}] ${date}: ${event.summary}`;
};

/**
 * Build the full Gemini prompt from pre-computed clinical data.
 *
 * @param {{
 *   count:    number,
 *   timeline: Array<{ type: string, date: string, summary: string, meta: object }>
 * }} timelineData   Output from GET /api/timeline/:patientId
 *
 * @param {{
 *   riskLevel: 'Low'|'Moderate'|'High',
 *   score:     number,
 *   reasons:   string[],
 * }} riskData        Output from GET /api/risk/:patientId (assessment field)
 *
 * @param {{
 *   totalNotes:   number,
 *   flaggedNotes: number,
 *   summary: {
 *     allMatchedSymptoms:       string[],
 *     allMatchedRiskIndicators: string[],
 *     anyFlagged:               boolean,
 *   }
 * }} notesData       Output from GET /api/notes-analysis/:patientId
 *
 * @returns {string}  The complete prompt string ready to send to Gemini.
 */
export const buildSummaryPrompt = (timelineData, riskData, notesData) => {
  // ── Timeline section (most recent 10 events to keep prompt concise) ─────────
  const recentEvents = (timelineData?.timeline ?? []).slice(0, 10);
  const timelineSection =
    recentEvents.length > 0
      ? recentEvents.map(formatTimelineEvent).join('\n')
      : '  No clinical events recorded.';

  // ── Risk section ──────────────────────────────────────────────────────────────
  const riskLevel    = riskData?.riskLevel ?? 'Unknown';
  const riskScore    = riskData?.score     ?? 0;
  const riskReasons  = (riskData?.reasons ?? []);
  const riskSection  =
    riskReasons.length > 0
      ? riskReasons.map((r) => `  - ${r}`).join('\n')
      : '  No risk flags detected.';

  // ── Notes analysis section ───────────────────────────────────────────────────
  const symptoms       = (notesData?.summary?.allMatchedSymptoms       ?? []);
  const riskIndicators = (notesData?.summary?.allMatchedRiskIndicators ?? []);
  const flaggedCount   = notesData?.flaggedNotes ?? 0;
  const totalNotes     = notesData?.totalNotes   ?? 0;

  const notesSection = [
    `  Notes analysed: ${totalNotes} | Flagged: ${flaggedCount}`,
    symptoms.length > 0
      ? `  Mentioned symptoms: ${symptoms.join(', ')}`
      : '  No symptoms mentioned in notes.',
    riskIndicators.length > 0
      ? `  Risk language detected: ${riskIndicators.join(', ')}`
      : '  No risk language detected in notes.',
  ].join('\n');

  // ── Assembled prompt ──────────────────────────────────────────────────────────
  return `You are a clinical AI assistant helping a doctor quickly review a patient's health status.
You will be given structured, pre-computed clinical data. Your job is to write a concise, factual summary in plain clinical English.

STRICT RULES — MUST FOLLOW:
1. State risks and flags EXACTLY as provided. Do NOT invent, infer, or add new risk claims.
2. Do NOT make diagnostic statements (e.g. "the patient has diabetes"). Use descriptive language only (e.g. "elevated HbA1c noted").
3. Do NOT recommend treatments or medications.
4. Be concise — target 150–200 words total.
5. Structure your response using these four sections (use the exact headings):
   CURRENT STATUS:
   RECENT CHANGES:
   DETECTED RISKS:
   CLINICIAN REVIEW POINTS:

--- PATIENT DATA ---

RECENT CLINICAL EVENTS (last 10, newest first):
${timelineSection}

RULE-BASED RISK ASSESSMENT:
  Overall risk level: ${riskLevel} (score: ${riskScore})
  Risk flags:
${riskSection}

DOCTOR NOTES ANALYSIS:
${notesSection}

--- END OF PATIENT DATA ---

Write the summary now, following the four sections and the strict rules above.`;
};
