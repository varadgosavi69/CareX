// Profile controllers — thin HTTP layer over profile.service.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as profileService from '../services/profile.service.js';

// GET /api/profile
export const get = asyncHandler(async (req, res) => {
  const { user, doctorProfile } = await profileService.getProfile(req.user._id, req.user.role);
  sendSuccess(res, { message: 'Profile fetched', data: { user, doctorProfile } });
});

// PUT /api/profile
export const update = asyncHandler(async (req, res) => {
  const user = await profileService.updateProfile(req.user._id, req.body);
  sendSuccess(res, { message: 'Profile updated', data: { user } });
});
