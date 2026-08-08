// Zod schemas for lab-result endpoints.
// Follow CareX's {body, params, query} envelope for the generic validate middleware.

import { z } from 'zod';
import mongoose from 'mongoose';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid ObjectId');

// ── POST /api/lab-results ─────────────────────────────────────────────────────
export const addLabResultSchema = z.object({
  body: z.object({
    patientId: objectId,
    testName: z
      .string({ required_error: 'testName is required' })
      .trim()
      .min(1, 'testName cannot be empty')
      .max(200, 'testName cannot exceed 200 characters'),
    value: z.number({ required_error: 'value is required' }),
    unit: z
      .string({ required_error: 'unit is required' })
      .trim()
      .min(1, 'unit cannot be empty')
      .max(50, 'unit cannot exceed 50 characters'),
    referenceRange: z.string().trim().max(100).optional(),
    recordedAt: z
      .string()
      .datetime({ message: 'recordedAt must be a valid ISO 8601 date-time string' })
      .optional(),
    labName: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
});

// ── GET /api/lab-results/:patientId ──────────────────────────────────────────
export const getLabResultsSchema = z.object({
  params: z.object({ patientId: objectId }),
  query: z
    .object({
      testName: z.string().trim().max(200).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z
        .string()
        .regex(/^\d+$/, 'limit must be a positive integer')
        .optional(),
    })
    .optional(),
});
