import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import type { Logger } from '../config/logger';

/**
 * Creates the pino-http request logging middleware.
 *
 * Every completed request logs at 'info' level:
 *   method, url, statusCode, responseTime (ms), requestId, userId (if authenticated)
 *
 * The X-Request-ID header is used if present (from client or upstream proxy);
 * otherwise a new UUID is generated. The same ID is:
 * - Returned in the X-Request-ID response header
 * - Attached to audit log entries (via req.requestId)
 * - Tagged on Sentry error events
 * - Included in all structured pino log entries for that request
 */
export function createRequestLogger(logger: Logger) {
  return pinoHttp({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pino v9/pino-http v9 Logger type mismatch
    logger: logger as any,
    // Generate or reuse the request ID for correlation.
    // Reject non-UUID values to prevent log injection via a crafted header.
    genReqId: (req, res) => {
      const incomingId = req.headers['x-request-id'];
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const id = (typeof incomingId === 'string' && UUID_RE.test(incomingId))
        ? incomingId
        : randomUUID();
      res.setHeader('X-Request-ID', id);
      // Expose on req so other middleware/handlers can reference it.
      (req as typeof req & { requestId?: string }).requestId = id;
      return id;
    },
    customLogLevel: (_req, res, err) => {
      if (err || (res.statusCode && res.statusCode >= 500)) return 'error';
      if (res.statusCode && res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (_req, res, err) =>
      `Request failed: ${err?.message ?? res.statusCode}`,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        // userId is attached to req.raw by authenticate() middleware — log if present.
        userId: (req.raw as { user?: { id: string } }).user?.id,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  });
}
