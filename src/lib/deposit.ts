// Deposit math for "deposit on acceptance" — pure + typed so the server wiring stays trivial
// and the money-sensitive rounding is unit-tested. A signed estimate can require an upfront
// deposit (a flat dollar amount OR a percentage of the estimate total); we collect it through
// the same Stripe Connect portal-checkout path the balance uses.

export interface DepositConfig {
  /** Flat deposit in dollars. Takes precedence over a percentage when > 0. */
  depositAmount?: number | null;
  /** Deposit as a percentage of the estimate total (0–100). */
  depositPct?: number | null;
}

export interface DepositResult {
  /** True when a chargeable deposit is due (>= Stripe's $0.50 floor). */
  required: boolean;
  /** Deposit amount in dollars, rounded to cents, never more than the total. */
  amount: number;
  /** The effective percentage of the total this deposit represents (for display). */
  pct: number;
}

const STRIPE_MIN_DOLLARS = 0.5;

/** Round to cents without binary-float drift. */
function toCents(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Resolve the deposit due on an estimate. A flat `depositAmount` wins over a `depositPct`.
 * The result is clamped to [0, total] and only marked `required` once it clears Stripe's
 * minimum charge — a sub-$0.50 or zero deposit is treated as "no deposit" so signing proceeds
 * straight through with no payment step.
 */
export function computeDeposit(total: number, cfg: DepositConfig | null | undefined): DepositResult {
  // `Number(total) || 0` collapses NaN/null/undefined/-Infinity to 0 but leaves +Infinity intact
  // (it's truthy) — guard explicitly so a non-finite total yields no chargeable deposit.
  const t = Number(total);
  const grandTotal = Number.isFinite(t) && t > 0 ? t : 0;
  const cfgAmount = Number(cfg?.depositAmount);
  const cfgPct = Number(cfg?.depositPct);

  let amount = 0;
  if (Number.isFinite(cfgAmount) && cfgAmount > 0) {
    amount = cfgAmount;
  } else if (Number.isFinite(cfgPct) && cfgPct > 0) {
    amount = grandTotal * (Math.min(cfgPct, 100) / 100);
  }

  amount = toCents(Math.min(amount, grandTotal));
  const required = amount >= STRIPE_MIN_DOLLARS;
  const pct = grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0;

  return { required, amount: required ? amount : 0, pct };
}
