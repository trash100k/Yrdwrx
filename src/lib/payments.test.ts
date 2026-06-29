import { describe, it, expect } from "vitest";
import { applyPayment, invoiceBalance, agingBucket } from "./payments";

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
