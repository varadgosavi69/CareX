// Payment controllers — thin HTTP layer over payment.service.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as paymentService from '../services/payment.service.js';

// POST /api/payments/order (patient) — create a Razorpay order for an appointment.
export const createOrder = asyncHandler(async (req, res) => {
  const order = await paymentService.createOrder(req.user._id, req.body.appointmentId);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Payment order created',
    data: { order },
  });
});

// POST /api/payments/verify (patient) — verify a completed checkout.
export const verifyPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.verifyPayment(req.user._id, req.body);
  sendSuccess(res, {
    message: 'Payment verified',
    data: { payment },
  });
});
