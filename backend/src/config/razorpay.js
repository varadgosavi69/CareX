// Razorpay client. Configured from env; a flag tells callers whether real
// credentials are present so payment endpoints can fail fast with a clear
// message instead of throwing an opaque SDK error.

import Razorpay from 'razorpay';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export const isRazorpayConfigured = Boolean(keyId && keySecret);

// The public key id is safe to hand to the frontend (it is needed to open the
// Razorpay checkout); the secret never leaves the server.
export const razorpayKeyId = keyId;
export const razorpayKeySecret = keySecret;

// Only instantiate when configured — the SDK throws if given empty credentials.
const razorpay = isRazorpayConfigured
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

export default razorpay;
