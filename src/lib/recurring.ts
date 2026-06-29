// @ts-nocheck
// Recurring-maintenance date math — the engine behind generating upcoming
// scheduled visits from a recurring contract's cadence.
//
// Everything here is PURE and DETERMINISTIC: callers pass in the starting
// date (startISO) and any "now" reference as a string. Nothing in this module
// reads the clock (no Date.now() / new Date() with no args), so the same inputs
// always yield the same outputs and it's trivial to unit-test.

export type Cadence = "weekly" | "biweekly" | "monthly";

// YYYY-MM-DD formatter from a Date's UTC fields (avoids TZ drift in the string).
function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse a loose date string into a UTC anchor at midnight. Accepts full ISO
// timestamps ("2026-06-29T12:34:56Z") or bare dates ("2026-06-29"); falls back
// to the epoch only if the input is unparseable (kept deterministic).
function parseAnchor(startISO: string): Date {
  const t = startISO ? Date.parse(startISO) : NaN;
  const base = isNaN(t) ? new Date(0) : new Date(t);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
}

// Map a loose frequency string to a Cadence. Tolerates spacing/casing/hyphens
// ("Bi-Weekly", "every 2 weeks", "weekly", "monthly"). Defaults to "monthly".
export function parseCadence(s?: string): Cadence {
  const v = String(s ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (!v) return "monthly";
  if (v.includes("biweek") || v.includes("everyotherweek") || v.includes("every2week") || v.includes("fortnight")) {
    return "biweekly";
  }
  if (v.includes("week")) return "weekly";
  if (v.includes("month")) return "monthly";
  return "monthly";
}

// Add `n` whole months to a UTC anchor, clamping the day-of-month so e.g.
// Jan 31 + 1 month -> Feb 28/29 rather than rolling into March.
function addMonths(anchor: Date, n: number): Date {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const day = anchor.getUTCDate();
  const target = new Date(Date.UTC(y, m + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)));
}

// Return the next `count` visit dates (YYYY-MM-DD) starting AT startISO, stepped
// by the given cadence. The first returned date is the start date itself.
//   weekly   -> +7 days each step
//   biweekly -> +14 days each step
//   monthly  -> +1 calendar month each step (day-clamped)
export function nextVisitDates(startISO: string, cadence: Cadence, count: number): string[] {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) return [];
  const anchor = parseAnchor(startISO);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (cadence === "monthly") {
      out.push(toISODate(addMonths(anchor, i)));
    } else {
      const stepDays = cadence === "biweekly" ? 14 : 7;
      const d = new Date(anchor.getTime() + i * stepDays * 86400000);
      out.push(toISODate(d));
    }
  }
  return out;
}
