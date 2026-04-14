/**
 * time.ts — Single place where dayjs plugins are configured.
 *
 * Importing this file anywhere in the app guarantees `relativeTime`, `utc`,
 * and `timezone` are loaded so callers can use `.fromNow()` and `.tz()`.
 *
 * Also exports a small set of helpers that all pages should prefer over
 * raw dayjs() calls so date formatting stays consistent and respects the
 * admin's chosen time zone (see PreferencesContext).
 */
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

/** Resolve "America/Los_Angeles" → IANA name. Falls back to system tz. */
export function resolveTimezone(preferred?: string | null): string {
  if (preferred && preferred !== 'system') return preferred;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Format an ISO string in a given tz. */
export function formatInTz(value: string | Date, tz: string, fmt = 'MMM D, YYYY h:mm A'): string {
  return dayjs(value).tz(tz).format(fmt);
}

/** Format a short relative time (e.g. "2m ago", "just now"). */
export function fromNow(value: string | Date): string {
  const d = dayjs(value);
  const seconds = dayjs().diff(d, 'second');
  if (seconds < 5) return 'just now';
  return d.fromNow();
}

/** Common abbreviated time-zone label, e.g. "PDT" for America/Los_Angeles. */
export function tzAbbreviation(tz: string): string {
  try {
    return dayjs().tz(tz).format('z');
  } catch {
    return tz;
  }
}

export default dayjs;
