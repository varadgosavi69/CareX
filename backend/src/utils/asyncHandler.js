// Wraps an async Express handler so any rejected promise is forwarded to the
// global error middleware via next(), instead of crashing the request.
// Usage: router.get('/', asyncHandler(async (req, res) => { ... }))

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
