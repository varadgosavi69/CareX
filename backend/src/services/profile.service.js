// Profile business logic. The current user's account, plus their doctor profile
// when applicable. Only name/phone are updatable.

import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../utils/constants.js';

/**
 * Get the current user's profile (and their doctor profile if they're a doctor).
 */
export const getProfile = async (userId, role) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  let doctorProfile = null;
  if (role === ROLES.DOCTOR) {
    doctorProfile = await Doctor.findOne({ user: userId });
  }

  return { user, doctorProfile };
};

/**
 * Update the current user's name/phone. Email and role are never touched here.
 */
export const updateProfile = async (userId, { name, phone }) => {
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};
