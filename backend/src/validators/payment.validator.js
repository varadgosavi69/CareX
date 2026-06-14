// Zod schemas for payment endpoints.

import { z } from 'zod';
import mongoose from 'mongoose';

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id');

// POST /api/payments/order — create a Razorpay order for an appointment.
export const createOrderSchema = z.object({
  body: z.object({
    appointmentId: objectId,
  }),
});

// POST /api/payments/verify — verify a completed Razorpay checkout.
// These three fields are returned by the Razorpay checkout on the client.
export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().trim().min(1, 'razorpayOrderId is required'),
    razorpayPaymentId: z.string().trim().min(1, 'razorpayPaymentId is required'),
    razorpaySignature: z.string().trim().min(1, 'razorpaySignature is required'),
  }),
});
