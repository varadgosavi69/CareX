// Barrel export for all Mongoose models. Importing from here also guarantees
// every schema is registered with Mongoose before use.

export { default as User } from './User.js';
export { default as Doctor } from './Doctor.js';
export { default as Appointment } from './Appointment.js';
export { default as Prescription } from './Prescription.js';
export { default as Report } from './Report.js';
export { default as Rating } from './Rating.js';
export { default as Payment } from './Payment.js';
