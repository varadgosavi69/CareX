// Appointment controllers — thin HTTP layer over appointment.service.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as appointmentService from '../services/appointment.service.js';

// POST /api/appointments (patient)
export const book = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.bookAppointment(req.user._id, req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Appointment booked',
    data: { appointment },
  });
});

// GET /api/appointments (role-aware)
export const list = asyncHandler(async (req, res) => {
  const { items, page, limit, total, totalPages } =
    await appointmentService.listAppointments(req.user, req.query);
  sendSuccess(res, {
    message: 'Appointments fetched',
    data: { appointments: items, pagination: { page, limit, total, totalPages } },
  });
});

// GET /api/appointments/:id
export const getById = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.getAppointmentById(req.user, req.params.id);
  sendSuccess(res, { message: 'Appointment fetched', data: { appointment } });
});

// PATCH /api/appointments/:id/cancel (patient)
export const cancel = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.cancelAppointment(req.user, req.params.id);
  sendSuccess(res, { message: 'Appointment cancelled', data: { appointment } });
});

// PATCH /api/appointments/:id/status (doctor/admin)
export const updateStatus = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.updateAppointmentStatus(
    req.user,
    req.params.id,
    req.body.status
  );
  sendSuccess(res, { message: `Appointment ${req.body.status}`, data: { appointment } });
});
