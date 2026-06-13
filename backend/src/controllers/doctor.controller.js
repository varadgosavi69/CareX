// Doctor controllers — thin HTTP layer over doctor.service.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as doctorService from '../services/doctor.service.js';

// POST /api/doctors/register (public)
export const register = asyncHandler(async (req, res) => {
  const doctor = await doctorService.registerDoctor(req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Doctor registration submitted and pending approval',
    data: { doctor },
  });
});

// GET /api/doctors (public) — approved doctors, filtered + paginated
export const list = asyncHandler(async (req, res) => {
  const { items, page, limit, total, totalPages } =
    await doctorService.listApprovedDoctors(req.query);
  sendSuccess(res, {
    message: 'Doctors fetched',
    data: { doctors: items, pagination: { page, limit, total, totalPages } },
  });
});

// GET /api/doctors/me (doctor) — own profile
export const getMe = asyncHandler(async (req, res) => {
  const doctor = await doctorService.getOwnProfile(req.user._id);
  sendSuccess(res, { message: 'Doctor profile fetched', data: { doctor } });
});

// PATCH /api/doctors/me (doctor) — update own profile
export const updateMe = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateOwnProfile(req.user._id, req.body);
  sendSuccess(res, { message: 'Doctor profile updated', data: { doctor } });
});

// GET /api/doctors/:id (public) — single approved doctor
export const getById = asyncHandler(async (req, res) => {
  const doctor = await doctorService.getApprovedDoctorById(req.params.id);
  sendSuccess(res, { message: 'Doctor fetched', data: { doctor } });
});

// PATCH /api/doctors/:id/status (admin) — approve/reject
export const updateStatus = asyncHandler(async (req, res) => {
  const doctor = await doctorService.updateDoctorStatus(req.params.id, req.body.status);
  sendSuccess(res, { message: `Doctor ${req.body.status}`, data: { doctor } });
});
