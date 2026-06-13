// Multer middleware for medical report uploads. Files are held in memory and
// streamed to Cloudinary by the service layer. Only PDF/JPG/PNG up to 5 MB.

import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  return cb(new ApiError(400, 'Only PDF, JPG, and PNG files are allowed'), false);
};

// Expects a single file under the form field "file".
export const uploadReportFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('file');
