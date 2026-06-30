// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  minutesBetween,
  formatDuration,
  startOfWeek,
  weekMinutes,
  activeEntry,
  type TimesheetEntry,
} from "./timesheets";

describe("minutesBetween", () => {
  it("computes whole minutes for a normal interval", () => {
    expect(
      minutesBetween("2026-06-30T09:00:00.000Z", "2026-06-30T10:30:00.000Z")
    ).toBe(90);
  });

  it("floors partial minutes down", () => {
    // 90 seconds -> 1 whole minute
    expect(
      minutesBetween("2026-06-30T09:00:00.000Z", "2026-06-30T09:01:30.000Z")
    ).toBe(1);
    // 59 seconds -> 0 whole minutes
    expect(
      minutesBetween("2026-06-30T09:00:00.000Z", "2026-06-30T09:00:59.000Z")
    ).toBe(0);
  });

  it("returns 0 for a zero-length interval (same instant)", () => {
    expect(
      minutesBetween("2026-06-30T09:00:00.000Z", "2026-06-30T09:00:00.000Z")
    ).toBe(0);
  });

  it("returns 0 when end is before start (out-of-order / negative)", () => {
    expect(
      minutesBetween("2026-06-30T10:00:00.000Z", "2026-06-30T09:00:00.000Z")
    ).toBe(0);
  });

  it("returns 0 when either argument is missing/null/undefined/empty", () => {
    expect(minutesBetween(undefined, "2026-06-30T10:00:00.000Z")).toBe(0);
    expect(minutesBetween("2026-06-30T09:00:00.000Z", undefined)).toBe(0);
    expect(minutesBetween(null, null)).toBe(0);
    expect(minutesBetween("", "2026-06-30T10:00:00.000Z")).toBe(0);
    expect(minutesBetween("2026-06-30T09:00:00.000Z", "")).toBe(0);
  });

  it("returns 0 for invalid (non-parseable) date strings", () => {
    expect(minutesBetween("not-a-date", "2026-06-30T10:00:00.000Z")).toBe(0);
    expect(minutesBetween("2026-06-30T09:00:00.000Z", "garbage")).toBe(0);
    expect(minutesBetween("nope", "still-nope")).toBe(0);
  });

  it("handles intervals spanning days", () => {
    // exactly 24 hours = 1440 minutes
    expect(
      minutesBetween("2026-06-30T00:00:00.000Z", "2026-07-01T00:00:00.000Z")
    ).toBe(1440);
  });
});

describe("formatDuration", () => {
  it('formats sub-hour durations as "Ym"', () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(59)).toBe("59m");
  });

  it('formats hour+ durations as "Xh Ym"', () => {
    expect(formatDuration(60)).toBe("1h 0m");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(125)).toBe("2h 5m");
  });

  it("clamps negative input to 0m", () => {
    expect(formatDuration(-30)).toBe("0m");
  });

  it("rounds fractional minutes to the nearest whole minute", () => {
    expect(formatDuration(90.4)).toBe("1h 30m");
    expect(formatDuration(90.6)).toBe("1h 31m");
  });

  it("treats non-numeric input as 0m", () => {
    // Number(undefined) -> NaN -> `|| 0` -> 0
    expect(formatDuration(undefined as any)).toBe("0m");
    expect(formatDuration("not a number" as any)).toBe("0m");
  });
});

