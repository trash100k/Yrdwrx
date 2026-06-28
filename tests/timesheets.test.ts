// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { minutesBetween, formatDuration, startOfWeek, weekMinutes, activeEntry } from '../src/lib/timesheets';

describe('timesheets helpers', () => {
  it('minutesBetween computes whole minutes and guards bad input', () => {
    expect(minutesBetween('2026-06-28T09:00:00Z', '2026-06-28T10:30:00Z')).toBe(90);
    expect(minutesBetween('2026-06-28T10:00:00Z', '2026-06-28T09:00:00Z')).toBe(0); // negative
    expect(minutesBetween(null, '2026-06-28T10:00:00Z')).toBe(0);
    expect(minutesBetween('bad', 'worse')).toBe(0);
  });

  it('formatDuration renders h/m', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h 0m');
    expect(formatDuration(135)).toBe('2h 15m');
  });

  it('startOfWeek is Monday 00:00', () => {
    // 2026-06-28 is a Sunday → week starts Mon 2026-06-22.
    const s = startOfWeek(new Date('2026-06-28T15:00:00'));
    expect(s.getDay()).toBe(1); // Monday
    expect(s.getHours()).toBe(0);
  });

  it('weekMinutes sums finished + open entries within the week, ignores older', () => {
    const now = new Date('2026-06-25T12:00:00'); // a Thursday
    const wkStart = startOfWeek(now);
    const inWeek = new Date(wkStart.getTime() + 60 * 60000); // Monday 01:00
    const lastWeek = new Date(wkStart.getTime() - 24 * 60 * 60000); // before week
    const entries = [
      { clockIn: inWeek.toISOString(), clockOut: new Date(inWeek.getTime() + 120 * 60000).toISOString(), durationMins: 120 },
      { clockIn: lastWeek.toISOString(), clockOut: new Date(lastWeek.getTime() + 300 * 60000).toISOString(), durationMins: 300 },
      { clockIn: new Date(now.getTime() - 30 * 60000).toISOString(), clockOut: null }, // open, 30m ago
    ];
    const total = weekMinutes(entries, now);
    expect(total).toBe(150); // 120 finished (in week) + 30 open; last week excluded
  });

  it('activeEntry returns the open entry', () => {
    const entries = [
      { clockIn: 'a', clockOut: 'b' },
      { clockIn: 'c', clockOut: null },
    ];
    expect(activeEntry(entries)?.clockIn).toBe('c');
    expect(activeEntry([{ clockIn: 'x', clockOut: 'y' }])).toBeNull();
  });
});
