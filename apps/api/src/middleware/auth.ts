import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@tmjconnect/shared';
import type { Db } from '../config/database';
import { verifyToken } from '../utils/jwt';
import { AppError } from './errorHandler';
import { eq, and, gt } from 'drizzle-orm';
import { sessions, users } from '../db/schema';
import { PROVIDER_SESSION_TIMEOUT_MINUTES } from '../config/constants';
import { sql } from 'drizzle-orm';

/**
 * authenticate() — Verifies the Authorization: Bearer <token> header.
 * Sets req.user from the decoded JWT payload.
 * Returns 401 if the token is missing, invalid, or expired.
 * Also checks the user is still active (defends against deactivation while JWT is valid).
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token.'));
    return;
  }

  // Check account is still active (guards against admin deactivation while JWT is live)
  if (req.db) {
    try {
      const [user] = await req.db
        .select({ is_active: users.is_active, deleted_at: users.deleted_at })
        .from(users)
        .where(eq(users.id, payload.id))
        .limit(1);
      if (!user || !user.is_active || user.deleted_at !== null) {
        next(new AppError(401, 'ACCOUNT_DISABLED', 'Account is deactivated or deleted.'));
        return;
      }
    } catch (err) {
      next(err);
      return;
    }
  }

  req.user = payload;
  next();
}

/**
 * authorize(role) — Role-based access control middleware factory.
 * Must be called after authenticate().
 * Returns 403 if the authenticated user does not have the required role.
 */
export function authorize(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      return;
    }
    if (req.user.role !== role) {
      next(new AppError(403, 'FORBIDDEN', 'Access denied for this role.'));
      return;
    }
    next();
  };
}

export function authorizeAny(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'Access denied for this role.'));
      return;
    }
    next();
  };
}

/**
 * checkSessionTimeout(db) — Enforces the 15-minute inactivity timeout for providers.
 * Must be called after authenticate() + authorize('provider').
 *
 * Flow:
 * 1. Find the active session for this provider.
 * 2. If last_active < NOW() - 15 min: delete session, return 401 SESSION_TIMEOUT.
 * 3. Otherwise: update last_active = NOW().
 *
 * Patient sessions do not have an inactivity timeout.
 */
export function checkSessionTimeout(db: Db['db']) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      return;
    }

    try {
      const timeoutAt = new Date(Date.now() - PROVIDER_SESSION_TIMEOUT_MINUTES * 60 * 1000);

      // Single atomic statement: update last_active only if the session is still
      // within the timeout window. If no row is updated the session has expired.
      const updated = await db
        .update(sessions)
        .set({ last_active: sql`NOW()` })
        .where(
          and(
            eq(sessions.user_id, req.user.id),
            gt(sessions.last_active, timeoutAt),
          ),
        )
        .returning({ id: sessions.id });

      if (updated.length === 0) {
        await db.delete(sessions).where(eq(sessions.user_id, req.user.id));
        next(new AppError(401, 'SESSION_TIMEOUT', 'Your session has expired. Please log in again.'));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
