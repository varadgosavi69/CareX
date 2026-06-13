// Zod schema for profile updates. Email and role are intentionally NOT editable
// here (identity/authorization must not be self-changed).

import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      phone: z.string().trim().min(7).max(20).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'Provide at least one field to update',
    }),
});
