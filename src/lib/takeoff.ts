// Aerial-takeoff material math — pure, typed, deterministic core for the
// feat-aerial-takeoff + materials-calculator feature. Given a property's measured
// areas (from an aerial/manual takeoff) this turns square footage into orderable
// material quantities and priced estimate line items.
//
// This file is intentionally free of I/O, `Date.now`/`Math.random`, and any server /
// React / Firebase imports so the numbers are unit-testable and reproducible. It is NOT
// `@ts-nocheck`: it must stay type-clean.
//
// ── Coverage rates & constants (each documented; industry-standard landscaping figures) ──
//
//  • DEFAULT_MULCH_DEPTH_IN — 2". A 2-inch layer is the standard refresh depth for an
//    established bed (3" for a brand-new bed). Callers override via `opts.mulchDepthInches`.
//  • CUBIC_FEET_PER_CUBIC_YARD — 27. Definitional: 3ft × 3ft × 3ft = 27 cu ft per cu yd.
//    (Sanity check: 1 cu yd of mulch covers ~162 sqft at 2" deep — 27 ÷ (2/12) = 162.)
//  • SEED_LBS_PER_1000_SQFT — 4 lb. Typical new-lawn seeding rate for cool-season turf
//    (overseeding runs lighter, ~2–4 lb; new establishment ~4–8 lb — 4 is a safe default).
//  • FERTILIZER_LBS_PER_1000_SQFT — 5 lb of product. Delivers roughly the standard
//    1 lb of nitrogen per 1,000 sqft when using a common ~20%-N granular turf fertilizer
//    (1 ÷ 0.20 = 5 lb of product).
//  • SOD_WASTE_FACTOR — 1.05. Order ~5% extra sod to cover cuts, trimming and irregular
//    edges; ordering exactly the measured area leaves gaps.
//  • BED_PERIMETER_SHAPE_FACTOR — 4. Edging is a perimeter estimate. For area A, the
//    minimum-perimeter (square) enclosure has perimeter 4·√A, which we use as a rough
//    bed-edging estimate. Long/irregular border beds will need more, so this is a floor.

/** Measured areas for a property, in square feet. All fields optional; missing ⇒ 0. */
export interface Measurement {
  /** Turf / lawn area to be mowed, seeded and fertilized. */
  lawnSqft?: number;
  /** Planting-bed area to be mulched and edged. */
  bedSqft?: number;
  /** Hardscape (patio/walk/driveway) area — captured for context; not consumed here yet. */
  hardscapeSqft?: number;
  /** Whole-lot area — captured for context; not consumed here yet. */
  lotSqft?: number;
}

/** Optional knobs for the material calc. */
export interface TakeoffOptions {
  /** Mulch application depth in inches (defaults to {@link DEFAULT_MULCH_DEPTH_IN}). */
  mulchDepthInches?: number;
}

/** Orderable material quantities derived from a {@link Measurement}. */
export interface MaterialQuantities {
  /** Bulk mulch to order, in cubic yards (bedSqft × depthFt ÷ 27), rounded to 0.1 yd. */
  mulchCubicYards: number;
  /** Sod to order, in square feet, including the standard waste overage; whole sqft. */
  sodSqft: number;
  /** Grass seed, in pounds (lawnSqft ÷ 1000 × rate), rounded to 0.1 lb. */
  seedLbs: number;
  /** Granular fertilizer, in pounds (lawnSqft ÷ 1000 × rate), rounded to 0.1 lb. */
  fertilizerLbs: number;
  /** Rough bed-edging length, in linear feet (4·√bedSqft), rounded to whole feet. */
  edgingLinearFtEstimate: number;
}

/** Unit rates for pricing an estimate. All optional; missing/invalid ⇒ line skipped. */
export interface EstimateRates {
  /** Price per square foot to mow the lawn. */
  mowPerSqft?: number;
  /** Price per cubic yard of installed mulch. */
  mulchPerYard?: number;
  /** Price per square foot of installed sod. */
  sodPerSqft?: number;
}

/** A single priced line on an estimate. */
export interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  /** quantity × rate, rounded to cents. */
  amount: number;
}

const DEFAULT_MULCH_DEPTH_IN = 2;
const CUBIC_FEET_PER_CUBIC_YARD = 27;
const INCHES_PER_FOOT = 12;
const SEED_LBS_PER_1000_SQFT = 4;
const FERTILIZER_LBS_PER_1000_SQFT = 5;
const SOD_WASTE_FACTOR = 1.05;
const BED_PERIMETER_SHAPE_FACTOR = 4;

/**
 * Coerce an untrusted value to a non-negative, finite number. `null`/`undefined`/`NaN`/
 * `Infinity`/negative all collapse to 0 so downstream math never produces NaN or garbage.
 */
function nonNeg(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Resolve a usable mulch depth: the caller's value if positive & finite, else the default. */
function resolveDepthInches(value: unknown): number {
  const d = Number(value);
  return Number.isFinite(d) && d > 0 ? d : DEFAULT_MULCH_DEPTH_IN;
}

/** Round to one decimal place (yards / pounds). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Round to cents without binary-float drift (money). */
function toCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert measured areas into orderable material quantities using standard coverage rates.
 * Every input is sanitized to a non-negative number first, so an empty, partial, or garbage
 * `Measurement` yields all-zero quantities rather than NaN.
 */
export function sqftToQuantities(
  m: Measurement,
  opts?: TakeoffOptions,
): MaterialQuantities {
  const lawn = nonNeg(m?.lawnSqft);
  const bed = nonNeg(m?.bedSqft);

  const depthFt = resolveDepthInches(opts?.mulchDepthInches) / INCHES_PER_FOOT;
  const mulchCubicYards = round1((bed * depthFt) / CUBIC_FEET_PER_CUBIC_YARD);

  const sodSqft = Math.round(lawn * SOD_WASTE_FACTOR);
  const seedLbs = round1((lawn / 1000) * SEED_LBS_PER_1000_SQFT);
  const fertilizerLbs = round1((lawn / 1000) * FERTILIZER_LBS_PER_1000_SQFT);
  const edgingLinearFtEstimate = Math.round(BED_PERIMETER_SHAPE_FACTOR * Math.sqrt(bed));

  return { mulchCubicYards, sodSqft, seedLbs, fertilizerLbs, edgingLinearFtEstimate };
}

/**
 * Build priced estimate line items from a measurement and a set of unit rates.
 * A line is only emitted when it has BOTH a positive quantity and a positive rate;
 * negative/NaN/missing rates or empty areas are silently dropped. Amounts are rounded
 * to cents. Quantities mirror {@link sqftToQuantities} so the estimate agrees with the
 * material order.
 */
export function estimateLineItems(m: Measurement, rates: EstimateRates): LineItem[] {
  const lawn = nonNeg(m?.lawnSqft);
  const quantities = sqftToQuantities(m);

  const candidates: Array<{ description: string; quantity: number; rate: number }> = [
    { description: "Lawn mowing", quantity: lawn, rate: nonNeg(rates?.mowPerSqft) },
    {
      description: "Mulch installation",
      quantity: quantities.mulchCubicYards,
      rate: nonNeg(rates?.mulchPerYard),
    },
    {
      description: "Sod installation",
      quantity: quantities.sodSqft,
      rate: nonNeg(rates?.sodPerSqft),
    },
  ];

  return candidates
    .filter((c) => c.quantity > 0 && c.rate > 0)
    .map((c) => ({
      description: c.description,
      quantity: c.quantity,
      rate: c.rate,
      amount: toCents(c.quantity * c.rate),
    }));
}
