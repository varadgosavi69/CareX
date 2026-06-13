// Health-check route. Used by load balancers / uptime checks and to verify the
// server boots correctly.

import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';

const router = Router();

// GET /api/health
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      statusCode: 200,
      message: 'CareX API healthy',
      data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
    });
  })
);

export default router;
