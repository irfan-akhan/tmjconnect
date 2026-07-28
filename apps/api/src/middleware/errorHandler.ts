import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../config/logger';
import { ZodError } from 'zod';
import { Sentry } from '../config/sentry';
import { logSafeBody } from '../utils/logSafeBody';

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
    next: NextFunction,
  ): void {
    // If the response is already on the wire, writing another one throws
    // ERR_HTTP_HEADERS_SENT. Express's default handler is the only thing that can
    // correctly close the connection at this point.
    if (res.headersSent) {
      next(err);
      return;
    }

    const requestId = (req as Request & { requestId?: string }).requestId;

    /**
     * Diagnostic logging must never cost the client its response.
     *
     * Everything below is an aid to debugging, not part of the contract: a
     * failing log transport, an unserialisable body, or a throwing getter must
     * degrade to silence, not to a hung request or an Express default 500.
     * The whole block — context assembly included — runs inside the try, since
     * building the object is as capable of throwing as writing it.
     */
    const safeLog = (build: () => { level: 'warn' | 'error'; ctx: object; msg: string }): void => {
      try {
        const { level, ctx, msg } = build();
        logger[level](ctx, msg);
      } catch {
        // Deliberately empty: there is no safe place left to report this, and
        // the caller still owes the client a response.
      }
    };

    /** Request context common to every branch. Assembled lazily inside safeLog. */
    const reqContext = () => ({
      requestId,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
    });

    // 1. Zod validation errors
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      // The request log records only "→ 400", which is not diagnosable on its
      // own. Log which fields failed and the payload that failed them.
      // logSafeBody() redacts PHI and free text by key name — see its docblock.
      safeLog(() => ({
        level: 'warn',
        ctx: { ...reqContext(), validation: details, payload: logSafeBody(req.body) },
        msg: 'Request validation failed',
      }));

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details,
          requestId,
        },
      });
      return;
    }

    // 2. Known application errors
    if (err instanceof AppError) {
      safeLog(() => ({
        level: 'warn',
        ctx: {
          ...reqContext(),
          code: err.code,
          statusCode: err.statusCode,
          payload: logSafeBody(req.body),
        },
        msg: err.message,
      }));

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
      if (err.code === '23505' || err.code === 'P0001') {
        safeLog(() => ({
          level: 'warn',
          ctx: { ...reqContext(), pgCode: err.code, payload: logSafeBody(req.body) },
          msg: `Database constraint rejected the request: ${err.code}`,
        }));
      }
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
    safeLog(() => ({
      level: 'error',
      ctx: { err, ...reqContext(), payload: logSafeBody(req.body) },
      msg: 'Unhandled error',
    }));

    // Report to Sentry (no-op if SENTRY_DSN not set). beforeSend strips PII.
    // Also non-essential: a transport failure here must not swallow the 500.
    try {
      Sentry.captureException(err, {
        tags: { requestId: requestId ?? 'unknown' },
        user: req.user ? { id: req.user.id } : undefined,
      });
    } catch {
      // No-op — reporting the reporting failure has nowhere useful to go.
    }

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
