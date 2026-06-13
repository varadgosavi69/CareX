// Profile routes — current user's own profile (any authenticated role).

import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/auth.middleware.js';
import { updateProfileSchema } from '../validators/profile.validator.js';
import * as profileController from '../controllers/profile.controller.js';

const router = Router();

router.get('/', protect, profileController.get);
router.put('/', protect, validate(updateProfileSchema), profileController.update);

export default router;
