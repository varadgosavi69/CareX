// Payment business logic (Razorpay). The authoritative amount is ALWAYS the
// consultation fee snapshot stored on the appointment — never a client-sent
// value. Every order and verification attempt is recorded in the Payment model
// for auditability, and the signature is verified server-side before any
// appointment is marked paid.

import crypto from 'crypto';

import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import ApiError from '../utils/ApiError.js';
import razorpay, {
  isRazorpayConfigured,
  razorpayKeyId,
  razorpayKeySecret,
} from '../config/razorpay.js';
import {
  PAYMENT_STATUS,
  PAYMENT_TXN_STATUS,
  APPOINTMENT_STATUS,
} from '../utils/constants.js';

// Razorpay deals in the smallest currency unit (paise for INR).
const toPaise = (rupees) => Math.round(rupees * 100);

const ensureConfigured = () => {
  if (!isRazorpayConfigured) {
    throw new ApiError(503, 'Payments are not configured on this server');
  }
};

/**
 * Create a Razorpay order for a patient's own appointment.
 * Reads the amount from the appointment (DB), never from the client.
 * Returns the order details the frontend needs to open Razorpay checkout.
 */
export const createOrder = async (patientId, appointmentId) => {
  ensureConfigured();

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');

  // Ownership: a patient may only pay for their own appointment.
  if (!appointment.patient.equals(patientId)) {
    throw ApiError.forbidden('You can only pay for your own appointments');
  }

  // Don't allow paying for an appointment that won't happen.
  const unpayable = [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED];
  if (unpayable.includes(appointment.status)) {
    throw ApiError.badRequest(`A ${appointment.status} appointment cannot be paid for`);
  }

  if (appointment.paymentStatus === PAYMENT_STATUS.PAID) {
    throw ApiError.conflict('This appointment is already paid');
  }

  const amount = appointment.consultationFee;
  if (!amount || amount <= 0) {
    throw ApiError.badRequest('This appointment has no consultation fee due');
  }

  // `receipt` is capped at 40 chars by Razorpay; an appointment id fits.
  const order = await razorpay.orders.create({
    amount: toPaise(amount),
    currency: 'INR',
    receipt: `appt_${appointment._id}`,
    notes: { appointmentId: String(appointment._id), patientId: String(patientId) },
  });

  // Record the attempt so every order is auditable.
  await Payment.create({
    appointment: appointment._id,
    patient: patientId,
    amount,
    currency: 'INR',
    razorpayOrderId: order.id,
    status: PAYMENT_TXN_STATUS.CREATED,
  });

  return {
    orderId: order.id,
    amount: order.amount, // in paise, for the checkout widget
    currency: order.currency,
    keyId: razorpayKeyId, // public key the frontend needs to open checkout
    appointmentId: appointment._id,
  };
};

/**
 * Verify a completed Razorpay checkout. Recomputes the HMAC signature
 * server-side; only on a match is the Payment marked paid and the appointment's
 * paymentStatus flipped to "paid". A bad signature records a failed attempt.
 */
export const verifyPayment = async (
  patientId,
  { razorpayOrderId, razorpayPaymentId, razorpaySignature }
) => {
  ensureConfigured();

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) throw ApiError.notFound('Payment order not found');

  // Ownership: the order must belong to the patient verifying it.
  if (!payment.patient.equals(patientId)) {
    throw ApiError.forbidden('You can only verify your own payments');
  }

  // Idempotency: a re-submitted, already-verified order is a no-op success.
  if (payment.status === PAYMENT_TXN_STATUS.PAID) {
    return payment;
  }

  // Razorpay signs `${order_id}|${payment_id}` with the key secret (HMAC-SHA256).
  const expectedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const provided = Buffer.from(razorpaySignature);
  const expected = Buffer.from(expectedSignature);
  const isValid =
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected);

  if (!isValid) {
    payment.status = PAYMENT_TXN_STATUS.FAILED;
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    await payment.save();
    throw ApiError.badRequest('Payment verification failed');
  }

  // Signature valid — record success and mark the appointment paid.
  payment.status = PAYMENT_TXN_STATUS.PAID;
  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  await payment.save();

  await Appointment.findByIdAndUpdate(payment.appointment, {
    paymentStatus: PAYMENT_STATUS.PAID,
  });

  return payment;
};
