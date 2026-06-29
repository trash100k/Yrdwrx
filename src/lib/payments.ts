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
