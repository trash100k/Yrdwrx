// @ts-nocheck
// Property-based (fast-check) tests for YardWorx's money + date math seams.
//
// These COMPLEMENT the example-based suites (deposit.test.ts, usageLedger.test.ts,
// payroll.test.ts, recurring.test.ts, takeoff.test.ts). Where those pin down specific
// documented numbers, these assert the *invariants* that must hold across the whole input
// space — the cents-exactness, non-negativity, clamping, monotonicity and conservation
// laws the billing/scheduling pipeline depends on. Everything imported here is a real,
// pure lib (no mocks): the properties exercise the production code directly.

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { computeDeposit } from "./deposit";
import {
  METERS,
  emptyRollup,
  applyUsage,
  computeOverage,
  projectBill,
  withinSpendCap,
  type Allotments,
  type Rates,
  type Meter,
} from "./usageLedger";
import { summarizePayroll, type PayrollOptions } from "./payroll";
import type { TimesheetEntry } from "./timesheets";
import { nextVisitDates, visitDatesUntil, pricePerVisitFromMrr } from "./recurring";
import { sqftToQuantities, estimateLineItems, type Measurement } from "./takeoff";

// ---------------------------------------------------------------------------
// Shared helpers / arbitraries
// ---------------------------------------------------------------------------

const RUNS = { numRuns: 300 };

/** Round to cents exactly the way the libs do (single sanitisation rule). */
const toCents = (n: number): number => Math.round(n * 100) / 100;
/** Round to 2dp exactly the way payroll.ts does (hours precision). */
const round2 = (n: number): number => Math.round(n * 100) / 100;
/** A value is "cents-exact" when it is a whole number of cents. */
const isCentsExact = (n: number): boolean =>
  Math.abs(n * 100 - Math.round(n * 100)) < 1e-5;

/** Cents-exact dollar amount in [0, $1,000,000] — how money actually flows through the app. */
const dollars = fc.nat({ max: 100_000_000 }).map((c) => c / 100);
/** Cents-exact dollar amount that clears the Stripe floor and stays modest. */
const dollarsAtLeast1 = fc.integer({ min: 100, max: 100_000_000 }).map((c) => c / 100);
/** Integer cents (the unit usageLedger bills in). */
const cents = fc.nat({ max: 100_000_000 });
/** Deliberately hostile numeric inputs for "never crashes / never NaN-out" fuzzing. */
const messyNumber = fc.oneof(
  fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -0, null, undefined),
);
/**
 * Same hostile space but WITHOUT ±Infinity — used for computeDeposit's `total` arg.
 * deposit.ts sanitises its total with `Number(total) || 0`, which coerces NaN/null/
 * undefined/-Infinity to 0 but lets +Infinity through (see the skipped BUG test below).
 * NaN and negatives are still exercised here.
 */
const messyFiniteNumber = fc.oneof(
  fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.constantFrom(NaN, 0, -0, null, undefined),
);

