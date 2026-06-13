// Zod schemas for doctor endpoints.

import { z } from 'zod';
import mongoose from 'mongoose';
import { SPECIALTIES, DOCTOR_STATUS, WEEKDAYS } from '../utils/constants.js';

// Reusable Mongo ObjectId validator.
const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id');

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');

const availabilityItem = z
  .object({
    day: z.enum(WEEKDAYS),
    startTime: timeString,
    endTime: timeString,
  })
  .refine((s) => s.startTime < s.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

// POST /api/doctors/register
export const registerDoctorSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    phone: z.string().trim().min(7).max(20).optional(),
    specialty: z.enum(SPECIALTIES),
    qualifications: z.string().trim().max(500).optional(),
    experienceYears: z.coerce.number().int().min(0).max(80).optional(),
    consultationFee: z.coerce.number().min(0).max(1_000_000).optional(),
    availability: z.array(availabilityItem).max(50).optional(),
  }),
});

// GET /api/doctors  (filters + pagination)
export const listDoctorsSchema = z.object({
  query: z.object({
    specialty: z.enum(SPECIALTIES).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

// GET /api/doctors/:id
export const doctorIdSchema = z.object({
  params: z.object({ id: objectId }),
});

// PATCH /api/doctors/:id/status  (admin approve/reject)
export const updateStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum([DOCTOR_STATUS.APPROVED, DOCTOR_STATUS.REJECTED]),
  }),
});

// PATCH /api/doctors/me  (doctor self-update)
export const updateMeSchema = z.object({
  body: z
    .object({
      availability: z.array(availabilityItem).max(50).optional(),
      consultationFee: z.coerce.number().min(0).max(1_000_000).optional(),
      qualifications: z.string().trim().max(500).optional(),
      experienceYears: z.coerce.number().int().min(0).max(80).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'Provide at least one field to update',
    }),
});
