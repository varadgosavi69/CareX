// Generic Zod validation middleware. Each validator is a Zod object schema that
// may contain `body`, `params`, and/or `query` sub-schemas. Parsed (and thus
// coerced/stripped) values replace the originals so controllers receive clean,
// trusted input. Validation failures become a 400 ApiError with field details.

import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';

export const validate = (schema) => (req, _res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    // Only overwrite the parts the schema actually validated.
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.params !== undefined) req.params = parsed.params;
    if (parsed.query !== undefined) req.query = parsed.query;

    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.').replace(/^(body|params|query)\.?/, ''),
        message: e.message,
      }));
      return next(ApiError.badRequest('Validation failed', errors));
    }
    return next(err);
  }
};

export default validate;
