// Pure money helpers for the invoice/payment path. Kept dependency-free so both the
// client (Invoices page, ClientPortal) and tests can share the exact same rules — the
// amountPaid ledger must agree everywhere or the portal can double-charge a client.

export type InvoiceStatusish = "draft" | "sent" | "partial" | "paid" | string;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Remaining balance on an invoice, never negative. */
export function invoiceBalance(total: any, amountPaid: any): number {
  return Math.max(0, round2((Number(total) || 0) - (Number(amountPaid) || 0)));
}

/**
 * Apply a payment of `rawAmount` to an invoice that has already received `prevPaid`
 * against a `total`. Overpayment is clamped to the outstanding balance so the AR
 * "collected" total can never exceed what was actually owed.
 */
export function applyPayment(
  prevPaid: any,
  rawAmount: any,
  total: any,
): { accepted: number; amountPaid: number; status: "partial" | "paid"; overpaid: boolean } {
  const prev = Number(prevPaid) || 0;
  const tot = Number(total) || 0;
  const req = Number(rawAmount) || 0;
  const balance = Math.max(0, tot - prev);
  // If the invoice still has a balance, never accept more than it; once fully paid, a
  // further charge is a no-op of 0. Callers should reject <= 0 before calling.
  const accepted = balance > 0 ? Math.min(req, balance) : 0;
  const amountPaid = round2(prev + accepted);
  const status: "partial" | "paid" = amountPaid >= tot - 0.005 ? "paid" : "partial";
  return { accepted: round2(accepted), amountPaid, status, overpaid: req > balance };
}

/** AR aging bucket key for an invoice that is `daysOver` days past due (<=0 => current). */
export function agingBucket(daysOver: number): "current" | "d1_30" | "d31_60" | "d61_90" | "d90" {
  if (daysOver <= 0) return "current";
  if (daysOver <= 30) return "d1_30";
  if (daysOver <= 60) return "d31_60";
  if (daysOver <= 90) return "d61_90";
  return "d90";
}

export interface ArAging {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90: number;
  outstanding: number;
  collected: number;
  overdueInvoices: any[];
}

/** Start-of-today as a ms timestamp (drops the time component, like the AR page did). */
export function startOfTodayMs(): number {
  return new Date(new Date().toDateString()).getTime();
}

/**
 * Accounts-receivable aging. Buckets each invoice's OUTSTANDING balance by how many days
 * past due it is, and totals what's been collected. Rules (kept identical to the Invoices
 * page it was extracted from):
 *  - skip archived + void/cancelled/draft invoices;
 *  - `collected` sums data.amountPaid across all non-skipped invoices;
 *  - an invoice with no remaining balance (or status "paid") doesn't age;
 *  - ages off dueDate, falling back to date → created_at (so auto-billed visits still age);
 *  - anything past due (daysOver > 0) is added to overdueInvoices.
 * `now` is a ms timestamp (default: start of today) — pass it explicitly for deterministic tests.
 */
export function bucketInvoices(invoices: any[], now: number = startOfTodayMs()): ArAging {
  const b: ArAging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0, outstanding: 0, collected: 0, overdueInvoices: [] };
  for (const inv of invoices || []) {
    if (inv?.isArchived) continue;
    const s = String(inv?.status || "").toLowerCase();
    if (["void", "cancelled", "canceled", "draft"].includes(s)) continue;
    const total = Number(inv?.amount) || 0;
    const paid = Number(inv?.amountPaid) || 0;
    b.collected += paid;
    const bal = total - paid;
    if (bal <= 0.005 || s === "paid") continue;
    b.outstanding += bal;
    const dueRaw = inv?.dueDate || inv?.date || inv?.created_at;
    const due = dueRaw ? new Date(dueRaw).getTime() : NaN;
    const daysOver = isNaN(due) ? 0 : Math.floor((now - due) / 86400000);
    const bucket = agingBucket(daysOver);
    b[bucket] += bal;
    if (bucket !== "current") b.overdueInvoices.push(inv);
  }
  return b;
}
