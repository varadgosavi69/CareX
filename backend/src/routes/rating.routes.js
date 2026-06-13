// Rating routes — POST /api/ratings. (The public per-doctor list lives under
// the doctors router at GET /api/doctors/:id/ratings.)

import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { ROLES } from '../utils/constants.js';
import { createRatingSchema } from '../validators/rating.validator.js';
import * as ratingController from '../controllers/rating.controller.js';

const router = Router();

router.post(
  '/',
  protect,
  authorize(ROLES.PATIENT),
  validate(createRatingSchema),
  ratingController.create
);

export default router;
