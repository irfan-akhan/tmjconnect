import type { TokenPayload } from '@tmjconnect/shared';
import type { Db } from '../config/database';
import type { Logger } from '../config/logger';

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user payload from JWT. Set by authenticate() middleware. */
      user?: TokenPayload;
      /** Per-request UUID for log/audit/Sentry correlation. Set by requestLogger middleware. */
      requestId?: string;
      /** Drizzle db client. Set by attachDb() middleware before all routes. */
      db?: Db['db'];
      /** Pino logger instance. Set by attachDb() middleware before all routes. */
      logger?: Logger;
    }
  }
}

export {};
