import type { Request, Response, NextFunction } from 'express';
import { REQUEST_TIMEOUT_MS } from '../config/constants';

/**
 * Request timeout middleware.
 * Aborts any handler that exceeds REQUEST_TIMEOUT_MS (30 seconds) with 408 Request Timeout.
 * Registered before all route handlers in the middleware chain.
 */
export function requestTimeout(req: Request, res: Response, next: NextFunction): void {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'The request took too long to process.',
        },
      });
    }
  }, REQUEST_TIMEOUT_MS);

  // Clean up the timer when the response finishes (success or error).
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));

  next();
}
