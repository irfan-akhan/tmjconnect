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
import 'dotenv/config';
//# sourceMappingURL=migrate.d.ts.map