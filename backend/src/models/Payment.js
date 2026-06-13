// Payment — a Razorpay transaction record for an appointment's consultation
// fee. Every order/verification attempt is stored here for auditability.
// The authoritative amount is always read from the DB, never the client.

import mongoose from 'mongoose';
import { PAYMENT_TXN_STATUS, PAYMENT_TXN_STATUS_VALUES } from '../utils/constants.js';

const paymentSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    razorpayOrderId: {
      type: String,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    status: {
      type: String,
      enum: PAYMENT_TXN_STATUS_VALUES,
      default: PAYMENT_TXN_STATUS.CREATED,
    },
  },
  { timestamps: true }
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
