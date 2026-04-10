import { defineConfig } from 'drizzle-kit';

// Load DATABASE_URL directly — drizzle.config.ts runs before env.ts validation
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required for drizzle-kit commands');
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: databaseUrl,
  },
  verbose: true,
  strict: true,
});
