// @ts-nocheck
// Recurring-maintenance date math — the engine behind generating upcoming
// scheduled visits from a recurring contract's cadence.
//
// Everything here is PURE and DETERMINISTIC: callers pass in the starting
// date (startISO) and any "now" reference as a string. Nothing in this module
// reads the clock (no Date.now() / new Date() with no args), so the same inputs
// always yield the same outputs and it's trivial to unit-test.

export type Cadence = "weekly" | "biweekly" | "monthly" | "annually";

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
// ("Bi-Weekly", "every 2 weeks", "weekly", "monthly", "Annually"). Defaults to "monthly".
export function parseCadence(s?: string): Cadence {
  const v = String(s ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (!v) return "monthly";
  if (v.includes("biweek") || v.includes("everyotherweek") || v.includes("every2week") || v.includes("fortnight")) {
    return "biweekly";
  }
  if (v.includes("annual") || v.includes("yearly") || v.includes("year")) return "annually";
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

// Add `n` whole years to a UTC anchor, clamping the day-of-month so e.g.
// Feb 29 + 1 year -> Feb 28 rather than rolling into March (leap-year safe).
function addYears(anchor: Date, n: number): Date {
  return addMonths(anchor, n * 12);
}

// Step a UTC anchor forward by `i` cadence intervals (i=0 returns the anchor).
function stepFromAnchor(anchor: Date, cadence: Cadence, i: number): Date {
  if (cadence === "monthly") return addMonths(anchor, i);
  if (cadence === "annually") return addYears(anchor, i);
  const stepDays = cadence === "biweekly" ? 14 : 7;
  return new Date(anchor.getTime() + i * stepDays * 86400000);
}

// Return the next `count` visit dates (YYYY-MM-DD) starting AT startISO, stepped
// by the given cadence. The first returned date is the start date itself.
//   weekly   -> +7 days each step
//   biweekly -> +14 days each step
//   monthly  -> +1 calendar month each step (day-clamped)
//   annually -> +1 calendar year each step (day-clamped)
export function nextVisitDates(startISO: string, cadence: Cadence, count: number): string[] {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) return [];
  const anchor = parseAnchor(startISO);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(toISODate(stepFromAnchor(anchor, cadence, i)));
  }
  return out;
}

// Like nextVisitDates, but stops once a generated date would pass endISO
// (inclusive) when an end date is provided, and is capped at maxCount.
// Pure/deterministic — no clock reads. A blank/unparseable endISO means
// "no end" (behaves like nextVisitDates capped at maxCount).
export function visitDatesUntil(
  startISO: string,
  cadence: Cadence,
  endISO: string | null,
  maxCount: number
): string[] {
  const cap = Math.max(0, Math.floor(Number(maxCount) || 0));
  if (cap === 0) return [];
  const anchor = parseAnchor(startISO);
  const endT = endISO ? Date.parse(endISO) : NaN;
  const endAnchor = isNaN(endT) ? null : parseAnchor(endISO!);
  const out: string[] = [];
  for (let i = 0; i < cap; i++) {
    const d = stepFromAnchor(anchor, cadence, i);
    if (endAnchor && d.getTime() > endAnchor.getTime()) break;
    out.push(toISODate(d));
  }
  return out;
}

// Approximate the per-visit price from a contract's monthly recurring revenue.
// weekly  ≈ mrr / 4.33  (avg weeks per month)
// biweekly≈ mrr / 2.17  (avg bi-weeks per month)
// monthly ≈ mrr         (one visit per month)
// annually≈ mrr * 12    (one visit per year covers a year of MRR)
// Rounds to 2 decimals; mrr <= 0 (or non-finite) yields 0.
export function pricePerVisitFromMrr(mrr: number, cadence: Cadence): number {
  const m = Number(mrr);
  if (!isFinite(m) || m <= 0) return 0;
  let raw: number;
  switch (cadence) {
    case "weekly": raw = m / 4.33; break;
    case "biweekly": raw = m / 2.17; break;
    case "annually": raw = m * 12; break;
    case "monthly":
    default: raw = m; break;
  }
  return Math.round(raw * 100) / 100;
}
