// Custom operational error. Anything thrown as an `ApiError` is a *known*,
// expected failure (bad input, missing resource, etc.) and is rendered to the
// client with its status code. Unknown errors are treated as 500s.

class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code (e.g. 400, 401, 404, 409).
   * @param {string} message    Human-readable message safe to send to clients.
   * @param {Array}  [errors]   Optional array of field-level error details.
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    // Marks this error as a deliberate, expected failure (vs. a bug).
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  // Convenience factory helpers for common cases.
  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthenticated') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }
}

export default ApiError;
