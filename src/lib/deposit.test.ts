import { describe, it, expect } from "vitest";
import { computeDeposit } from "./deposit";

describe("computeDeposit", () => {
  it("returns no deposit when there is no config", () => {
    expect(computeDeposit(1000, null)).toEqual({ required: false, amount: 0, pct: 0 });
    expect(computeDeposit(1000, {})).toEqual({ required: false, amount: 0, pct: 0 });
  });

  it("computes a percentage deposit", () => {
    const r = computeDeposit(1000, { depositPct: 25 });
    expect(r.required).toBe(true);
    expect(r.amount).toBe(250);
    expect(r.pct).toBe(25);
  });

  it("computes a flat deposit and reports its effective pct", () => {
    const r = computeDeposit(2000, { depositAmount: 500 });
    expect(r.amount).toBe(500);
    expect(r.pct).toBe(25);
  });

  it("prefers a flat amount over a percentage when both are set", () => {
    const r = computeDeposit(1000, { depositAmount: 100, depositPct: 50 });
    expect(r.amount).toBe(100);
  });

  it("never exceeds the estimate total", () => {
    expect(computeDeposit(300, { depositAmount: 999 }).amount).toBe(300);
    expect(computeDeposit(300, { depositPct: 150 }).amount).toBe(300); // pct clamped to 100
  });

  it("rounds to cents without float drift", () => {
    // 33.33% of 100 = 33.33
    expect(computeDeposit(100, { depositPct: 33.33 }).amount).toBe(33.33);
    // 10% of 10.01 = 1.001 -> 1.00
    expect(computeDeposit(10.01, { depositPct: 10 }).amount).toBe(1);
  });

  it("treats a sub-$0.50 deposit as no deposit (Stripe floor)", () => {
    const r = computeDeposit(5, { depositPct: 1 }); // $0.05
    expect(r.required).toBe(false);
    expect(r.amount).toBe(0);
  });

  it("guards against zero/negative/NaN totals and configs", () => {
    expect(computeDeposit(0, { depositPct: 50 })).toEqual({ required: false, amount: 0, pct: 0 });
    expect(computeDeposit(-100, { depositPct: 50 }).amount).toBe(0);
    expect(computeDeposit(1000, { depositPct: NaN as any }).required).toBe(false);
    expect(computeDeposit(1000, { depositAmount: -5 }).required).toBe(false);
  });
});
