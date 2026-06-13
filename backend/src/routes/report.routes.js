// Report routes. All patient-only. Upload runs multer (multipart) before
// validation so accompanying text fields are available on req.body.

import { Router } from 'express';

import { validate } from '../middlewares/validate.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { uploadReportFile } from '../middlewares/upload.middleware.js';
import { ROLES } from '../utils/constants.js';
import { createReportSchema, reportIdSchema } from '../validators/report.validator.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.post(
  '/',
  protect,
  authorize(ROLES.PATIENT),
  uploadReportFile,
  validate(createReportSchema),
  reportController.create
);

router.get('/', protect, authorize(ROLES.PATIENT), reportController.list);

router.delete(
  '/:id',
  protect,
  authorize(ROLES.PATIENT),
  validate(reportIdSchema),
  reportController.remove
);

export default router;
