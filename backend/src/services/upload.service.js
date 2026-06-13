// Thin wrapper around Cloudinary upload/delete. Uploads stream an in-memory
// buffer (from multer) straight to Cloudinary — no temp files on disk.

import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';

/**
 * Upload a file buffer to Cloudinary.
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string }>}
 */
export const uploadToCloudinary = (buffer, { folder = 'carex/reports' } = {}) => {
  if (!isCloudinaryConfigured) {
    throw new ApiError(500, 'File uploads are not configured on the server');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary by its public ID. Best-effort: Cloudinary's
 * `destroy` doesn't throw for a missing asset, it returns { result: 'not found' }.
 */
export const deleteFromCloudinary = (publicId, { resourceType = 'image' } = {}) => {
  if (!isCloudinaryConfigured || !publicId) return Promise.resolve({ result: 'skipped' });
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
