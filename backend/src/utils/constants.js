// Shared enums / constant values used across models, validators, and services.
// Centralized so the same allowed values are referenced everywhere (DRY).

export const ROLES = Object.freeze({
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  ADMIN: 'admin',
});
export const ROLE_VALUES = Object.values(ROLES);

// Common medical specialties offered in the directory.
export const SPECIALTIES = Object.freeze([
  'General Physician',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'Gynecology',
  'Neurology',
  'Psychiatry',
  'ENT',
  'Ophthalmology',
  'Dentistry',
  'Gastroenterology',
  'Urology',
  'Oncology',
  'Endocrinology',
]);

export const DOCTOR_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});
export const DOCTOR_STATUS_VALUES = Object.values(DOCTOR_STATUS);

export const APPOINTMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
});
export const APPOINTMENT_STATUS_VALUES = Object.values(APPOINTMENT_STATUS);

// Whether the consultation fee for an appointment has been paid.
export const PAYMENT_STATUS = Object.freeze({
  UNPAID: 'unpaid',
  PAID: 'paid',
});
export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

// Lifecycle of a Razorpay payment record.
export const PAYMENT_TXN_STATUS = Object.freeze({
  CREATED: 'created',
  PAID: 'paid',
  FAILED: 'failed',
});
export const PAYMENT_TXN_STATUS_VALUES = Object.values(PAYMENT_TXN_STATUS);

// Stable, machine-readable error codes returned alongside every error response
// so the frontend can branch on a code instead of parsing human messages.
// Keyed by HTTP status; keep this the single source of truth for error codes.
export const ERROR_CODES = Object.freeze({
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
});

// Resolve a status code to its stable error code, with a sensible fallback.
export const errorCodeFor = (statusCode) =>
  ERROR_CODES[statusCode] || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR');

// Days of the week used for doctor availability slots.
export const WEEKDAYS = Object.freeze([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);
