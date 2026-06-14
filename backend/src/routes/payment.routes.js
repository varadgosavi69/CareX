// Payment routes. All require authentication; only patients create and verify
// payments for their own appointments.

import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { ROLES } from '../utils/constants.js';
import {
  createOrderSchema,
  verifyPaymentSchema,
} from '../validators/payment.validator.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

router.post(
  '/order',
  protect,
  authorize(ROLES.PATIENT),
  validate(createOrderSchema),
  paymentController.createOrder
);

router.post(
  '/verify',
  protect,
  authorize(ROLES.PATIENT),
  validate(verifyPaymentSchema),
  paymentController.verifyPayment
);

export default router;
