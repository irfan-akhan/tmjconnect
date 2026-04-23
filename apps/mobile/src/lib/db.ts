/**
 * Local SQLite — offline write queue + cache. Single database, lazily opened.
 * Schema migrations are inline + idempotent.
 */

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('tmjconnect.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;

    -- New unified offline queue
    CREATE TABLE IF NOT EXISTS offline_queue (
      client_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );

    -- Migrate any pending items from old table
    INSERT OR IGNORE INTO offline_queue (client_id, kind, payload, created_at, attempts, last_error)
      SELECT client_id,
             COALESCE(json_extract(payload, '$.kind'), 'symptom-upsert') AS kind,
             payload, created_at, attempts, last_error
      FROM symptom_log_queue
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='symptom_log_queue');

    -- Keep old table for backward compat but don't use it
    CREATE TABLE IF NOT EXISTS symptom_log_queue (
      client_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);
  return db;
}
