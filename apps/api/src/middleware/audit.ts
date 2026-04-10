import type { Request, Response, NextFunction } from 'express';
import type { Db } from '../config/database';
import type { Logger } from '../config/logger';
import { auditLogs } from '../db/schema';

/**
 * auditLog(action, resourceType?) — Middleware factory for HIPAA audit logging.
 *
 * Usage (applied per-route):
 *   router.post('/symptoms',
 *     authenticate, authorize('patient'),
 *     auditLog('patient.symptoms.create', 'symptom_log'),
 *     handler
 *   );
 *
 * The audit INSERT is fire-and-forget (no await). Route response is never delayed.
 * Failures are logged to Sentry/pino but do not fail the request.
 *
 * resource_id is populated after the response is sent if set on res.locals.auditResourceId.
 * Route handlers should set: res.locals.auditResourceId = newRecord.id
 *
 * metadata.requestId ties this audit entry to the pino request log and Sentry event.
 * metadata must never contain raw PHI — only record IDs and aggregate values.
 */
export function auditLog(action: string, resourceType?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Fire audit insert after the response is sent to avoid blocking the handler.
    res.on('finish', () => {
      const { db, logger } = req;

      if (!db) return; // Should not happen in production — db is on req via container middleware.

      const entry = {
        user_id: req.user?.id ?? null,
        action,
        resource_type: resourceType ?? null,
        resource_id: res.locals.auditResourceId ?? null,
        ip_address: req.ip ?? null,
        user_agent: req.headers['user-agent'] ?? null,
        metadata: {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        },
      };

      db.insert(auditLogs)
        .values(entry)
        .catch((err: Error) => {
          logger?.error({ err, action, requestId: req.requestId }, 'Audit log insert failed');
        });
    });

    next();
  };
}

/**
 * attachDb(db, logger) — Attaches db and logger to req so auditLog middleware can access them.
 * Mount this once globally before all routes.
 */
export function attachDb(db: Db['db'], logger: Logger) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.db = db;
    req.logger = logger;
    next();
  };
}
