// Zod schemas for vital endpoints.
// All schemas follow CareX's {body, params, query} envelope so the generic
// `validate` middleware can parse/coerce them without extra wiring.

import { z } from 'zod';
import mongoose from 'mongoose';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid ObjectId');

// ── Shared value shapes ────────────────────────────────────────────────────────

const bloodPressureValue = z.object({
  systolic: z
    .number({ required_error: 'value.systolic is required for BloodPressure' })
    .positive('systolic must be positive'),
  diastolic: z
    .number({ required_error: 'value.diastolic is required for BloodPressure' })
    .positive('diastolic must be positive'),
});

const singleValue = z.object({
  single: z
    .number({ required_error: 'value.single is required' })
    .positive('value.single must be positive'),
});

// Discriminated value: type drives which shape is required.
// Zod discriminated unions require a literal discriminant; we use a superRefine
// on the body instead so we can cross-reference `type` and `value` together.
const vitalBodyBase = z.object({
  patientId: objectId,
  type: z.enum(
    ['BloodPressure', 'HeartRate', 'Temperature', 'SpO2', 'BloodGlucose'],
    { required_error: 'type is required' }
  ),
  // value is validated contextually in the superRefine below
  value: z.record(z.unknown()),
  unit: z.string().trim().min(1, 'unit is required').max(20),
  recordedAt: z
    .string()
    .datetime({ message: 'recordedAt must be a valid ISO 8601 date-time string' })
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

const vitalBody = vitalBodyBase.superRefine((data, ctx) => {
  if (data.type === 'BloodPressure') {
    const result = bloodPressureValue.safeParse(data.value);
    if (!result.success) {
      result.error.errors.forEach((e) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value', ...e.path], message: e.message })
      );
    }
  } else {
    const result = singleValue.safeParse(data.value);
    if (!result.success) {
      result.error.errors.forEach((e) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value', ...e.path], message: e.message })
      );
    }
  }
});

// ── Exported schemas ───────────────────────────────────────────────────────────

// POST /api/vitals
export const addVitalSchema = z.object({
  body: vitalBody,
});

// GET /api/vitals/:patientId
export const getVitalsSchema = z.object({
  params: z.object({ patientId: objectId }),
  query: z
    .object({
      type: z
        .enum(['BloodPressure', 'HeartRate', 'Temperature', 'SpO2', 'BloodGlucose'])
        .optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z
        .string()
        .regex(/^\d+$/, 'limit must be a positive integer')
        .optional(),
    })
    .optional(),
});
