// Report controllers — thin HTTP layer over report.service.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as reportService from '../services/report.service.js';

// POST /api/reports (patient) — multipart upload
export const create = asyncHandler(async (req, res) => {
  const report = await reportService.createReport(req.user._id, req.file, req.body);
  sendSuccess(res, { statusCode: 201, message: 'Report uploaded', data: { report } });
});

// GET /api/reports (patient) — own reports
export const list = asyncHandler(async (req, res) => {
  const reports = await reportService.listReports(req.user._id);
  sendSuccess(res, { message: 'Reports fetched', data: { reports } });
});

// DELETE /api/reports/:id (patient)
export const remove = asyncHandler(async (req, res) => {
  await reportService.deleteReport(req.user._id, req.params.id);
  sendSuccess(res, { message: 'Report deleted' });
});
