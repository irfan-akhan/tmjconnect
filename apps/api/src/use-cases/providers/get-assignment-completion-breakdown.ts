import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  verifyProviderLink,
  findPatientAssignmentForProvider,
  listAssignmentCompletions,
} from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type GetAssignmentCompletionBreakdownInput = {
  providerId: string;
  patientId: string;
  assignmentId: string;
  limit?: number;
  offset?: number;
};

type FrequencyPlan = {
  kind: 'daily' | 'weekly';
  cadencePerPeriod: number;
};

function parseFrequency(frequency: string): FrequencyPlan {
  const raw = (frequency || 'daily').trim().toLowerCase();

  // Canonical semantics for provider-assignment frequencies:
  // - daily      => once per day
  // - 2x daily   => twice per day
  // - 3x (or 3x daily) => three times per day
  // - weekly     => once per week
  if (raw.includes('week')) return { kind: 'weekly', cadencePerPeriod: 1 };
  if (raw.includes('3x') || raw.includes('3×')) return { kind: 'daily', cadencePerPeriod: 3 };
  if (raw.includes('2x') || raw.includes('2×')) return { kind: 'daily', cadencePerPeriod: 2 };

  return { kind: 'daily', cadencePerPeriod: 1 };
}

function toUtcDayStart(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function isoDayKey(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function addUtcDays(input: Date, days: number): Date {
  const d = new Date(input);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function execute(deps: Deps, input: GetAssignmentCompletionBreakdownInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const assignment = await findPatientAssignmentForProvider(
    deps.db,
    input.providerId,
    input.patientId,
    input.assignmentId,
  );
  if (!assignment) throw new AppError(404, 'NOT_FOUND', 'Assignment not found.');

  const completions = await listAssignmentCompletions(deps.db, input.assignmentId);

  const frequencyPlan = parseFrequency(String(assignment.frequency));
  const sets = Math.max(Number(assignment.sets ?? 1), 1);
  const assignedAtDate = new Date(assignment.assigned_at);
  const assignedDay = toUtcDayStart(assignedAtDate);
  const today = toUtcDayStart(new Date());

  const completionMap = new Map<string, string[]>();
  for (const row of completions) {
    const completedAt = row.completed_at instanceof Date ? row.completed_at : new Date(row.completed_at);
    const dayKey = isoDayKey(toUtcDayStart(completedAt));
    const current = completionMap.get(dayKey) ?? [];
    current.push(completedAt.toISOString());
    completionMap.set(dayKey, current);
  }

  const periods: Array<{
    period_start: string;
    period_end: string;
    expected_sets: number;
    completed_sets: number;
    completion_pct: number;
    status: 'done' | 'partial' | 'missed';
    completion_timestamps: string[];
  }> = [];

  if (frequencyPlan.kind === 'weekly') {
    let cursor = assignedDay;
    while (cursor <= today) {
      const periodStart = cursor;
      const periodEnd = addUtcDays(periodStart, 6) > today ? today : addUtcDays(periodStart, 6);

      const timestamps: string[] = [];
      let dayCursor = periodStart;
      while (dayCursor <= periodEnd) {
        const key = isoDayKey(dayCursor);
        const dayTimestamps = completionMap.get(key) ?? [];
        timestamps.push(...dayTimestamps);
        dayCursor = addUtcDays(dayCursor, 1);
      }

      const expectedSets = frequencyPlan.cadencePerPeriod * sets;
      const completedSets = timestamps.length;
      const pct = expectedSets > 0 ? Math.round(Math.min(100, (completedSets / expectedSets) * 100)) : 0;

      periods.push({
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        expected_sets: expectedSets,
        completed_sets: completedSets,
        completion_pct: pct,
        status: completedSets === 0 ? 'missed' : completedSets >= expectedSets ? 'done' : 'partial',
        completion_timestamps: timestamps.sort((a, b) => (a > b ? -1 : 1)),
      });

      cursor = addUtcDays(periodStart, 7);
    }
  } else {
    let cursor = assignedDay;
    while (cursor <= today) {
      const key = isoDayKey(cursor);
      const timestamps = (completionMap.get(key) ?? []).sort((a, b) => (a > b ? -1 : 1));
      const expectedSets = frequencyPlan.cadencePerPeriod * sets;
      const completedSets = timestamps.length;
      const pct = expectedSets > 0 ? Math.round(Math.min(100, (completedSets / expectedSets) * 100)) : 0;

      periods.push({
        period_start: cursor.toISOString(),
        period_end: cursor.toISOString(),
        expected_sets: expectedSets,
        completed_sets: completedSets,
        completion_pct: pct,
        status: completedSets === 0 ? 'missed' : completedSets >= expectedSets ? 'done' : 'partial',
        completion_timestamps: timestamps,
      });

      cursor = addUtcDays(cursor, 1);
    }
  }

  periods.sort((a, b) => (a.period_start < b.period_start ? 1 : -1));

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const items = periods.slice(offset, offset + limit);

  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      frequency: assignment.frequency,
      sets,
      assigned_at: assignment.assigned_at,
      period_kind: frequencyPlan.kind === 'weekly' ? 'rolling_7d' : 'daily',
    },
    items,
    meta: {
      limit,
      offset,
      total: periods.length,
      hasMore: offset + limit < periods.length,
    },
  };
}