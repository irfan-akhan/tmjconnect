import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * validate(schema, target?) — Middleware factory for request validation.
 *
 * Pipes `req[target]` through Zod's `.parse()`, replacing the original with the
 * parsed (and possibly transformed) value. Free-text fields are sanitised inside
 * the schemas themselves via the `freeText` / `optionalFreeText` helpers exported
 * from `@tmjconnect/shared` — there is no separate sanitisation pass here.
 *
 * Zod parse errors become ZodError instances that bubble to the global error handler,
 * which maps them to 400 VALIDATION_ERROR responses with per-field details.
 *
 * @param schema - Zod schema to validate against
 * @param target - 'body' (default), 'query', or 'params'
 */
export function validate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[target] = schema.parse(req[target]) as typeof req[typeof target];
      next();
    } catch (err) {
      next(err);
    }
  };
}
