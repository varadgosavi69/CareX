// Zod schemas for rating endpoints.

import { z } from 'zod';
import mongoose from 'mongoose';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id');

// POST /api/ratings
export const createRatingSchema = z.object({
  body: z.object({
    appointmentId: objectId,
    stars: z.coerce.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
    review: z.string().trim().max(1000).optional(),
  }),
});

// GET /api/doctors/:id/ratings
export const doctorRatingsSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});
