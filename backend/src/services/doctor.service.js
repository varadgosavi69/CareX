// Doctor directory business logic: registration, public listing with filters +
// pagination, single profile, admin approval, and doctor self-service.

import mongoose from 'mongoose';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import ApiError from '../utils/ApiError.js';
import { ROLES, DOCTOR_STATUS } from '../utils/constants.js';

// Fields safe to expose for a doctor's linked user account in public responses.
const PUBLIC_USER_FIELDS = 'name';
const OWNER_USER_FIELDS = 'name email phone role';

// Escape user input before using it in a regex (prevents ReDoS / injection).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Register a new doctor: creates a User(role=doctor) and a pending Doctor
 * profile. Public endpoint — the account stays hidden until an admin approves.
 */
export const registerDoctor = async ({
  name,
  email,
  password,
  phone,
  specialty,
  qualifications,
  experienceYears,
  consultationFee,
  availability,
}) => {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('Email is already registered');

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: ROLES.DOCTOR,
  });

  try {
    const doctor = await Doctor.create({
      user: user._id,
      specialty,
      qualifications,
      experienceYears,
      consultationFee,
      availability,
      status: DOCTOR_STATUS.PENDING,
    });

    return Doctor.findById(doctor._id).populate('user', OWNER_USER_FIELDS);
  } catch (err) {
    // Roll back the orphaned user if the doctor profile couldn't be created.
    await User.findByIdAndDelete(user._id);
    throw err;
  }
};

/**
 * List APPROVED doctors with optional specialty/search filters and pagination.
 * Uses an aggregation so we can search across the linked user's name as well.
 */
export const listApprovedDoctors = async ({ specialty, search, page, limit }) => {
  const match = { status: DOCTOR_STATUS.APPROVED };
  if (specialty) match.specialty = specialty;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
  ];

  // Free-text search across doctor name, specialty, and qualifications.
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    pipeline.push({
      $match: {
        $or: [
          { 'user.name': rx },
          { specialty: rx },
          { qualifications: rx },
        ],
      },
    });
  }

  const skip = (page - 1) * limit;

  pipeline.push({
    $facet: {
      // Total count for pagination metadata.
      meta: [{ $count: 'total' }],
      // The page of results, projecting only safe public fields.
      items: [
        { $sort: { avgRating: -1, ratingCount: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            specialty: 1,
            qualifications: 1,
            experienceYears: 1,
            consultationFee: 1,
            availability: 1,
            avgRating: 1,
            ratingCount: 1,
            status: 1,
            createdAt: 1,
            'user._id': 1,
            'user.name': 1,
          },
        },
      ],
    },
  });

  const [result] = await Doctor.aggregate(pipeline);
  const total = result?.meta?.[0]?.total ?? 0;

  return {
    items: result?.items ?? [],
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Fetch a single APPROVED doctor's public profile (includes avgRating).
 */
export const getApprovedDoctorById = async (id) => {
  const doctor = await Doctor.findOne({
    _id: id,
    status: DOCTOR_STATUS.APPROVED,
  }).populate('user', PUBLIC_USER_FIELDS);

  if (!doctor) throw ApiError.notFound('Doctor not found');
  return doctor;
};

/**
 * Admin approves or rejects a doctor.
 */
export const updateDoctorStatus = async (id, status) => {
  const doctor = await Doctor.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  ).populate('user', OWNER_USER_FIELDS);

  if (!doctor) throw ApiError.notFound('Doctor not found');
  return doctor;
};

/**
 * A doctor's own profile (any status), looked up by their user id.
 */
export const getOwnProfile = async (userId) => {
  const doctor = await Doctor.findOne({ user: userId }).populate(
    'user',
    OWNER_USER_FIELDS
  );
  if (!doctor) throw ApiError.notFound('Doctor profile not found');
  return doctor;
};

/**
 * A doctor updates their own availability/fee/qualifications/experience.
 * Approval status is NOT self-editable here.
 */
export const updateOwnProfile = async (userId, updates) => {
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw ApiError.notFound('Doctor profile not found');

  const allowed = ['availability', 'consultationFee', 'qualifications', 'experienceYears'];
  for (const key of allowed) {
    if (updates[key] !== undefined) doctor[key] = updates[key];
  }

  await doctor.save();
  return Doctor.findById(doctor._id).populate('user', OWNER_USER_FIELDS);
};

// Exported for potential reuse/testing.
export const _internal = { escapeRegex, ObjectId: mongoose.Types.ObjectId };