// ===========================================================================
// deposit.ts — computeDeposit
// ===========================================================================
describe("property: computeDeposit", () => {
  it("amount is always non-negative, finite and cents-exact; required <=> amount>0", () => {
    fc.assert(
      fc.property(
        // Total excludes ±Infinity (that unhandled case is pinned by the skipped BUG test below);
        // the flat-amount and pct configs still get the full hostile space (both ARE guarded).
        messyFiniteNumber,
        fc.option(messyNumber, { nil: undefined }),
        fc.option(messyNumber, { nil: undefined }),
        (total, depositAmount, depositPct) => {
          const r = computeDeposit(total as number, { depositAmount, depositPct } as any);
          expect(Number.isFinite(r.amount)).toBe(true);
          expect(r.amount).toBeGreaterThanOrEqual(0);
          expect(isCentsExact(r.amount)).toBe(true);
          // The single source of truth: a chargeable deposit is exactly a positive amount.
          expect(r.required).toBe(r.amount > 0);
          // Stripe floor: a required deposit always clears $0.50; otherwise it is exactly 0.
          if (r.required) expect(r.amount).toBeGreaterThanOrEqual(0.5);
          else expect(r.amount).toBe(0);
          // pct is an integer percentage.
          expect(Number.isInteger(r.pct)).toBe(true);
          expect(r.pct).toBeGreaterThanOrEqual(0);
        },
      ),
      RUNS,
    );
  });

  it("never charges more than the (cents-exact) total, and pct stays in [0,100]", () => {
    fc.assert(
      fc.property(dollars, fc.integer({ min: 0, max: 300 }), (total, pct) => {
        const r = computeDeposit(total, { depositPct: pct });
        expect(r.amount).toBeLessThanOrEqual(total + 1e-9);
        expect(r.pct).toBeLessThanOrEqual(100);
        expect(r.pct).toBeGreaterThanOrEqual(0);
      }),
      RUNS,
    );
  });

  it("a flat depositAmount in [$0.50, total] wins over any pct and is charged exactly", () => {
    fc.assert(
      fc.property(
        dollarsAtLeast1,
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (total, pct, frac) => {
          // Pick a cents-exact flat amount somewhere in [0.50, total].
          const flat = toCents(Math.max(0.5, Math.min(total, 0.5 + frac * (total - 0.5))));
          const r = computeDeposit(total, { depositAmount: flat, depositPct: pct });
          expect(r.amount).toBe(flat);
          expect(r.required).toBe(true);
        },
      ),
      RUNS,
    );
  });

  it("a 100% pct (or flat == total) charges the entire total", () => {
    fc.assert(
      fc.property(dollarsAtLeast1, (total) => {
        expect(computeDeposit(total, { depositPct: 100 }).amount).toBe(total);
        expect(computeDeposit(total, { depositAmount: total }).amount).toBe(total);
      }),
      RUNS,
    );
  });

  it("deposit amount is monotonic non-decreasing in pct (fixed total)", () => {
    fc.assert(
      fc.property(
        dollarsAtLeast1,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (total, a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const loAmt = computeDeposit(total, { depositPct: lo }).amount;
          const hiAmt = computeDeposit(total, { depositPct: hi }).amount;
          expect(loAmt).toBeLessThanOrEqual(hiAmt + 1e-9);
        },
      ),
      RUNS,
    );
  });

  it("deposit amount is monotonic non-decreasing in total (fixed pct)", () => {
    fc.assert(
      fc.property(
        dollars,
        fc.nat({ max: 100_000_000 }).map((c) => c / 100),
        fc.integer({ min: 1, max: 100 }),
        (t1, t2, pct) => {
          const lo = Math.min(t1, t2);
          const hi = Math.max(t1, t2);
          const loAmt = computeDeposit(lo, { depositPct: pct }).amount;
          const hiAmt = computeDeposit(hi, { depositPct: pct }).amount;
          expect(loAmt).toBeLessThanOrEqual(hiAmt + 1e-9);
        },
      ),
      RUNS,
    );
  });

  // BUG: computeDeposit(+Infinity, {depositPct>0}) returns {amount: Infinity, pct: NaN} — a
  // non-finite charge amount. deposit.ts sanitises the total with `Number(total) || 0`, which
  // lets +Infinity through (NaN/null/undefined/-Infinity are all correctly coerced to 0). Its
  // sibling money libs (usageLedger.ts, takeoff.ts) reject non-finite via `Number.isFinite`.
  // Correct behavior: a non-finite total should yield a finite, non-NaN result (amount 0).
  it("a +Infinity total sanitises to a finite result, not amount:Infinity/pct:NaN", () => {
    const r = computeDeposit(Infinity as unknown as number, { depositPct: 25 });
    expect(Number.isFinite(r.amount)).toBe(true);
    expect(Number.isNaN(r.pct)).toBe(false);
    expect(r.amount).toBe(0); // no chargeable deposit derivable from an infinite total
  });
});

