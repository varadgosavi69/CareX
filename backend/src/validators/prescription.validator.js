// Zod schemas for prescription endpoints (nested under an appointment).

import { z } from 'zod';
import mongoose from 'mongoose';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id');

const medicine = z.object({
  name: z.string().trim().min(1, 'Medicine name is required').max(200),
  dosage: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(100).optional(),
  duration: z.string().trim().max(100).optional(),
});

// POST /api/appointments/:id/prescription
export const createPrescriptionSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    medicines: z.array(medicine).min(1, 'At least one medicine is required').max(50),
    notes: z.string().trim().max(2000).optional(),
  }),
});

// GET /api/appointments/:id/prescription
export const prescriptionParamsSchema = z.object({
  params: z.object({ id: objectId }),
});
