// Doctor routes.
// NOTE: the `/me` routes are declared BEFORE `/:id` so "me" is never captured
// as an :id parameter.

import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { ROLES } from '../utils/constants.js';
import {
  registerDoctorSchema,
  listDoctorsSchema,
  doctorIdSchema,
  updateStatusSchema,
  updateMeSchema,
} from '../validators/doctor.validator.js';
import * as doctorController from '../controllers/doctor.controller.js';
import * as ratingController from '../controllers/rating.controller.js';
import { doctorRatingsSchema } from '../validators/rating.validator.js';

const router = Router();

// Public
router.post('/register', validate(registerDoctorSchema), doctorController.register);
router.get('/', validate(listDoctorsSchema), doctorController.list);

// Doctor self-service (must come before "/:id")
router.get('/me', protect, authorize(ROLES.DOCTOR), doctorController.getMe);
router.patch(
  '/me',
  protect,
  authorize(ROLES.DOCTOR),
  validate(updateMeSchema),
  doctorController.updateMe
);

// Public single profile
router.get('/:id', validate(doctorIdSchema), doctorController.getById);

// Public list of a doctor's ratings
router.get('/:id/ratings', validate(doctorRatingsSchema), ratingController.listForDoctor);

// Admin approve/reject
router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.ADMIN),
  validate(updateStatusSchema),
  doctorController.updateStatus
);

export default router;