// ===========================================================================
// usageLedger.ts — computeOverage / projectBill / withinSpendCap / applyUsage
// ===========================================================================

const usageArb = fc.record({
  ai: fc.nat({ max: 1_000_000 }),
  sms: fc.nat({ max: 1_000_000 }),
  live_min: fc.double({ min: 0, max: 100_000, noNaN: true, noDefaultInfinity: true }),
  aerial: fc.nat({ max: 1_000_000 }),
  pdf: fc.nat({ max: 1_000_000 }),
}) as fc.Arbitrary<Record<Meter, number>>;

const allotArb = fc.record({
  seats: fc.nat({ max: 100 }),
  ai: fc.nat({ max: 1_000_000 }),
  sms: fc.nat({ max: 1_000_000 }),
  live_min: fc.nat({ max: 100_000 }),
  aerial: fc.nat({ max: 1_000_000 }),
  pdf: fc.nat({ max: 1_000_000 }),
}) as fc.Arbitrary<Allotments>;

const ratesArb = fc.record({
  ai: fc.nat({ max: 10_000 }),
  sms: fc.nat({ max: 10_000 }),
  live_min: fc.nat({ max: 10_000 }),
  aerial: fc.nat({ max: 10_000 }),
  pdf: fc.nat({ max: 10_000 }),
}) as fc.Arbitrary<Rates>;

describe("property: computeOverage", () => {
  it("over = max(0, usage-allot) and cents = round(over*rate) per meter; total = sum", () => {
    fc.assert(
      fc.property(usageArb, allotArb, ratesArb, (usage, allot, rates) => {
        const res = computeOverage(usage, allot, rates);
        let sum = 0;
        for (const m of METERS) {
          const expectedOver = Math.max(0, usage[m] - allot[m]);
          const expectedCents = Math.round(expectedOver * rates[m]);
          expect(res.perMeter[m].over).toBeCloseTo(expectedOver, 9);
          expect(res.perMeter[m].cents).toBe(expectedCents);
          expect(res.perMeter[m].over).toBeGreaterThanOrEqual(0);
          expect(res.perMeter[m].cents).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(res.perMeter[m].cents)).toBe(true);
          sum += expectedCents;
        }
        expect(res.overageCents).toBe(sum);
        expect(res.overageCents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(res.overageCents)).toBe(true);
      }),
      RUNS,
    );
  });

  it("is monotonic non-decreasing in usage (more usage never lowers the bill)", () => {
    fc.assert(
      fc.property(usageArb, usageArb, allotArb, ratesArb, (u1, delta, allot, rates) => {
        const u2 = emptyRollup();
        for (const m of METERS) u2[m] = u1[m] + delta[m]; // delta >= 0 componentwise
        const lo = computeOverage(u1, allot, rates).overageCents;
        const hi = computeOverage(u2, allot, rates).overageCents;
        expect(hi).toBeGreaterThanOrEqual(lo);
      }),
      RUNS,
    );
  });

  it("is monotonic non-increasing in allotment (a bigger bundle never raises the bill)", () => {
    fc.assert(
      fc.property(usageArb, allotArb, allotArb, ratesArb, (usage, allot1, bump, rates) => {
        const allot2 = { ...allot1 };
        for (const m of METERS) allot2[m] = allot1[m] + bump[m]; // >= allot1 per meter
        const withSmall = computeOverage(usage, allot1, rates).overageCents;
        const withBig = computeOverage(usage, allot2, rates).overageCents;
        expect(withBig).toBeLessThanOrEqual(withSmall);
      }),
      RUNS,
    );
  });

  it("is monotonic non-decreasing in rate (a higher price never lowers the bill)", () => {
    fc.assert(
      fc.property(usageArb, allotArb, ratesArb, ratesArb, (usage, allot, r1, bump) => {
        const r2 = { ...r1 };
        for (const m of METERS) r2[m] = r1[m] + bump[m];
        const lo = computeOverage(usage, allot, r1).overageCents;
        const hi = computeOverage(usage, allot, r2).overageCents;
        expect(hi).toBeGreaterThanOrEqual(lo);
      }),
      RUNS,
    );
  });
});

