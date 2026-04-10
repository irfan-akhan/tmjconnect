/**
 * computeNextFireAt(timeStr, days, timezone) — Computes the next UTC fire time
 * for a reminder given a local time string, weekday set, and IANA timezone.
 *
 * Algorithm:
 *   For each day in [today, today+7]:
 *     1. Check if that day (in `timezone`) is in `days`.
 *     2. Build an anchor Date treating the target local datetime as UTC.
 *     3. Compare what `timezone` maps that anchor to — compute the TZ offset.
 *     4. Add the offset to get the true UTC fire time.
 *     5. Return the first result that is in the future.
 *
 * This handles DST transitions correctly for the single-hour adjustment they cause.
 * No external timezone library required — uses Intl.DateTimeFormat only.
 */
export function computeNextFireAt(
  timeStr: string,
  days: string[],
  timezone: string,
): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();

  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  for (let ahead = 0; ahead <= 7; ahead++) {
    // Use noon UTC as the probe to avoid day-boundary issues from large UTC offsets.
    const probe = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + ahead,
      12, 0, 0, 0,
    ));

    const parts = dateFmt.formatToParts(probe);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

    const weekday = get('weekday').toLowerCase().slice(0, 3);
    if (!days.includes(weekday)) continue;

    const y = parseInt(get('year'));
    const mo = parseInt(get('month'));
    const d = parseInt(get('day'));

    // Step 1: Anchor = treat local datetime as UTC (intentional mis-labeling).
    const anchor = new Date(Date.UTC(y, mo - 1, d, hours, minutes, 0));

    // Step 2: Find what local time that UTC anchor maps to in `timezone`.
    const localTimeParts = timeFmt.formatToParts(anchor);
    const lh = parseInt(localTimeParts.find((p) => p.type === 'hour')?.value ?? '0');
    const lm = parseInt(localTimeParts.find((p) => p.type === 'minute')?.value ?? '0');

    // Handle hour=24 (midnight in some Intl implementations).
    const actualLocalMins = (lh === 24 ? 0 : lh) * 60 + lm;
    const targetLocalMins = hours * 60 + minutes;

    // Step 3: Difference tells us how far the anchor is off from the true UTC time.
    // E.g. Chicago UTC-6: anchor at 09:00Z → local shows 03:00 → diff = (09:00 - 03:00) = +6h
    // True UTC = anchor + diff = 09:00Z + 6h = 15:00Z ✓
    //
    // Wrap diff into the [-12h, +12h] range. When the local time of the anchor
    // crosses a day boundary (e.g. anchor=Apr17 04:00 UTC, local=Apr16 23:00 CDT),
    // the naive subtraction yields ~-19h. The actual UTC offset is +5h.
    let diffMs = (targetLocalMins - actualLocalMins) * 60_000;
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    if (diffMs < -TWELVE_HOURS) diffMs += 24 * 60 * 60 * 1000;
    if (diffMs > TWELVE_HOURS) diffMs -= 24 * 60 * 60 * 1000;
    const fireUTC = new Date(anchor.getTime() + diffMs);

    if (fireUTC > now) {
      return fireUTC;
    }
  }

  // Safety fallback — should not reach here with a valid days array (min 1 day).
  // Return 1 week from now so the job picks it up eventually.
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}
