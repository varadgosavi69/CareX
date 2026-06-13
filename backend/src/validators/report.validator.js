// Zod schemas for report endpoints. The file itself is handled by multer; here
// we only validate accompanying fields and the :id param.

import { z } from 'zod';
import mongoose from 'mongoose';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id');

// POST /api/reports  (multipart: file + optional appointmentId text field)
export const createReportSchema = z.object({
  body: z.object({
    appointmentId: objectId.optional(),
  }),
});

// DELETE /api/reports/:id
export const reportIdSchema = z.object({
  params: z.object({ id: objectId }),
});
