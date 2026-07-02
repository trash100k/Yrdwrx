import { describe, it, expect } from "vitest";
import { summarizePayroll, type PayrollOptions } from "./payroll";
import type { TimesheetEntry } from "./timesheets";

// Build a UTC ISO string from LOCAL date components, matching timesheets.test.ts. This keeps
// the assertions TZ-independent: the string round-trips back to the same LOCAL moment, so
// startOfWeek()'s local-day arithmetic buckets it into the week we intend on any machine.
// month is 0-based (June = 5, July = 6). 2026-06-29 is a Monday; 2026-07-05 a Sunday.
const iso = (y: number, mo: number, d: number, h = 0, mi = 0): string =>
  new Date(y, mo, d, h, mi, 0, 0).toISOString();

// Week A = Mon Jun 29 .. Sun Jul 5 2026. Week B = Mon Jul 6 .. Sun Jul 12 2026.
const WEEK_A: PayrollOptions = { startISO: iso(2026, 5, 29, 0), endISO: iso(2026, 6, 5, 23, 59) };
const TWO_WEEKS: PayrollOptions = { startISO: iso(2026, 5, 29, 0), endISO: iso(2026, 6, 12, 23, 59) };

describe("summarizePayroll", () => {
  it("returns [] for empty input", () => {
    expect(summarizePayroll([], WEEK_A)).toEqual([]);
  });

  it("returns [] for null/undefined entries (guarded)", () => {
    expect(summarizePayroll(null as unknown as TimesheetEntry[], WEEK_A)).toEqual([]);
    expect(summarizePayroll(undefined as unknown as TimesheetEntry[], WEEK_A)).toEqual([]);
  });

  it("summarizes a single 8h shift (no OT)", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 17) },
    ];
    expect(summarizePayroll(entries, WEEK_A)).toEqual([
      { workerId: "u1", name: "Alice", regularHours: 8, otHours: 0, totalHours: 8, shifts: 1 },
    ]);
  });

  it("splits a 45h week into 40 regular + 5 OT (default 40h threshold)", () => {
    // Five 9h Mon–Fri shifts within week A = 45h.
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 18) }, // Mon
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 30, 9), clockOut: iso(2026, 5, 30, 18) }, // Tue
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 6, 1, 9), clockOut: iso(2026, 6, 1, 18) }, // Wed
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 6, 2, 9), clockOut: iso(2026, 6, 2, 18) }, // Thu
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 6, 3, 9), clockOut: iso(2026, 6, 3, 18) }, // Fri
    ];
    expect(summarizePayroll(entries, WEEK_A)).toEqual([
      { workerId: "u1", name: "Alice", regularHours: 40, otHours: 5, totalHours: 45, shifts: 5 },
    ]);
  });

  it("honors a custom otWeeklyThreshold", () => {
    // Same 45h week, but a 35h threshold → 35 regular + 10 OT.
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 0), clockOut: iso(2026, 5, 30, 21) }, // 45h in one shift
    ];
    const [line] = summarizePayroll(entries, { ...WEEK_A, otWeeklyThreshold: 35 });
    expect(line).toMatchObject({ regularHours: 35, otHours: 10, totalHours: 45 });
  });

  it("computes OT per ISO week across a multi-week range (not across the whole range)", () => {
    const entries: TimesheetEntry[] = [
      // Week A: 40h + 5h = 45h → 40 reg / 5 OT
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 0), clockOut: iso(2026, 5, 30, 16) }, // 40h
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 6, 1, 9), clockOut: iso(2026, 6, 1, 14) }, // 5h
      // Week B: 30h → 30 reg / 0 OT
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 6, 6, 0), clockOut: iso(2026, 6, 7, 6) }, // 30h
    ];
    // Regular = 40 + 30 = 70, OT = 5 (only week A exceeded 40) — NOT (75-40).
    expect(summarizePayroll(entries, TWO_WEEKS)).toEqual([
      { workerId: "u1", name: "Alice", regularHours: 70, otHours: 5, totalHours: 75, shifts: 3 },
    ]);
  });

  it("excludes entries whose clockIn falls outside [startISO, endISO]", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 22, 9), clockOut: iso(2026, 5, 22, 17) }, // before range
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 17) }, // in range, 8h
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 6, 20, 9), clockOut: iso(2026, 6, 20, 17) }, // after range
    ];
    expect(summarizePayroll(entries, WEEK_A)).toEqual([
      { workerId: "u1", name: "Alice", regularHours: 8, otHours: 0, totalHours: 8, shifts: 1 },
    ]);
  });

  it("treats an open shift (no clockOut) as 0 payable hours but counts it as a shift", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: null },
    ];
    expect(summarizePayroll(entries, WEEK_A)).toEqual([
      { workerId: "u1", name: "Alice", regularHours: 0, otHours: 0, totalHours: 0, shifts: 1 },
    ]);
  });

  it("mixes a finished shift with an open shift for the same worker", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 17) }, // 8h
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 30, 9), clockOut: null }, // open, 0h
    ];
    expect(summarizePayroll(entries, WEEK_A)).toEqual([
      { workerId: "u1", name: "Alice", regularHours: 8, otHours: 0, totalHours: 8, shifts: 2 },
    ]);
  });

  it("prefers cached durationMins over recomputing from clockIn/clockOut", () => {
    // durationMins (300 = 5h) disagrees with clockIn→clockOut (480 = 8h); cached value wins.
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 17), durationMins: 300 },
    ];
    expect(summarizePayroll(entries, WEEK_A)[0]).toMatchObject({ regularHours: 5, totalHours: 5 });
  });

  it("falls back to computed clockIn→clockOut when durationMins is absent", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 11) }, // 2h
    ];
    expect(summarizePayroll(entries, WEEK_A)[0]).toMatchObject({ regularHours: 2, totalHours: 2 });
  });

  it("groups by worker and orders lines deterministically by name", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u2", userName: "Bob", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 13) }, // 4h
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 11) }, // 2h
      { userId: "zzz", clockIn: iso(2026, 5, 30, 9), clockOut: iso(2026, 5, 30, 10) }, // 1h, no name
    ];
    const lines = summarizePayroll(entries, WEEK_A);
    expect(lines.map((l) => l.name)).toEqual(["Alice", "Bob", "zzz"]);
    expect(lines.find((l) => l.workerId === "u2")).toMatchObject({ name: "Bob", regularHours: 4, shifts: 1 });
    // A worker with no userName falls back to its workerId for the display name.
    expect(lines.find((l) => l.workerId === "zzz")).toMatchObject({ name: "zzz", regularHours: 1 });
  });

  it("keeps the first non-empty display name across a worker's entries", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 10) }, // no name
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 30, 9), clockOut: iso(2026, 5, 30, 10) },
    ];
    expect(summarizePayroll(entries, WEEK_A)).toEqual([
      { workerId: "u1", name: "Alice", regularHours: 2, otHours: 0, totalHours: 2, shifts: 2 },
    ]);
  });

  it("groups by userName when userId is absent, and by a constant when both are absent", () => {
    const named: TimesheetEntry[] = [
      { userName: "Solo", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 11) },
    ];
    expect(summarizePayroll(named, WEEK_A)[0]).toMatchObject({ workerId: "Solo", name: "Solo", regularHours: 2 });

    const anon: TimesheetEntry[] = [
      { clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 11) },
    ];
    expect(summarizePayroll(anon, WEEK_A)[0]).toMatchObject({ workerId: "unassigned", name: "unassigned", regularHours: 2 });
  });

  it("rounds hours to 2 decimals", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 17), durationMins: 50 }, // 50/60 = 0.8333h
    ];
    expect(summarizePayroll(entries, WEEK_A)[0]).toMatchObject({ regularHours: 0.83 });
  });

  it("skips entries with a missing/invalid clockIn", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: "", clockOut: iso(2026, 5, 29, 17) },
      { userId: "u1", userName: "Alice", clockIn: "garbage", clockOut: iso(2026, 5, 29, 17) },
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 12) }, // 3h, the only valid one
    ];
    expect(summarizePayroll(entries, WEEK_A)[0]).toMatchObject({ regularHours: 3, shifts: 1 });
  });

  it("treats empty/invalid range bounds as an open range (includes everything)", () => {
    const entries: TimesheetEntry[] = [
      { userId: "u1", userName: "Alice", clockIn: iso(2026, 5, 29, 9), clockOut: iso(2026, 5, 29, 13) }, // 4h
    ];
    expect(summarizePayroll(entries, { startISO: "", endISO: "" })[0]).toMatchObject({ regularHours: 4 });
  });
});
