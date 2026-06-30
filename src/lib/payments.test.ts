import { describe, it, expect } from "vitest";
import { applyPayment, invoiceBalance, agingBucket, bucketInvoices } from "./payments";

const NOW = Date.parse("2026-06-30T00:00:00.000Z");
const dueDaysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

describe("bucketInvoices (AR aging)", () => {
  const invoices = [
    { id: "cur", amount: 100, dueDate: dueDaysAgo(-5), status: "sent" },          // not due yet
    { id: "a", amount: 200, dueDate: dueDaysAgo(15), status: "sent" },            // d1_30
    { id: "b", amount: 50, dueDate: dueDaysAgo(30), status: "sent" },             // d1_30 (boundary)
    { id: "c", amount: 300, dueDate: dueDaysAgo(45), status: "overdue" },         // d31_60
    { id: "d", amount: 400, dueDate: dueDaysAgo(75), status: "sent" },            // d61_90
    { id: "e", amount: 500, dueDate: dueDaysAgo(120), status: "sent" },           // d90+
    { id: "paid", amount: 100, amountPaid: 100, dueDate: dueDaysAgo(40), status: "paid" },
    { id: "part", amount: 1000, amountPaid: 400, dueDate: dueDaysAgo(10), status: "partial" },
    { id: "draft", amount: 999, dueDate: dueDaysAgo(50), status: "draft" },       // skipped
    { id: "arch", amount: 888, dueDate: dueDaysAgo(50), status: "sent", isArchived: true },
    { id: "nodue", amount: 70, date: dueDaysAgo(50), status: "sent" },            // ages off `date`
  ];
  const ar = bucketInvoices(invoices, NOW);

  it("buckets by days past due (inclusive 30/60/90)", () => {
    expect(ar.current).toBe(100);
    expect(ar.d1_30).toBe(200 + 50 + 600); // a + b + partial balance
    expect(ar.d31_60).toBe(300 + 70);      // c + nodue (ages off date)
    expect(ar.d61_90).toBe(400);
    expect(ar.d90).toBe(500);
  });

  it("counts only outstanding balances; collected sums amountPaid", () => {
    // outstanding includes the not-yet-due 'current' invoice
    expect(ar.outstanding).toBe(100 + 200 + 50 + 300 + 400 + 500 + 600 + 70);
    expect(ar.collected).toBe(100 + 400); // paid + partial
  });

  it("excludes archived + void/cancelled/draft + fully-paid from aging", () => {
    const ids = ar.overdueInvoices.map((i) => i.id);
    expect(ids).not.toContain("draft");
    expect(ids).not.toContain("arch");
    expect(ids).not.toContain("paid");
    expect(ids).not.toContain("cur"); // current isn't "overdue"
    expect(ar.overdueInvoices).toHaveLength(7);
  });

  it("handles empty input without crashing", () => {
    const z = bucketInvoices([], NOW);
    expect(z.outstanding).toBe(0);
    expect(z.collected).toBe(0);
    expect(z.overdueInvoices).toHaveLength(0);
  });
});

describe("invoiceBalance", () => {
  it("computes total minus paid", () => {
    expect(invoiceBalance(500, 200)).toBe(300);
  });
  it("never goes negative on overpayment", () => {
    expect(invoiceBalance(100, 250)).toBe(0);
  });
  it("treats undefined/garbage as 0", () => {
    expect(invoiceBalance(undefined, undefined)).toBe(0);
    expect(invoiceBalance("100", null)).toBe(100);
  });
});

describe("applyPayment", () => {
  it("records a partial payment and flips status to partial", () => {
    const r = applyPayment(0, 50, 500);
    expect(r.accepted).toBe(50);
    expect(r.amountPaid).toBe(50);
    expect(r.status).toBe("partial");
    expect(r.overpaid).toBe(false);
  });

  it("accumulates onto a prior partial and settles to paid", () => {
    const r = applyPayment(450, 50, 500);
    expect(r.amountPaid).toBe(500);
    expect(r.status).toBe("paid");
  });

  it("clamps overpayment to the remaining balance", () => {
    const r = applyPayment(0, 9999, 100);
    expect(r.accepted).toBe(100); // not 9999
    expect(r.amountPaid).toBe(100);
    expect(r.status).toBe("paid");
    expect(r.overpaid).toBe(true);
  });

  it("accepts nothing once the invoice is already fully paid", () => {
    const r = applyPayment(100, 50, 100);
    expect(r.accepted).toBe(0);
    expect(r.amountPaid).toBe(100);
    expect(r.status).toBe("paid");
  });

  it("treats the half-cent boundary as paid", () => {
    const r = applyPayment(99.999, 0, 100);
    expect(r.status).toBe("paid");
  });
});

describe("agingBucket", () => {
  it("buckets by days overdue with inclusive 30/60/90 boundaries", () => {
    expect(agingBucket(0)).toBe("current");
    expect(agingBucket(-5)).toBe("current");
    expect(agingBucket(1)).toBe("d1_30");
    expect(agingBucket(30)).toBe("d1_30");
    expect(agingBucket(31)).toBe("d31_60");
    expect(agingBucket(60)).toBe("d31_60");
    expect(agingBucket(90)).toBe("d61_90");
    expect(agingBucket(91)).toBe("d90");
  });
});
