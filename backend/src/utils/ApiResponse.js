// Standard success-response shape for every endpoint: { success, message, data }.
// Use `sendSuccess(res, ...)` from controllers to keep responses uniform.

class ApiResponse {
  /**
   * @param {number} statusCode HTTP status code (2xx).
   * @param {string} message    Short human-readable message.
   * @param {*}      [data]     Payload (object, array, or null).
   */
  constructor(statusCode, message, data = null) {
    this.statusCode = statusCode;
    this.body = {
      success: statusCode < 400,
      message,
      data,
    };
  }
}

/**
 * Send a standardized success response.
 * @param {import('express').Response} res
 * @param {object} [opts]
 * @param {number} [opts.statusCode=200]
 * @param {string} [opts.message='Success']
 * @param {*}      [opts.data=null]
 */
export const sendSuccess = (
  res,
  { statusCode = 200, message = 'Success', data = null } = {}
) => {
  const response = new ApiResponse(statusCode, message, data);
  return res.status(response.statusCode).json(response.body);
};

export default ApiResponse;