describe("startOfWeek", () => {
  it("returns Monday 00:00 local time when given a mid-week day", () => {
    // 2026-06-30 is a Tuesday. Use local-time constructor so the assertion
    // matches the function's local-time arithmetic regardless of test TZ.
    const wed = new Date(2026, 5, 30, 14, 23, 11, 500); // Tue Jun 30 2026, local
    const sow = startOfWeek(wed);
    expect(sow.getDay()).toBe(1); // Monday
    expect(sow.getFullYear()).toBe(2026);
    expect(sow.getMonth()).toBe(5); // June
    expect(sow.getDate()).toBe(29); // Mon Jun 29 2026
    expect(sow.getHours()).toBe(0);
    expect(sow.getMinutes()).toBe(0);
    expect(sow.getSeconds()).toBe(0);
    expect(sow.getMilliseconds()).toBe(0);
  });

  it("treats Sunday as the LAST day of the week (rolls back 6 days, not forward)", () => {
    // (getDay()+6)%7: Sunday getDay()=0 -> day index 6 -> back 6 days to Monday.
    const sunday = new Date(2026, 6, 5, 23, 59, 0); // Sun Jul 5 2026, local
    const sow = startOfWeek(sunday);
    expect(sow.getDay()).toBe(1); // Monday
    expect(sow.getDate()).toBe(29); // Mon Jun 29 2026
    expect(sow.getMonth()).toBe(5); // June
  });

  it("returns the same Monday (midnight) when given that Monday", () => {
    const monday = new Date(2026, 5, 29, 8, 0, 0); // Mon Jun 29 2026, local
    const sow = startOfWeek(monday);
    expect(sow.getDay()).toBe(1);
    expect(sow.getDate()).toBe(29);
    expect(sow.getHours()).toBe(0);
  });

  it("does not mutate the date passed in", () => {
    const input = new Date(2026, 5, 30, 14, 0, 0);
    const before = input.getTime();
    startOfWeek(input);
    expect(input.getTime()).toBe(before);
  });
});

describe("weekMinutes", () => {
  // Reference "now": Wednesday Jul 1 2026, 12:00 local. Week starts Mon Jun 29 00:00 local.
  const now = new Date(2026, 6, 1, 12, 0, 0);

  it("returns 0 for an empty array", () => {
    expect(weekMinutes([], now)).toBe(0);
  });

  it("returns 0 for null/undefined entries (guarded)", () => {
    expect(weekMinutes(null as any, now)).toBe(0);
    expect(weekMinutes(undefined as any, now)).toBe(0);
  });

  it("sums multiple finished entries within the week", () => {
    const entries: TimesheetEntry[] = [
      {
        clockIn: new Date(2026, 5, 29, 9, 0, 0).toISOString(), // Mon
        clockOut: new Date(2026, 5, 29, 11, 0, 0).toISOString(),
      }, // 120
      {
        clockIn: new Date(2026, 5, 30, 9, 0, 0).toISOString(), // Tue
        clockOut: new Date(2026, 5, 30, 9, 30, 0).toISOString(),
      }, // 30
    ];
    expect(weekMinutes(entries, now)).toBe(150);
  });

  it("prefers a cached durationMins over recomputing for finished entries", () => {
    // durationMins disagrees with clockIn->clockOut; the cached value wins.
    const entries: TimesheetEntry[] = [
      {
        clockIn: new Date(2026, 5, 29, 9, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 29, 11, 0, 0).toISOString(), // would be 120
        durationMins: 200, // cached, intentionally different
      },
    ];
    expect(weekMinutes(entries, now)).toBe(200);
  });

  it("falls back to clockIn->clockOut when durationMins is absent for a finished entry", () => {
    const entries: TimesheetEntry[] = [
      {
        clockIn: new Date(2026, 5, 29, 9, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 29, 10, 15, 0).toISOString(),
        // no durationMins
      },
    ];
    expect(weekMinutes(entries, now)).toBe(75);
  });

  it("counts an open entry (no clockOut) up to `now`", () => {
    const entries: TimesheetEntry[] = [
      {
        clockIn: new Date(2026, 6, 1, 11, 0, 0).toISOString(), // 1h before now
        clockOut: null,
      },
    ];
    expect(weekMinutes(entries, now)).toBe(60);
  });

  it("ignores entries whose clockIn falls before the start of the week", () => {
    const entries: TimesheetEntry[] = [
      {
        // Sun Jun 28 2026 -> before Mon Jun 29 week start -> excluded
        clockIn: new Date(2026, 5, 28, 9, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 28, 18, 0, 0).toISOString(),
      },
      {
        // In-week Monday entry -> 60 mins, included
        clockIn: new Date(2026, 5, 29, 9, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 29, 10, 0, 0).toISOString(),
      },
    ];
    expect(weekMinutes(entries, now)).toBe(60);
  });

  it("includes an entry that starts exactly at the week boundary (>= start)", () => {
    const entries: TimesheetEntry[] = [
      {
        clockIn: startOfWeek(now).toISOString(), // exactly Mon 00:00
        clockOut: new Date(startOfWeek(now).getTime() + 30 * 60000).toISOString(),
      },
    ];
    expect(weekMinutes(entries, now)).toBe(30);
  });

  it("skips entries with missing/invalid clockIn", () => {
    const entries: TimesheetEntry[] = [
      { clockIn: "", clockOut: new Date(2026, 5, 29, 10, 0, 0).toISOString() },
      { clockIn: "garbage", clockOut: new Date(2026, 5, 29, 10, 0, 0).toISOString() },
      {
        clockIn: new Date(2026, 5, 29, 9, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 29, 9, 45, 0).toISOString(),
      }, // 45, the only valid one
    ];
    expect(weekMinutes(entries, now)).toBe(45);
  });

  it("mixes finished, open, cached, and out-of-week entries correctly", () => {
    const entries: TimesheetEntry[] = [
      // finished cached: 100
      {
        clockIn: new Date(2026, 5, 29, 8, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 29, 9, 0, 0).toISOString(),
        durationMins: 100,
      },
      // finished computed: 30
      {
        clockIn: new Date(2026, 5, 30, 8, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 30, 8, 30, 0).toISOString(),
      },
      // open up to now (clockIn 11:30, now 12:00): 30
      { clockIn: new Date(2026, 6, 1, 11, 30, 0).toISOString(), clockOut: null },
      // out of week: ignored
      {
        clockIn: new Date(2026, 5, 20, 8, 0, 0).toISOString(),
        clockOut: new Date(2026, 5, 20, 18, 0, 0).toISOString(),
      },
    ];
    expect(weekMinutes(entries, now)).toBe(160);
  });

  // Behaviour-invariant test for the default `new Date()` path (no `now` passed):
  // an open entry that started in the past contributes a non-negative duration, and
  // measuring later yields a value at least as large (monotonic with wall clock).
  it("with default now: open entry contributes a non-negative, monotonic duration", () => {
    const startedAgo = new Date(Date.now() - 5 * 60000).toISOString(); // 5 min ago
    const entries: TimesheetEntry[] = [{ clockIn: startedAgo, clockOut: null }];
    const first = weekMinutes(entries);
    expect(first).toBeGreaterThanOrEqual(0);
    const second = weekMinutes(entries);
    expect(second).toBeGreaterThanOrEqual(first);
  });
});

