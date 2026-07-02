// Payroll summarization — pure, fully-typed, unit-testable (no Firebase/React). Turns raw
// clock in/out timesheet rows into per-worker regular/overtime hour totals for a payroll
// export. Overtime is computed per ISO work-week (Monday-start, via startOfWeek) so hours
// beyond the weekly threshold in ANY single week become OT — the standard FLSA-style rule.
//
// NOTE: unlike most files here this one deliberately keeps `@ts-nocheck` OFF and is strictly
// typed; it is the payroll math seam and is covered by payroll.test.ts.

import { minutesBetween, startOfWeek, type TimesheetEntry } from "./timesheets";

export interface PayrollLine {
  workerId: string;
  name: string;
  regularHours: number;
  otHours: number;
  totalHours: number;
  shifts: number;
}

export interface PayrollOptions {
  /** Inclusive lower bound: only entries whose clockIn is >= this instant count. */
  startISO: string;
  /** Inclusive upper bound: only entries whose clockIn is <= this instant count. */
  endISO: string;
  /** Hours per ISO week beyond which time counts as overtime. Defaults to 40. */
  otWeeklyThreshold?: number;
}

/** Round to 2 decimal places (money/hours precision). */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Whole minutes worked for a single entry.
//  - An OPEN entry (no clockOut) contributes 0. A payroll export must not GUESS when a
//    still-running shift ends; counting it (e.g. up to endISO) would bill hours the worker
//    may not have worked. Conservative choice: open shifts export as 0 hours until closed.
//  - A finished entry prefers its cached durationMins, else recomputes clockIn -> clockOut.
function entryMinutes(e: TimesheetEntry): number {
  if (!e || !e.clockOut) return 0; // still-open shift → 0 (do not extrapolate)
  if (typeof e.durationMins === "number" && Number.isFinite(e.durationMins)) {
    return Math.max(0, e.durationMins);
  }
  return minutesBetween(e.clockIn, e.clockOut);
}

// Stable grouping key for a worker. Prefer the userId (survives display-name edits), fall
// back to the name, then to a constant so anonymous rows still aggregate somewhere.
function workerKey(e: TimesheetEntry): string {
  return String(e?.userId || e?.userName || "unassigned");
}

// Parse an ISO bound to epoch ms; on an unparseable/empty bound fall back so the range
// stays open on that side (rather than silently excluding every entry via NaN compares).
function parseBound(iso: string, fallback: number): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? fallback : t;
}

interface WorkerAgg {
  workerId: string;
  name: string;
  weekMinutes: Map<number, number>; // week-start epoch ms → minutes worked that week
  shifts: number;
}

/**
 * Summarize timesheet entries into per-worker payroll lines for the [startISO, endISO]
 * range (both bounds inclusive, matched against each entry's clockIn). Overtime is the
 * portion of each ISO week's hours above `otWeeklyThreshold` (default 40h), summed per
 * worker across the range. Hours are rounded to 2 decimals; lines are ordered by name.
 */
export function summarizePayroll(
  entries: TimesheetEntry[],
  opts: PayrollOptions,
): PayrollLine[] {
  const thresholdMins = Math.max(0, opts.otWeeklyThreshold ?? 40) * 60;
  const startMs = parseBound(opts.startISO, -Infinity);
  const endMs = parseBound(opts.endISO, Infinity);

  const workers = new Map<string, WorkerAgg>();

  for (const e of entries || []) {
    if (!e || !e.clockIn) continue;
    const inMs = new Date(e.clockIn).getTime();
    if (Number.isNaN(inMs) || inMs < startMs || inMs > endMs) continue; // out of range

    const key = workerKey(e);
    let agg = workers.get(key);
    if (!agg) {
      agg = { workerId: key, name: "", weekMinutes: new Map(), shifts: 0 };
      workers.set(key, agg);
    }
    // Keep the first non-empty display name we encounter for this worker.
    if (!agg.name && e.userName) agg.name = String(e.userName);

    const mins = entryMinutes(e);
    const weekKey = startOfWeek(new Date(e.clockIn)).getTime();
    agg.weekMinutes.set(weekKey, (agg.weekMinutes.get(weekKey) || 0) + mins);
    agg.shifts += 1; // every in-range clock-in is a shift, even an open/0-hour one
  }

  const lines: PayrollLine[] = [];
  for (const agg of workers.values()) {
    let regMins = 0;
    let otMins = 0;
    for (const wkMins of agg.weekMinutes.values()) {
      regMins += Math.min(wkMins, thresholdMins);
      otMins += Math.max(0, wkMins - thresholdMins);
    }
    const regularHours = round2(regMins / 60);
    const otHours = round2(otMins / 60);
    lines.push({
      workerId: agg.workerId,
      name: agg.name || agg.workerId, // fall back to the id when no name was ever seen
      regularHours,
      otHours,
      totalHours: round2(regularHours + otHours),
      shifts: agg.shifts,
    });
  }

  // Deterministic ordering: by display name, then workerId as a stable tiebreak.
  lines.sort(
    (a, b) => a.name.localeCompare(b.name) || a.workerId.localeCompare(b.workerId),
  );
  return lines;
}
