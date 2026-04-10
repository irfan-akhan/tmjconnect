// Re-exports all Drizzle schema objects.
// This file is the entry point for drizzle-kit (schema path in drizzle.config.ts)
// and for the createDb() function in config/database.ts.

export * from './users';
export * from './auth';
export * from './linking';
export * from './exercises';
export * from './clinical';
export * from './notifications';
export * from './system';