describe("activeEntry", () => {
  it("returns the open entry (clocked in, not out)", () => {
    const open: TimesheetEntry = { id: "open", clockIn: "2026-06-30T09:00:00.000Z", clockOut: null };
    const entries: TimesheetEntry[] = [
      { id: "done", clockIn: "2026-06-29T09:00:00.000Z", clockOut: "2026-06-29T17:00:00.000Z" },
      open,
    ];
    expect(activeEntry(entries)).toBe(open);
  });

  it("returns the FIRST open entry when several are open", () => {
    const first: TimesheetEntry = { id: "a", clockIn: "2026-06-30T08:00:00.000Z" };
    const second: TimesheetEntry = { id: "b", clockIn: "2026-06-30T09:00:00.000Z" };
    expect(activeEntry([first, second])).toBe(first);
  });

  it("treats clockOut === undefined (omitted) as open", () => {
    const open: TimesheetEntry = { id: "x", clockIn: "2026-06-30T09:00:00.000Z" };
    expect(activeEntry([open])).toBe(open);
  });

  it("returns null when every entry is clocked out", () => {
    const entries: TimesheetEntry[] = [
      { clockIn: "2026-06-29T09:00:00.000Z", clockOut: "2026-06-29T17:00:00.000Z" },
      { clockIn: "2026-06-30T09:00:00.000Z", clockOut: "2026-06-30T17:00:00.000Z" },
    ];
    expect(activeEntry(entries)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(activeEntry([])).toBeNull();
  });

  it("returns null for null/undefined input (guarded)", () => {
    expect(activeEntry(null as any)).toBeNull();
    expect(activeEntry(undefined as any)).toBeNull();
  });

  it("ignores entries without a clockIn even if clockOut is missing", () => {
    const entries: TimesheetEntry[] = [
      { clockIn: "" as any }, // no clockIn -> not active
      { clockIn: "2026-06-30T09:00:00.000Z" }, // open -> active
    ];
    expect(activeEntry(entries)?.clockIn).toBe("2026-06-30T09:00:00.000Z");
  });
});
