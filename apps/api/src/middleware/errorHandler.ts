import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../config/logger';
import { ZodError } from 'zod';
import { Sentry } from '../config/sentry';

/**
 * Application-level error class. Route handlers throw this to signal
 * expected error conditions (e.g. 404 Not Found, 409 Conflict).
 * The global error handler maps it to a safe API error response.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    // Restore prototype chain for instanceof checks after TypeScript compilation.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Common error constructors ────────────────────────────────────────────────────

export const notFound = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message);

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Access denied') =>
  new AppError(403, 'FORBIDDEN', message);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

// ─── Global error handler ─────────────────────────────────────────────────────────

/**
 * Express global error handler. Must be registered last (after all routes).
 * All errors funnel through here for consistent response formatting.
 *
 * Cases handled:
 * 1. ZodError → 400 VALIDATION_ERROR with per-field details
 * 2. AppError → use the status/code from the error
 * 3. PostgreSQL unique violation (23505) → 409 CONFLICT
 * 4. All other errors → 500 INTERNAL_ERROR (safe generic message in production)
 */
export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const requestId = (req as Request & { requestId?: string }).requestId;

    // 1. Zod validation errors
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
          requestId,
        },
      });
      return;
    }

    // 2. Known application errors
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined && { details: err.details }),
          requestId,
        },
      });
      return;
    }

    // 3. PostgreSQL errors
    if (isPostgresError(err)) {
      if (err.code === '23505') {
        // Unique constraint violation
        res.status(409).json({
          error: { code: 'CONFLICT', message: 'A resource with this identifier already exists.', requestId },
        });
        return;
      }
      if (err.code === 'P0001') {
        // Raised exception from trigger (e.g. symptom edit window)
        res.status(400).json({
          error: { code: 'CONSTRAINT_VIOLATION', message: err.message, requestId },
        });
        return;
      }
    }

    // 4. Unhandled / unexpected errors
    logger.error({ err, requestId }, 'Unhandled error');

    // Report to Sentry (no-op if SENTRY_DSN not set). beforeSend strips PII.
    Sentry.captureException(err, {
      tags: { requestId: requestId ?? 'unknown' },
      user: req.user ? { id: req.user.id } : undefined,
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal server error occurred.',
        requestId,
      },
    });
  };
}

function isPostgresError(err: unknown): err is { code: string; message: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}