describe("property: projectBill", () => {
  it("total = base + seats + overage; seats = max(0,extra)*seatCents; all >=0 integers", () => {
    fc.assert(
      fc.property(
        cents,
        fc.nat({ max: 200 }),
        fc.nat({ max: 200 }),
        fc.nat({ max: 50_000 }),
        cents,
        (base, seats, included, seatCents, overage) => {
          const bill = projectBill(base, seats, included, seatCents, overage);
          const extra = Math.max(0, Math.floor(seats) - Math.floor(included));
          expect(bill.seatsCents).toBe(extra * seatCents);
          expect(bill.totalCents).toBe(base + extra * seatCents + overage);
          // Conservation: the total is exactly its three parts, none of which are negative.
          expect(bill.seatsCents).toBeGreaterThanOrEqual(0);
          expect(bill.totalCents).toBeGreaterThanOrEqual(base); // seats+overage >= 0
          expect(Number.isInteger(bill.seatsCents)).toBe(true);
          expect(Number.isInteger(bill.totalCents)).toBe(true);
        },
      ),
      RUNS,
    );
  });

  it("charges nothing for seats when seats <= includedSeats", () => {
    fc.assert(
      fc.property(
        cents,
        fc.nat({ max: 200 }),
        fc.nat({ max: 50 }),
        fc.nat({ max: 50_000 }),
        cents,
        (base, seats, includeBump, seatCents, over) => {
          // included = seats + includeBump >= seats guarantees no extra seats.
          const bill = projectBill(base, seats, seats + includeBump, seatCents, over);
          expect(bill.seatsCents).toBe(0);
        },
      ),
      RUNS,
    );
  });

  it("total is monotonic non-decreasing in seats and in overage", () => {
    fc.assert(
      fc.property(
        cents,
        fc.nat({ max: 200 }),
        fc.nat({ max: 50 }),
        fc.nat({ max: 200 }),
        fc.nat({ max: 50_000 }),
        cents,
        fc.nat({ max: 1_000_000 }),
        (base, seats, seatBump, included, seatCents, over, overBump) => {
          const lowSeats = projectBill(base, seats, included, seatCents, over).totalCents;
          const highSeats = projectBill(base, seats + seatBump, included, seatCents, over).totalCents;
          expect(highSeats).toBeGreaterThanOrEqual(lowSeats);

          const lowOver = projectBill(base, seats, included, seatCents, over).totalCents;
          const highOver = projectBill(base, seats, included, seatCents, over + overBump).totalCents;
          expect(highOver).toBeGreaterThanOrEqual(lowOver);
        },
      ),
      RUNS,
    );
  });
});

describe("property: withinSpendCap", () => {
  it("with a real cap: passes iff current+add <= cap (clean non-negative cents)", () => {
    fc.assert(
      fc.property(cents, cents, cents, (current, add, cap) => {
        expect(withinSpendCap(current, add, cap)).toBe(current + add <= cap);
      }),
      RUNS,
    );
  });

  it("a null cap always allows the add (unlimited)", () => {
    fc.assert(
      fc.property(messyNumber, messyNumber, (current, add) => {
        expect(withinSpendCap(current as number, add as number, null)).toBe(true);
      }),
      RUNS,
    );
  });

  it("is monotonic in add: once it fails, a larger add also fails (fixed current/cap)", () => {
    fc.assert(
      fc.property(cents, cents, cents, cents, (current, add, addBump, cap) => {
        const small = withinSpendCap(current, add, cap);
        const big = withinSpendCap(current, add + addBump, cap);
        // A larger add can only stay the same or flip true->false, never false->true.
        if (!small) expect(big).toBe(false);
        if (big) expect(small).toBe(true);
      }),
      RUNS,
    );
  });
});

