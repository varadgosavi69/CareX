// Rating controllers — thin HTTP layer over rating.service.

import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as ratingService from '../services/rating.service.js';

// POST /api/ratings (patient)
export const create = asyncHandler(async (req, res) => {
  const rating = await ratingService.createRating(req.user, req.body);
  sendSuccess(res, { statusCode: 201, message: 'Rating submitted', data: { rating } });
});

// GET /api/doctors/:id/ratings (public)
export const listForDoctor = asyncHandler(async (req, res) => {
  const { items, avgRating, ratingCount, page, limit, total, totalPages } =
    await ratingService.listDoctorRatings(req.params.id, req.query);
  sendSuccess(res, {
    message: 'Ratings fetched',
    data: {
      ratings: items,
      avgRating,
      ratingCount,
      pagination: { page, limit, total, totalPages },
    },
  });
});
