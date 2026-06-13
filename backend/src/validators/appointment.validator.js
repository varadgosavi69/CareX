// Zod schemas for appointment endpoints.

import { z } from 'zod';
import mongoose from 'mongoose';
import { APPOINTMENT_STATUS } from '../utils/constants.js';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id');

// "HH:mm-HH:mm" slot label, e.g. "10:00-10:30".
const slot = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/,
    'Slot must be in HH:mm-HH:mm format'
  )
  .refine((s) => {
    const [start, end] = s.split('-');
    return start < end;
  }, 'Slot start time must be before end time');

const location = z
  .object({
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    address: z.string().trim().max(300).optional(),
  })
  .optional();

// POST /api/appointments
export const createAppointmentSchema = z.object({
  body: z.object({
    doctorId: objectId,
    scheduledAt: z.coerce
      .date({ invalid_type_error: 'scheduledAt must be a valid date/time' })
      .refine((d) => d.getTime() > Date.now(), 'scheduledAt must be in the future'),
    slot,
    reason: z.string().trim().max(1000).optional(),
    location,
  }),
});

// GET /api/appointments
export const listAppointmentsSchema = z.object({
  query: z.object({
    status: z.enum(Object.values(APPOINTMENT_STATUS)).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

// :id param (GET single, cancel)
export const appointmentIdSchema = z.object({
  params: z.object({ id: objectId }),
});

// PATCH /api/appointments/:id/status  (doctor/admin)
export const updateStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum([
      APPOINTMENT_STATUS.APPROVED,
      APPOINTMENT_STATUS.REJECTED,
      APPOINTMENT_STATUS.COMPLETED,
    ]),
  }),
});
