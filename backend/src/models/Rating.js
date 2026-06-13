// Rating — a patient's 1–5 star review of a doctor, tied to one completed
// appointment (one rating per appointment). Whenever ratings change, the
// doctor's avgRating and ratingCount are recomputed automatically.

import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true, // at most one rating per appointment
    },
    stars: {
      type: Number,
      required: [true, 'Star rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
    },
    review: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

// Recompute and persist a doctor's aggregate rating from all their ratings.
ratingSchema.statics.recalcForDoctor = async function recalcForDoctor(doctorId) {
  const [stats] = await this.aggregate([
    { $match: { doctor: new mongoose.Types.ObjectId(doctorId) } },
    {
      $group: {
        _id: '$doctor',
        avg: { $avg: '$stars' },
        count: { $sum: 1 },
      },
    },
  ]);

  const Doctor = mongoose.model('Doctor');
  await Doctor.findByIdAndUpdate(doctorId, {
    // Round to one decimal place; reset to 0 when no ratings remain.
    avgRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
    ratingCount: stats ? stats.count : 0,
  });
};

// Recompute after a new rating is saved.
ratingSchema.post('save', function afterSave(doc) {
  return doc.constructor.recalcForDoctor(doc.doctor);
});

// Recompute after an update or delete via query helpers
// (findByIdAndUpdate / findOneAndUpdate / findOneAndDelete all fire these).
ratingSchema.post('findOneAndUpdate', function afterUpdate(doc) {
  if (doc) return doc.constructor.recalcForDoctor(doc.doctor);
  return undefined;
});

ratingSchema.post('findOneAndDelete', function afterDelete(doc) {
  if (doc) return doc.constructor.recalcForDoctor(doc.doctor);
  return undefined;
});

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
