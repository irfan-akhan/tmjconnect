"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
require("dotenv/config");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const migrator_1 = require("drizzle-orm/node-postgres/migrator");
const pg_1 = require("pg");
async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }
    const pool = new pg_1.Pool({ connectionString, max: 1 });
    const db = (0, node_postgres_1.drizzle)(pool);
    console.log('Applying migrations from ./drizzle/migrations …');
    await (0, migrator_1.migrate)(db, { migrationsFolder: './drizzle/migrations' });
    console.log('Migrations applied successfully.');
    await pool.end();
}
main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map