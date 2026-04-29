/**
 * Production migration runner — applies pending migrations from
 * `./drizzle/migrations` to the database referenced by DATABASE_URL.
 *
 * Use this in deploy pipelines instead of `db:push`. `db:push` introspects
 * the DB and diffs against the schema (great for dev prototyping, dangerous
 * for production because it can drop columns/tables without warning).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run db:migrate
 */
// Mirror the env-loading rules in src/config/env.ts:
//   .env.${NODE_ENV} first (e.g. .env.development), then .env as a fallback.
// First write wins, so the env-specific file overrides .env.
import * as dotenv from 'dotenv';
const nodeEnv = process.env.NODE_ENV ?? 'development';
dotenv.config({ path: `.env.${nodeEnv}` });
dotenv.config({ path: '.env' });

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  console.log('Applying migrations from ./drizzle/migrations …');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('Migrations applied successfully.');

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
