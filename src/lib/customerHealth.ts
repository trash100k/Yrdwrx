// @ts-nocheck
// customerHealth — PURE customer health / churn scorer.
//
// Extracted verbatim from src/pages/CustomerIntelligence.tsx (the "health score + reasons"
// block). Deterministic: score = 100 − penalties, clamped to [0, 100] and rounded.
// Penalty values and thresholds are copied EXACTLY from the page; do not "improve" them.
//
// Inputs are pre-resolved per-customer signals (the page builds these from real repo rows):
//   daysSinceJob   number|null  — days since this customer's last COMPLETED job (null if none)
//   overdue        number       — count of overdue / unpaid invoices
//   review         { rating, sentiment } | null|undefined
//                     rating    number|null  — worst review rating (1–5)
//                     sentiment string|null  — "NEGATIVE" | "POSITIVE" | ...
//   declinedCount  number       — count of declined / cancelled jobs
//   contractStatus string|null  — lowercased contract status ("at_risk" | "pending_renewal" | "pending" | ...)
//
// Output: { score, reasons, band }
//   score   number   — 0..100 (rounded, clamped)
//   reasons string[] — human-readable churn signals (full list; the page slices to 3)
//   band    string   — "Healthy" (>=70) | "Watch" (>=40) | "At-risk" (<40)

export interface CustomerHealthReview {
  rating?: number | null;
  sentiment?: string | null;
}

export interface CustomerHealthSignals {
  daysSinceJob?: number | null;
  overdue?: number | null;
  review?: CustomerHealthReview | null;
  declinedCount?: number | null;
  contractStatus?: string | null;
}

export interface CustomerHealthResult {
  score: number;
  reasons: string[];
  band: string;
}

// Health buckets: Healthy >=70, Watch 40-69, At-risk <40.
// (Mirrors healthBand() in CustomerIntelligence.tsx — kept pure here, just the label tier.)
export function healthBandLabel(score: number): string {
  if (score >= 70) return "Healthy";
  if (score >= 40) return "Watch";
  return "At-risk";
}

export function customerHealth(signals: CustomerHealthSignals = {}): CustomerHealthResult {
  const daysSinceJob = signals?.daysSinceJob ?? null;
  const overdue = signals?.overdue || 0;
  const rv = signals?.review || null;
  const declinedCount = signals?.declinedCount || 0;
  const cStatus = signals?.contractStatus || null;

  let score = 100;
  const reasons: string[] = [];

  if (daysSinceJob != null) {
    if (daysSinceJob > 180) {
      score -= 35;
      reasons.push(`No completed job in ${daysSinceJob} days`);
    } else if (daysSinceJob > 90) {
      score -= 20;
      reasons.push(`${daysSinceJob} days since last job`);
    } else if (daysSinceJob > 45) {
      score -= 8;
      reasons.push(`${daysSinceJob} days since last job`);
    }
  }

  if (overdue > 0) {
    score -= Math.min(25, 12 + overdue * 6);
    reasons.push(`${overdue} overdue / unpaid invoice${overdue === 1 ? "" : "s"}`);
  }

  if (rv) {
    if (rv.sentiment === "NEGATIVE" || (rv.rating != null && rv.rating <= 2)) {
      score -= 25;
      reasons.push(rv.rating != null ? `Low review rating (${rv.rating}/5)` : "Negative review sentiment");
    } else if (rv.rating != null && rv.rating === 3) {
      score -= 10;
      reasons.push("Lukewarm review (3/5)");
    }
  }

  if (declinedCount > 0) {
    score -= Math.min(20, declinedCount * 10);
    reasons.push(`${declinedCount} declined / cancelled job${declinedCount === 1 ? "" : "s"}`);
  }

  if (cStatus === "at_risk") {
    score -= 20;
    reasons.push("Contract flagged at-risk");
  } else if (cStatus === "pending_renewal" || cStatus === "pending") {
    score -= 12;
    reasons.push("Contract pending renewal");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, reasons, band: healthBandLabel(score) };
}

export default customerHealth;
