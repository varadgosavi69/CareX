// Appointment routes. All require authentication; specific actions are further
// restricted by role.

import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { ROLES } from '../utils/constants.js';
import {
  createAppointmentSchema,
  listAppointmentsSchema,
  appointmentIdSchema,
  updateStatusSchema,
} from '../validators/appointment.validator.js';
import {
  createPrescriptionSchema,
  prescriptionParamsSchema,
} from '../validators/prescription.validator.js';
import * as appointmentController from '../controllers/appointment.controller.js';
import * as prescriptionController from '../controllers/prescription.controller.js';

const router = Router();

router.post(
  '/',
  protect,
  authorize(ROLES.PATIENT),
  validate(createAppointmentSchema),
  appointmentController.book
);

router.get('/', protect, validate(listAppointmentsSchema), appointmentController.list);

router.get('/:id', protect, validate(appointmentIdSchema), appointmentController.getById);

router.patch(
  '/:id/cancel',
  protect,
  authorize(ROLES.PATIENT),
  validate(appointmentIdSchema),
  appointmentController.cancel
);

router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  validate(updateStatusSchema),
  appointmentController.updateStatus
);

// ── Prescriptions (nested under an appointment) ──
router.post(
  '/:id/prescription',
  protect,
  authorize(ROLES.DOCTOR),
  validate(createPrescriptionSchema),
  prescriptionController.create
);
router.get(
  '/:id/prescription',
  protect,
  validate(prescriptionParamsSchema),
  prescriptionController.get
);

export default router;