describe("property: applyUsage", () => {
  it("adds sanitized qty to the meter, keeps all keys non-negative, and never mutates input", () => {
    fc.assert(
      fc.property(usageArb, fc.constantFrom(...METERS), fc.nat({ max: 1_000_000 }), (rollup, meter, qty) => {
        const before = { ...rollup };
        const out = applyUsage(rollup, meter, qty);
        expect(rollup).toEqual(before); // input untouched
        expect(out).not.toBe(rollup);
        for (const m of METERS) {
          expect(out[m]).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(out[m])).toBe(true);
        }
        // The targeted meter grew by exactly qty (both inputs already clean & non-negative).
        expect(out[meter]).toBeCloseTo(rollup[meter] + qty, 9);
      }),
      RUNS,
    );
  });
});

// ===========================================================================
// payroll.ts — summarizePayroll (OT split conserves minutes)
// ===========================================================================

// Build a valid, in-range ISO clockIn from a small day offset off a fixed anchor.
const clockInAt = (dayOffset: number): string =>
  new Date(Date.UTC(2026, 0, 1) + dayOffset * 86_400_000).toISOString();
const OPEN_RANGE: PayrollOptions = { startISO: "", endISO: "" }; // open both sides -> includes all

describe("property: summarizePayroll", () => {
  it("regular + OT hours conserve the total worked minutes (nothing lost or invented)", () => {
    const closedEntry = fc.record({
      dayOffset: fc.integer({ min: 0, max: 400 }),
      durationMins: fc.nat({ max: 6000 }), // up to 100h across the range
    });
    fc.assert(
      fc.property(fc.array(closedEntry, { minLength: 1, maxLength: 20 }), (rows) => {
        const entries: TimesheetEntry[] = rows.map((r) => {
          const ci = clockInAt(r.dayOffset);
          return { userId: "u1", userName: "Alice", clockIn: ci, clockOut: ci, durationMins: r.durationMins };
        });
        const totalMins = rows.reduce((s, r) => s + r.durationMins, 0);
        const lines = summarizePayroll(entries, OPEN_RANGE);
        expect(lines).toHaveLength(1);
        const line = lines[0];
        expect(line.regularHours).toBeGreaterThanOrEqual(0);
        expect(line.otHours).toBeGreaterThanOrEqual(0);
        // reg+ot (in minutes) equals the input minutes, within the two independent 2dp roundings.
        expect(Math.abs(line.regularHours + line.otHours - totalMins / 60)).toBeLessThanOrEqual(0.011);
        expect(line.totalHours).toBe(round2(line.regularHours + line.otHours));
        expect(line.shifts).toBe(rows.length);
      }),
      RUNS,
    );
  });

  it("splits a single week at the OT threshold: below -> all regular, above -> reg capped at threshold", () => {
    fc.assert(
      fc.property(fc.nat({ max: 8000 }), fc.integer({ min: 1, max: 80 }), (durationMins, thresholdHours) => {
        const ci = clockInAt(10);
        const entries: TimesheetEntry[] = [
          { userId: "u1", userName: "Alice", clockIn: ci, clockOut: ci, durationMins },
        ];
        const [line] = summarizePayroll(entries, { ...OPEN_RANGE, otWeeklyThreshold: thresholdHours });
        const thresholdMins = thresholdHours * 60;
        if (durationMins <= thresholdMins) {
          expect(line.otHours).toBe(0);
          expect(line.regularHours).toBe(round2(durationMins / 60));
        } else {
          expect(line.regularHours).toBe(thresholdHours); // capped at the weekly threshold
          expect(line.otHours).toBe(round2((durationMins - thresholdMins) / 60));
        }
      }),
      RUNS,
    );
  });

  it("counts every in-range clock-in as a shift; open shifts add 0 payable hours", () => {
    const anyEntry = fc.record({
      dayOffset: fc.integer({ min: 0, max: 400 }),
      durationMins: fc.nat({ max: 4000 }),
      open: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(anyEntry, { minLength: 1, maxLength: 15 }), (rows) => {
        const entries: TimesheetEntry[] = rows.map((r) => {
          const ci = clockInAt(r.dayOffset);
          return {
            userId: "u1",
            userName: "Alice",
            clockIn: ci,
            clockOut: r.open ? null : ci,
            durationMins: r.durationMins,
          };
        });
        const closedMins = rows.filter((r) => !r.open).reduce((s, r) => s + r.durationMins, 0);
        const [line] = summarizePayroll(entries, OPEN_RANGE);
        expect(line.shifts).toBe(rows.length); // open + closed all count as shifts
        // Only closed shifts contribute payable minutes.
        expect(Math.abs(line.regularHours + line.otHours - closedMins / 60)).toBeLessThanOrEqual(0.011);
      }),
      RUNS,
    );
  });
});

