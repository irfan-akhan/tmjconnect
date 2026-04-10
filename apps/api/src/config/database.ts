import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

export type Db = ReturnType<typeof createDb>;

/**
 * Creates a Drizzle ORM instance backed by a pg connection pool.
 *
 * Pool configuration:
 * - max: 20 connections (pilot: 10, but 20 is safe for a single Express process)
 * - idleTimeoutMillis: 30s — release idle connections promptly
 * - connectionTimeoutMillis: 5s — fail fast if pool exhausted (returns 503 to client)
 *
 * The pool is shared across all requests for the lifetime of the process.
 * Call pool.end() in the SIGTERM handler for graceful shutdown.
 */
export function createDb(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Log pool errors to prevent them from crashing the process silently.
  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}
