// Zod schema for profile updates. Covers the user's name/phone plus every
// embedded patientProfile field. Email and role are intentionally NOT editable
// here (identity/authorization must not be self-changed). Unknown fields are
// rejected (.strict()) so typos/garbage never reach the database.

import { z } from 'zod';
import { GENDERS, BLOOD_GROUPS } from '../utils/constants.js';

// 7–20 chars: digits, spaces, and + - ( ) separators.
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number');

const emergencyContact = z
  .object({
    name: z.string().trim().max(100).optional(),
    phone: phone.optional(),
    relation: z.string().trim().max(50).optional(),
  })
  .strict();

export const updateProfileSchema = z.object({
  body: z
    .object({
      // User account fields.
      name: z.string().trim().min(2).max(100).optional(),
      phone: phone.optional(),
      // Embedded patientProfile fields.
      dateOfBirth: z.coerce.date().optional(),
      gender: z.enum(GENDERS).optional(),
      bloodGroup: z.enum(BLOOD_GROUPS).optional(),
      height: z.coerce.number().min(0).max(300).optional(), // cm
      weight: z.coerce.number().min(0).max(700).optional(), // kg
      allergies: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
      chronicConditions: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
      address: z.string().trim().max(300).optional(),
      emergencyContact: emergencyContact.optional(),
    })
    .strict()
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'Provide at least one field to update',
    }),
});
