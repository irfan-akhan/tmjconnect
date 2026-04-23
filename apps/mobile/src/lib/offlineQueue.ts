/**
 * Offline write queue with conflict resolution. Enqueues writes that fail
 * with a network error; drains them on reconnect + on app foreground.
 *
 * Covers ALL patient mutations: symptoms, exercises, tracking (mobility,
 * medications, sleep), reports, reminders, and notifications.
 *
 * Conflict resolution strategy:
 *   - Symptom upserts → server uses date-based upsert (idempotent per day)
 *   - Exercise completions → server deduplicates per (assignment, date)
 *   - Tracking logs → append-only, no conflict possible
 *   - Reports → idempotency key prevents duplicates
 *   - Reminders → last-write-wins (offline edits overwrite server state)
 *   - Notifications → mark-read is idempotent
 *
 * The queue is persisted in SQLite so replay survives a relaunch. Payloads
 * are serialized JSON with a `kind` discriminator for endpoint routing.
 */

import { onlineManager } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { getDb } from './db';
import type { SymptomLogInput } from './patient.api';

export type QueuedWrite =
  | { kind: 'symptom-upsert'; payload: SymptomLogInput }
  | { kind: 'symptom-update'; id: string; payload: Record<string, unknown> }
  | { kind: 'symptom-delete'; id: string }
  | { kind: 'exercise-complete'; assignmentId: string; payload: { completion_duration_seconds?: number; completion_notes?: string } }
  | { kind: 'mobility-log'; payload: { measurement_mm: number; method?: string; notes?: string } }
  | { kind: 'medication-log'; payload: { medication_name: string; dosage?: string; notes?: string } }
  | { kind: 'sleep-log'; payload: { quality: number; hours_slept?: number; bruxism_aware?: boolean; morning_stiffness?: number; notes?: string } }
  | { kind: 'report-submit'; payload: Record<string, unknown>; idempotencyKey: string }
  | { kind: 'reminder-create'; payload: Record<string, unknown> }
  | { kind: 'reminder-update'; id: string; payload: Record<string, unknown> }
  | { kind: 'reminder-delete'; id: string }
  | { kind: 'notification-read'; id: string }
  | { kind: 'notification-read-all' }
  | { kind: 'profile-update'; payload: Record<string, unknown> }
  | { kind: 'intake-response'; formId: string; payload: Record<string, unknown> };

function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0 || err.status >= 500;
  return err instanceof TypeError;
}

function newClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue(write: QueuedWrite): Promise<void> {
  const db = getDb();
  const clientId = newClientId();
  db.runSync(
    'INSERT INTO offline_queue (client_id, kind, payload) VALUES (?, ?, ?)',
    [clientId, write.kind, JSON.stringify(write)],
  );
}

async function replayWrite(write: QueuedWrite): Promise<void> {
  switch (write.kind) {
    case 'symptom-upsert':
      await api.post('/symptoms', write.payload);
      break;
    case 'symptom-update':
      await api.patch(`/symptoms/${write.id}`, write.payload);
      break;
    case 'symptom-delete':
      await api.delete(`/symptoms/${write.id}`);
      break;
    case 'exercise-complete':
      await api.post(`/exercises/assignments/${write.assignmentId}/complete`, write.payload);
      break;
    case 'mobility-log':
      await api.post('/tracking/mobility', write.payload);
      break;
    case 'medication-log':
      await api.post('/tracking/medications', write.payload);
      break;
    case 'sleep-log':
      await api.post('/tracking/sleep', write.payload);
      break;
    case 'report-submit':
      await api.post('/reports', write.payload, {
        headers: { 'Idempotency-Key': write.idempotencyKey },
      });
      break;
    case 'reminder-create':
      await api.post('/reminders', write.payload);
      break;
    case 'reminder-update':
      await api.patch(`/reminders/${write.id}`, write.payload);
      break;
    case 'reminder-delete':
      await api.delete(`/reminders/${write.id}`);
      break;
    case 'notification-read':
      await api.patch(`/notifications/${write.id}/read`);
      break;
    case 'notification-read-all':
      await api.patch('/notifications/read-all');
      break;
    case 'profile-update':
      await api.patch('/patients/me', write.payload);
      break;
    case 'intake-response':
      await api.post(`/intake-forms/${write.formId}/responses`, write.payload);
      break;
  }
}

function isConflictSafe(write: QueuedWrite, status: number): boolean {
  if (status === 409) {
    // Conflict responses for idempotent operations are successes
    if (write.kind === 'symptom-upsert') return true;
    if (write.kind === 'exercise-complete') return true;
    if (write.kind === 'report-submit') return true;
    if (write.kind === 'notification-read') return true;
    if (write.kind === 'notification-read-all') return true;
  }
  if (status === 404) {
    // Resource was deleted while offline — safe to skip
    if (write.kind === 'symptom-update') return true;
    if (write.kind === 'symptom-delete') return true;
    if (write.kind === 'reminder-update') return true;
    if (write.kind === 'reminder-delete') return true;
    if (write.kind === 'notification-read') return true;
  }
  if (status === 200 || status === 201 || status === 204) return true;
  return false;
}

export async function drain(): Promise<{ drained: number; failed: number; conflictResolved: number }> {
  const db = getDb();
  const rows = db.getAllSync<{ client_id: string; kind: string; payload: string; attempts: number }>(
    'SELECT client_id, kind, payload, attempts FROM offline_queue ORDER BY created_at ASC LIMIT 50',
  );
  let drained = 0;
  let failed = 0;
  let conflictResolved = 0;

  for (const row of rows) {
    try {
      const write = JSON.parse(row.payload) as QueuedWrite;
      await replayWrite(write);
      db.runSync('DELETE FROM offline_queue WHERE client_id = ?', [row.client_id]);
      drained++;
    } catch (err) {
      if (isNetworkError(err)) {
        break;
      }

      const status = err instanceof ApiError ? err.status : 0;
      const write = JSON.parse(row.payload) as QueuedWrite;

      if (isConflictSafe(write, status)) {
        db.runSync('DELETE FROM offline_queue WHERE client_id = ?', [row.client_id]);
        conflictResolved++;
        continue;
      }

      failed++;
      const attempts = row.attempts + 1;
      const message = err instanceof ApiError ? `${err.status}:${err.code ?? err.message}` : String(err).slice(0, 120);
      if (attempts >= 5) {
        db.runSync('DELETE FROM offline_queue WHERE client_id = ?', [row.client_id]);
      } else {
        db.runSync(
          'UPDATE offline_queue SET attempts = ?, last_error = ? WHERE client_id = ?',
          [attempts, message, row.client_id],
        );
      }
    }
  }
  return { drained, failed, conflictResolved };
}

export function queuedCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM offline_queue');
  return row?.count ?? 0;
}

let drainInFlight: Promise<unknown> | null = null;
export function scheduleDrain(): void {
  if (drainInFlight) return;
  drainInFlight = drain()
    .catch(() => undefined)
    .finally(() => {
      drainInFlight = null;
    });
}

export function attachOfflineQueueListeners(): () => void {
  scheduleDrain();
  return onlineManager.subscribe((isOnline) => {
    if (isOnline) scheduleDrain();
  });
}

export { isNetworkError };
