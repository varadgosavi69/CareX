// Payment API calls (Razorpay).

import api from '../client';

// Create a Razorpay order for a pending appointment. Returns { orderId, amount,
// currency, keyId, appointmentId } for opening the Razorpay checkout.
export const createOrder = async (appointmentId) => {
  const { data } = await api.post('/payments/order', { appointmentId });
  return data.data.order;
};

// Verify the checkout result server-side; marks the appointment paid on success.
export const verify = async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const { data } = await api.post('/payments/verify', {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  return data.data.payment;
};