// ===========================================================================
// recurring.ts — nextVisitDates / visitDatesUntil / pricePerVisitFromMrr
// ===========================================================================

const startISOArb = fc
  .date({ min: new Date(Date.UTC(2000, 0, 1)), max: new Date(Date.UTC(2100, 0, 1)), noInvalidDate: true })
  .map((d) => d.toISOString());
const cadenceArb = fc.constantFrom("weekly", "biweekly", "monthly", "annually") as fc.Arbitrary<
  "weekly" | "biweekly" | "monthly" | "annually"
>;
const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;

describe("property: nextVisitDates", () => {
  it("returns exactly `count` strictly-increasing, well-formed YYYY-MM-DD dates", () => {
    fc.assert(
      fc.property(startISOArb, cadenceArb, fc.integer({ min: 0, max: 60 }), (start, cadence, count) => {
        const out = nextVisitDates(start, cadence, count);
        expect(out).toHaveLength(count);
        for (const d of out) expect(d).toMatch(isoDateRe);
        for (let i = 1; i < out.length; i++) {
          // Lexical order on ISO dates == chronological order; each step advances.
          expect(out[i] > out[i - 1]).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it("weekly/biweekly steps are exactly 7/14 days apart", () => {
    fc.assert(
      fc.property(
        startISOArb,
        fc.constantFrom("weekly", "biweekly") as fc.Arbitrary<"weekly" | "biweekly">,
        fc.integer({ min: 2, max: 40 }),
        (start, cadence, count) => {
          const out = nextVisitDates(start, cadence, count);
          const stepDays = cadence === "biweekly" ? 14 : 7;
          for (let i = 1; i < out.length; i++) {
            const diff = (Date.parse(out[i] + "T00:00:00Z") - Date.parse(out[i - 1] + "T00:00:00Z")) / 86_400_000;
            expect(diff).toBe(stepDays);
          }
        },
      ),
      RUNS,
    );
  });

  it("floors/guards count: negative or fractional counts never over-produce", () => {
    fc.assert(
      fc.property(startISOArb, cadenceArb, fc.double({ min: -50, max: 60, noNaN: true, noDefaultInfinity: true }), (start, cadence, count) => {
        const out = nextVisitDates(start, cadence, count);
        const expected = Math.max(0, Math.floor(count));
        expect(out).toHaveLength(expected);
      }),
      RUNS,
    );
  });
});

describe("property: visitDatesUntil", () => {
  it("is the prefix of nextVisitDates(...,maxCount) whose dates are <= endISO", () => {
    fc.assert(
      fc.property(startISOArb, cadenceArb, startISOArb, fc.integer({ min: 0, max: 60 }), (start, cadence, end, max) => {
        const capped = nextVisitDates(start, cadence, max);
        // The lib's cutoff is by the end date's midnight (its YYYY-MM-DD), so filter on that.
        const endDateStr = end.slice(0, 10);
        const expected = capped.filter((d) => d <= endDateStr);
        const actual = visitDatesUntil(start, cadence, end, max);
        expect(actual).toEqual(expected);
        expect(actual.length).toBeLessThanOrEqual(max);
        for (const d of actual) expect(d <= endDateStr).toBe(true);
      }),
      RUNS,
    );
  });

  it("a null/blank end date behaves exactly like nextVisitDates capped at maxCount", () => {
    fc.assert(
      fc.property(startISOArb, cadenceArb, fc.integer({ min: 0, max: 40 }), (start, cadence, max) => {
        expect(visitDatesUntil(start, cadence, null, max)).toEqual(nextVisitDates(start, cadence, max));
      }),
      RUNS,
    );
  });
});

describe("property: pricePerVisitFromMrr", () => {
  it("is non-negative and ordered weekly <= biweekly <= monthly <= annually for the same MRR", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }), (mrr) => {
        const w = pricePerVisitFromMrr(mrr, "weekly");
        const b = pricePerVisitFromMrr(mrr, "biweekly");
        const m = pricePerVisitFromMrr(mrr, "monthly");
        const a = pricePerVisitFromMrr(mrr, "annually");
        for (const v of [w, b, m, a]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(isCentsExact(v)).toBe(true);
        }
        expect(w).toBeLessThanOrEqual(b + 1e-9);
        expect(b).toBeLessThanOrEqual(m + 1e-9);
        expect(m).toBeLessThanOrEqual(a + 1e-9);
      }),
      RUNS,
    );
  });

  it("returns 0 for any non-positive or non-finite MRR", () => {
    fc.assert(
      fc.property(cadenceArb, fc.constantFrom(0, -0, -1, -1e6, NaN, Infinity, -Infinity), (cadence, mrr) => {
        expect(pricePerVisitFromMrr(mrr as number, cadence)).toBe(0);
      }),
      RUNS,
    );
  });
});

// ===========================================================================
// takeoff.ts — sqftToQuantities / estimateLineItems
// ===========================================================================

const sqftArb = fc.nat({ max: 5_000_000 }); // whole square feet, up to a very large lot

describe("property: sqftToQuantities", () => {
  it("never emits NaN/negative for ANY (even hostile) measurement", () => {
    fc.assert(
      fc.property(
        fc.record({ lawnSqft: messyNumber, bedSqft: messyNumber, hardscapeSqft: messyNumber, lotSqft: messyNumber }),
        fc.option(fc.record({ mulchDepthInches: messyNumber }), { nil: undefined }),
        (m, opts) => {
          const q = sqftToQuantities(m as Measurement, opts as any);
          for (const v of Object.values(q)) {
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      RUNS,
    );
  });

  it("turf quantities scale monotonically with lawn; bed quantities with beds", () => {
    fc.assert(
      fc.property(sqftArb, sqftArb, sqftArb, sqftArb, (lawn, lawnBump, bed, bedBump) => {
        const lo = sqftToQuantities({ lawnSqft: lawn, bedSqft: bed });
        const moreLawn = sqftToQuantities({ lawnSqft: lawn + lawnBump, bedSqft: bed });
        const moreBed = sqftToQuantities({ lawnSqft: lawn, bedSqft: bed + bedBump });

        // More lawn -> more (or equal) seed/fertilizer/sod.
        expect(moreLawn.seedLbs).toBeGreaterThanOrEqual(lo.seedLbs);
        expect(moreLawn.fertilizerLbs).toBeGreaterThanOrEqual(lo.fertilizerLbs);
        expect(moreLawn.sodSqft).toBeGreaterThanOrEqual(lo.sodSqft);
        // More bed -> more (or equal) mulch/edging.
        expect(moreBed.mulchCubicYards).toBeGreaterThanOrEqual(lo.mulchCubicYards);
        expect(moreBed.edgingLinearFtEstimate).toBeGreaterThanOrEqual(lo.edgingLinearFtEstimate);
      }),
      RUNS,
    );
  });

  it("lawn and bed drive independent materials (changing one leaves the other's outputs fixed)", () => {
    fc.assert(
      fc.property(sqftArb, sqftArb, sqftArb, (lawn, bed1, bed2) => {
        const a = sqftToQuantities({ lawnSqft: lawn, bedSqft: bed1 });
        const b = sqftToQuantities({ lawnSqft: lawn, bedSqft: bed2 });
        // Turf outputs depend only on lawn, so they must be identical across differing beds.
        expect(a.seedLbs).toBe(b.seedLbs);
        expect(a.fertilizerLbs).toBe(b.fertilizerLbs);
        expect(a.sodSqft).toBe(b.sodSqft);
      }),
      RUNS,
    );
  });

  it("fertilizer >= seed (5 vs 4 lb/1k) and sod >= lawn (5% waste) for whole-sqft lawns", () => {
    fc.assert(
      fc.property(sqftArb, (lawn) => {
        const q = sqftToQuantities({ lawnSqft: lawn });
        expect(q.fertilizerLbs).toBeGreaterThanOrEqual(q.seedLbs);
        expect(q.sodSqft).toBeGreaterThanOrEqual(lawn);
      }),
      RUNS,
    );
  });

  it("deeper mulch never orders less mulch (monotonic in depth)", () => {
    fc.assert(
      fc.property(
        sqftArb,
        fc.double({ min: 0.5, max: 12, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 12, noNaN: true, noDefaultInfinity: true }),
        (bed, depth, bump) => {
          const shallow = sqftToQuantities({ bedSqft: bed }, { mulchDepthInches: depth });
          const deep = sqftToQuantities({ bedSqft: bed }, { mulchDepthInches: depth + bump });
          expect(deep.mulchCubicYards).toBeGreaterThanOrEqual(shallow.mulchCubicYards);
        },
      ),
      RUNS,
    );
  });
});

describe("property: estimateLineItems", () => {
  const rateArb = fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true });

  it("only emits lines with positive qty AND rate; amount = round(qty*rate) cents, >= 0", () => {
    fc.assert(
      fc.property(sqftArb, sqftArb, rateArb, rateArb, rateArb, (lawn, bed, mow, mulch, sod) => {
        const m: Measurement = { lawnSqft: lawn, bedSqft: bed };
        const q = sqftToQuantities(m);
        const lines = estimateLineItems(m, { mowPerSqft: mow, mulchPerYard: mulch, sodPerSqft: sod });
        expect(lines.length).toBeLessThanOrEqual(3);
        for (const line of lines) {
          expect(line.quantity).toBeGreaterThan(0);
          expect(line.rate).toBeGreaterThan(0);
          expect(line.amount).toBeGreaterThanOrEqual(0);
          expect(line.amount).toBe(toCents(line.quantity * line.rate));
          expect(isCentsExact(line.amount)).toBe(true);
        }
        // Emitted quantities must agree with the material order (single source of truth).
        const byDesc = Object.fromEntries(lines.map((l) => [l.description, l.quantity]));
        if ("Lawn mowing" in byDesc) expect(byDesc["Lawn mowing"]).toBe(lawn);
        if ("Mulch installation" in byDesc) expect(byDesc["Mulch installation"]).toBe(q.mulchCubicYards);
        if ("Sod installation" in byDesc) expect(byDesc["Sod installation"]).toBe(q.sodSqft);
      }),
      RUNS,
    );
  });

  it("line amount is monotonic non-decreasing in its unit rate", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (lawn, rate, bump) => {
          const lo = estimateLineItems({ lawnSqft: lawn }, { mowPerSqft: rate });
          const hi = estimateLineItems({ lawnSqft: lawn }, { mowPerSqft: rate + bump });
          const loAmt = lo.find((l) => l.description === "Lawn mowing")?.amount ?? 0;
          const hiAmt = hi.find((l) => l.description === "Lawn mowing")?.amount ?? 0;
          expect(hiAmt).toBeGreaterThanOrEqual(loAmt);
        },
      ),
      RUNS,
    );
  });
});
