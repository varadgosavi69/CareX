// Catches any request that didn't match a route and forwards a 404 ApiError
// to the global error handler.

import ApiError from '../utils/ApiError.js';

const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFound;
