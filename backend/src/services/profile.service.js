// Profile business logic. The current user's account + embedded medical profile,
// plus their doctor profile when applicable. Only the owner ever reads/writes
// these fields (routes are auth-protected and scoped to req.user). The medical
// fields are sensitive health data: never logged, never exposed publicly.

import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../utils/constants.js';

// patientProfile fields that can be updated (excluding the nested contact).
const PROFILE_FIELDS = [
  'dateOfBirth',
  'gender',
  'bloodGroup',
  'height',
  'weight',
  'allergies',
  'chronicConditions',
  'address',
];

/**
 * Get the current user's profile (incl. embedded patientProfile) and, for
 * doctors, their doctor profile. password/refreshToken are select:false so they
 * never come back here.
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
 * Update the current user's name/phone and deep-merge medical fields into
 * patientProfile (unspecified nested fields are preserved, not wiped). Email and
 * role are never touched here.
 */
export const updateProfile = async (userId, updates) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  // Account fields.
  if (updates.name !== undefined) user.name = updates.name;
  if (updates.phone !== undefined) user.phone = updates.phone;

  // Medical fields — start from the existing profile so we only overwrite the
  // keys that were actually provided.
  const current = user.patientProfile ? user.patientProfile.toObject() : {};
  const nextProfile = { ...current };

  let touchedProfile = false;
  for (const key of PROFILE_FIELDS) {
    if (updates[key] !== undefined) {
      nextProfile[key] = updates[key];
      touchedProfile = true;
    }
  }

  // Deep-merge the nested emergency contact so updating one part (e.g. phone)
  // doesn't clear the others.
  if (updates.emergencyContact !== undefined) {
    nextProfile.emergencyContact = {
      ...(current.emergencyContact || {}),
      ...updates.emergencyContact,
    };
    touchedProfile = true;
  }

  if (touchedProfile) user.patientProfile = nextProfile;

  await user.save();
  return user;
};
