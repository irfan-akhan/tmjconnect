/**
 * Compute day-streak stats from a list of ISO timestamps.
 * - streak: consecutive days ending today (or yesterday if no log today yet)
 * - longest: longest consecutive-day run across the input
 */
export function computeStreak(timestamps: string[]): { streak: number; longest: number } {
  if (timestamps.length === 0) return { streak: 0, longest: 0 };

  const days = new Set<string>();
  for (const t of timestamps) {
    const d = new Date(t);
    days.add(ymd(d));
  }

  let longest = 0;
  for (const day of days) {
    const d = new Date(day);
    if (days.has(ymd(addDays(d, -1)))) continue; // not the start of a run
    let run = 1;
    let cursor = d;
    while (days.has(ymd(addDays(cursor, 1)))) {
      run++;
      cursor = addDays(cursor, 1);
    }
    if (run > longest) longest = run;
  }

  const today = new Date();
  let streak = 0;
  let cursor = today;
  if (!days.has(ymd(today))) cursor = addDays(today, -1);
  while (days.has(ymd(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return { streak, longest };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
