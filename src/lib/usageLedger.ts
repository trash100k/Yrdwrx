/**
 * usageLedger — pure metering + overage math for YardWorx's
 * base + per-seat + usage-metered billing model.
 *
 * Backs the `feat-usage-billing` work described in `PRICING_STRATEGY.md`:
 * a fixed monthly base bundles a number of seats and a monthly allotment of
 * every metered resource; extra seats are per-seat add-ons; usage past the
 * bundled allotment meters at a per-unit overage rate; a per-tenant spend cap
 * bounds bill shock.
 *
 * Design contract (do not violate — the billing pipeline depends on it):
 *  - Pure, deterministic, side-effect free. No I/O, no clock, no randomness,
 *    no imports of server/React/Firebase. Every input is passed in.
 *  - All money is integer cents. Rates are "cents per unit" of overage.
 *  - Every public function is defensive: non-finite (NaN/Infinity), negative,
 *    null/undefined and missing values are coerced to a safe 0 rather than
 *    poisoning a downstream total. Spend-cap checks fail *closed*.
 *  - "Unlimited" allotments (e.g. Pro PDF renders) are modelled by the caller
 *    passing a large finite allotment (the soft cap), never Infinity.
 */

/** Every metered resource. Order is stable and used for iteration. */
export const METERS = ['ai', 'sms', 'live_min', 'aerial', 'pdf'] as const;

/** A single metered resource key. */
export type Meter = (typeof METERS)[number];

/** Monthly bundle: seats plus one allotment per metered resource (in units). */
export interface Allotments {
  seats: number;
  ai: number;
  sms: number;
  live_min: number;
  aerial: number;
  pdf: number;
}

/** Per-unit overage price for each meter, in integer cents per unit. */
export interface Rates {
  ai: number;
  sms: number;
  live_min: number;
  aerial: number;
  pdf: number;
}

/** Running per-meter usage tally (units consumed this period). */
export type UsageRollup = Record<Meter, number>;

/** Overage for one meter: units over allotment and the cents owed for them. */
export interface MeterOverage {
  /** Units consumed above the allotment (>= 0; may be fractional, e.g. live_min). */
  over: number;
  /** Integer cents owed for the overage on this meter. */
  cents: number;
}

/** Full overage breakdown plus the summed cents across all meters. */
export interface OverageResult {
  perMeter: Record<Meter, MeterOverage>;
  overageCents: number;
}

/** Projected bill split: the seat add-on cost and the grand total, in cents. */
export interface BillProjection {
  /** Cents charged for seats above the included count. */
  seatsCents: number;
  /** baseCents + seatsCents + overageCents, in cents. */
  totalCents: number;
}

/**
 * Coerce any value to a finite, non-negative number.
 * NaN, Infinity, -Infinity, negatives, and non-numbers all collapse to 0.
 * This is the single sanitisation rule applied to every numeric input.
 */
function sanitizeAmount(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** True iff `value` is one of the known meter keys. */
export function isMeter(value: unknown): value is Meter {
  return typeof value === 'string' && (METERS as readonly string[]).includes(value);
}

/** A fresh, fully-zeroed usage rollup (a new object every call). */
export function emptyRollup(): UsageRollup {
  return { ai: 0, sms: 0, live_min: 0, aerial: 0, pdf: 0 };
}

/**
 * Normalise an arbitrary (possibly partial / dirty) rollup into a complete,
 * sanitised UsageRollup. Missing keys become 0; NaN/negative/Infinity → 0.
 */
function normalizeRollup(rollup: Partial<UsageRollup> | null | undefined): UsageRollup {
  const out = emptyRollup();
  if (rollup) {
    for (const m of METERS) {
      out[m] = sanitizeAmount(rollup[m]);
    }
  }
  return out;
}

/**
 * Add `qty` units to `meter` in a usage rollup, returning a NEW rollup.
 * The input is never mutated. Invalid meters, and non-finite/negative
 * quantities, are ignored (the sanitised rollup is returned unchanged).
 *
 * @param rollup current tally (partial/dirty input is tolerated)
 * @param meter  which resource was consumed
 * @param qty    units consumed (>= 0; fractional allowed, e.g. live minutes)
 */
export function applyUsage(
  rollup: Record<Meter, number>,
  meter: Meter,
  qty: number,
): Record<Meter, number> {
  const next = normalizeRollup(rollup);
  if (!isMeter(meter)) return next;
  next[meter] = next[meter] + sanitizeAmount(qty);
  return next;
}

/**
 * Compute overage owed for a billing period.
 * For each meter: `over = max(0, usage - allotment)` and
 * `cents = round(over * rate)`. All inputs are sanitised; missing allotments
 * and rates are treated as 0. Cents are rounded to the nearest integer.
 */
export function computeOverage(
  usage: Record<Meter, number>,
  allotments: Allotments,
  rates: Rates,
): OverageResult {
  const used = normalizeRollup(usage);
  const perMeter = {} as Record<Meter, MeterOverage>;
  let overageCents = 0;

  for (const m of METERS) {
    const allot = sanitizeAmount(allotments ? allotments[m] : 0);
    const rate = sanitizeAmount(rates ? rates[m] : 0);
    const over = Math.max(0, used[m] - allot);
    const cents = Math.round(over * rate);
    perMeter[m] = { over, cents };
    overageCents += cents;
  }

  return { perMeter, overageCents };
}

/**
 * Project the monthly bill from its parts.
 * Seat count and included-seat count are floored to whole seats; extra seats =
 * `max(0, seats - includedSeats)`. Money inputs are sanitised to non-negative
 * integer cents.
 *
 * @returns `{ seatsCents, totalCents }` where
 *   `seatsCents = extraSeats * seatCents` and
 *   `totalCents = baseCents + seatsCents + overageCents`.
 */
export function projectBill(
  baseCents: number,
  seats: number,
  includedSeats: number,
  seatCents: number,
  overageCents: number,
): BillProjection {
  const base = Math.round(sanitizeAmount(baseCents));
  const perSeat = Math.round(sanitizeAmount(seatCents));
  const over = Math.round(sanitizeAmount(overageCents));
  const totalSeats = Math.floor(sanitizeAmount(seats));
  const included = Math.floor(sanitizeAmount(includedSeats));
  const extraSeats = Math.max(0, totalSeats - included);

  const seatsCents = extraSeats * perSeat;
  const totalCents = base + seatsCents + over;

  return { seatsCents, totalCents };
}

/**
 * Would adding `addCents` keep the tenant within its spend cap?
 *
 * `capCents === null` means no cap is configured → always allowed.
 * Otherwise returns `currentSpentCents + addCents <= capCents`. This FAILS
 * CLOSED: current/add are sanitised to >= 0, and any non-finite/negative cap
 * is treated as 0 (so only a zero-cost add passes). Use `null`, never
 * Infinity, to express "unlimited".
 */
export function withinSpendCap(
  currentSpentCents: number,
  addCents: number,
  capCents: number | null,
): boolean {
  if (capCents === null || capCents === undefined) return true;
  const cap = sanitizeAmount(capCents);
  const current = sanitizeAmount(currentSpentCents);
  const add = sanitizeAmount(addCents);
  return current + add <= cap;
}
