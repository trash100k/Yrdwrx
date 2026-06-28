// Pure time-tracking helpers (no Firebase/React) so they're unit-testable. The TimeClock
// component persists entries; these compute durations + weekly rollups.

export interface TimesheetEntry {
  id?: string;
  tenantId?: string;
  userId?: string;
  userName?: string;
  clockIn: string;   // ISO
  clockOut?: string | null; // ISO when finished
  durationMins?: number;    // cached on clock-out
}

// Whole minutes between two ISO timestamps (0 if invalid / negative).
export function minutesBetween(startISO?: string | null, endISO?: string | null): number {
  if (!startISO || !endISO) return 0;
  const a = new Date(startISO).getTime();
  const b = new Date(endISO).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 60000);
}

// "Xh Ym" (or "Ym" under an hour).
export function formatDuration(mins: number): string {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

// Start of the ISO-ish work week (Monday 00:00) relative to `now`.
export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

// Total minutes worked this week. Finished entries use durationMins (or clockIn→clockOut);
// an open entry counts up to `now`. Only entries whose clockIn is within the week count.
export function weekMinutes(entries: TimesheetEntry[], now: Date = new Date()): number {
  const wk = startOfWeek(now).getTime();
  let total = 0;
  for (const e of entries || []) {
    const start = e?.clockIn ? new Date(e.clockIn).getTime() : NaN;
    if (isNaN(start) || start < wk) continue;
    if (e.clockOut) {
      total += typeof e.durationMins === "number" ? e.durationMins : minutesBetween(e.clockIn, e.clockOut);
    } else {
      total += minutesBetween(e.clockIn, now.toISOString());
    }
  }
  return total;
}

// The currently-open entry (clocked in, not out), if any.
export function activeEntry(entries: TimesheetEntry[]): TimesheetEntry | null {
  return (entries || []).find((e) => e && e.clockIn && !e.clockOut) || null;
}
