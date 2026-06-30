// @ts-nocheck
import { describe, it, expect } from "vitest";
import { customerHealth, healthBandLabel } from "./customerHealth";

// Faithful tests for the extracted churn/health scorer.
// score = 100 − penalties, clamped to [0,100], rounded.
// Penalties (verbatim from src/pages/CustomerIntelligence.tsx):
//   daysSinceJob >180 → −35 ; >90 → −20 ; >45 → −8
//   overdue invoices  → −min(25, 12 + overdue*6)
//   review NEGATIVE or rating<=2 → −25 ; rating===3 → −10
//   declinedCount     → −min(20, declinedCount*10)
//   contract at_risk  → −20 ; pending_renewal/pending → −12

describe("customerHealth — empty / missing signals", () => {
  it("returns a perfect score with no signals", () => {
    const r = customerHealth();
    expect(r.score).toBe(100);
    expect(r.reasons).toEqual([]);
    expect(r.band).toBe("Healthy");
  });

  it("does not crash on an empty object", () => {
    expect(() => customerHealth({})).not.toThrow();
    expect(customerHealth({}).score).toBe(100);
  });

  it("treats null/undefined fields as absent (no penalty)", () => {
    const r = customerHealth({
      daysSinceJob: null,
      overdue: null,
      review: null,
      declinedCount: null,
      contractStatus: null,
    });
    expect(r.score).toBe(100);
    expect(r.reasons).toEqual([]);
  });

  it("does not crash when review object is empty", () => {
    expect(() => customerHealth({ review: {} })).not.toThrow();
    // empty review object → no rating, no sentiment → no penalty
    expect(customerHealth({ review: {} }).score).toBe(100);
  });
});

describe("customerHealth — daysSinceJob threshold boundaries", () => {
  // Penalties trigger STRICTLY ABOVE the threshold (> not >=).
  it("exactly 45 days → no penalty (boundary is > 45)", () => {
    const r = customerHealth({ daysSinceJob: 45 });
    expect(r.score).toBe(100);
    expect(r.reasons).toEqual([]);
  });

  it("46 days → −8", () => {
    const r = customerHealth({ daysSinceJob: 46 });
    expect(r.score).toBe(92);
    expect(r.reasons).toContain("46 days since last job");
  });

  it("exactly 90 days → still −8 tier (boundary is > 90)", () => {
    const r = customerHealth({ daysSinceJob: 90 });
    expect(r.score).toBe(92);
    expect(r.reasons).toContain("90 days since last job");
  });

  it("91 days → −20", () => {
    const r = customerHealth({ daysSinceJob: 91 });
    expect(r.score).toBe(80);
    expect(r.reasons).toContain("91 days since last job");
  });

  it("exactly 180 days → still −20 tier (boundary is > 180)", () => {
    const r = customerHealth({ daysSinceJob: 180 });
    expect(r.score).toBe(80);
    expect(r.reasons).toContain("180 days since last job");
  });

  it("181 days → −35 with the 'No completed job' message", () => {
    const r = customerHealth({ daysSinceJob: 181 });
    expect(r.score).toBe(65);
    expect(r.reasons).toContain("No completed job in 181 days");
  });

  it("0 days → no penalty", () => {
    expect(customerHealth({ daysSinceJob: 0 }).score).toBe(100);
  });
});

describe("customerHealth — overdue invoices", () => {
  it("1 overdue → −18 (12 + 1*6)", () => {
    const r = customerHealth({ overdue: 1 });
    expect(r.score).toBe(82);
    expect(r.reasons).toContain("1 overdue / unpaid invoice");
  });

  it("2 overdue → −24 (12 + 2*6), singular/plural respected", () => {
    const r = customerHealth({ overdue: 2 });
    expect(r.score).toBe(76);
    expect(r.reasons).toContain("2 overdue / unpaid invoices");
  });

  it("caps the overdue penalty at 25", () => {
    // 12 + 10*6 = 72, capped to 25 → score 75
    const r = customerHealth({ overdue: 10 });
    expect(r.score).toBe(75);
    expect(r.reasons).toContain("10 overdue / unpaid invoices");
  });

  it("0 overdue → no penalty", () => {
    expect(customerHealth({ overdue: 0 }).score).toBe(100);
  });
});

describe("customerHealth — reviews", () => {
  it("rating <= 2 → −25 with low-rating message", () => {
    const r = customerHealth({ review: { rating: 2 } });
    expect(r.score).toBe(75);
    expect(r.reasons).toContain("Low review rating (2/5)");
  });

  it("rating === 1 → −25", () => {
    expect(customerHealth({ review: { rating: 1 } }).score).toBe(75);
  });

  it("NEGATIVE sentiment with no rating → −25 with sentiment message", () => {
    const r = customerHealth({ review: { sentiment: "NEGATIVE", rating: null } });
    expect(r.score).toBe(75);
    expect(r.reasons).toContain("Negative review sentiment");
  });

  it("rating === 3 → −10 lukewarm", () => {
    const r = customerHealth({ review: { rating: 3 } });
    expect(r.score).toBe(90);
    expect(r.reasons).toContain("Lukewarm review (3/5)");
  });

  it("rating === 4 → no penalty", () => {
    expect(customerHealth({ review: { rating: 4 } }).score).toBe(100);
  });

  it("rating === 5 → no penalty", () => {
    const r = customerHealth({ review: { rating: 5 } });
    expect(r.score).toBe(100);
    expect(r.reasons).toEqual([]);
  });

  it("NEGATIVE sentiment takes priority over a low rating message form", () => {
    // rating present (1) → message is the rating form, penalty −25
    const r = customerHealth({ review: { sentiment: "NEGATIVE", rating: 1 } });
    expect(r.score).toBe(75);
    expect(r.reasons).toContain("Low review rating (1/5)");
  });
});

describe("customerHealth — declined / cancelled jobs", () => {
  it("1 declined → −10", () => {
    const r = customerHealth({ declinedCount: 1 });
    expect(r.score).toBe(90);
    expect(r.reasons).toContain("1 declined / cancelled job");
  });

  it("2 declined → −20, plural message", () => {
    const r = customerHealth({ declinedCount: 2 });
    expect(r.score).toBe(80);
    expect(r.reasons).toContain("2 declined / cancelled jobs");
  });

  it("caps the declined penalty at 20", () => {
    // 5*10 = 50, capped to 20 → score 80
    const r = customerHealth({ declinedCount: 5 });
    expect(r.score).toBe(80);
  });
});

describe("customerHealth — contract status", () => {
  it("at_risk → −20", () => {
    const r = customerHealth({ contractStatus: "at_risk" });
    expect(r.score).toBe(80);
    expect(r.reasons).toContain("Contract flagged at-risk");
  });

  it("pending_renewal → −12", () => {
    const r = customerHealth({ contractStatus: "pending_renewal" });
    expect(r.score).toBe(88);
    expect(r.reasons).toContain("Contract pending renewal");
  });

  it("pending → −12", () => {
    const r = customerHealth({ contractStatus: "pending" });
    expect(r.score).toBe(88);
    expect(r.reasons).toContain("Contract pending renewal");
  });

  it("active (or any other status) → no penalty", () => {
    expect(customerHealth({ contractStatus: "active" }).score).toBe(100);
  });
});

describe("customerHealth — clamping and combined signals", () => {
  it("a perfectly healthy customer scores the max of 100", () => {
    const r = customerHealth({
      daysSinceJob: 10,
      overdue: 0,
      review: { rating: 5, sentiment: "POSITIVE" },
      declinedCount: 0,
      contractStatus: "active",
    });
    expect(r.score).toBe(100);
    expect(r.reasons).toEqual([]);
    expect(r.band).toBe("Healthy");
  });

  it("a worst-case customer is floored at 0 (never negative)", () => {
    const r = customerHealth({
      daysSinceJob: 400, // −35
      overdue: 10, // −25 (capped)
      review: { rating: 1, sentiment: "NEGATIVE" }, // −25
      declinedCount: 5, // −20 (capped)
      contractStatus: "at_risk", // −20
    });
    // raw = 100 − 35 − 25 − 25 − 20 − 20 = −25 → clamped to 0
    expect(r.score).toBe(0);
    expect(r.band).toBe("At-risk");
    // every applicable reason should be present
    expect(r.reasons).toContain("No completed job in 400 days");
    expect(r.reasons).toContain("10 overdue / unpaid invoices");
    expect(r.reasons).toContain("Low review rating (1/5)");
    expect(r.reasons).toContain("5 declined / cancelled jobs");
    expect(r.reasons).toContain("Contract flagged at-risk");
  });

  it("score is always within [0, 100]", () => {
    const cases = [
      {},
      { daysSinceJob: 1000, overdue: 99, declinedCount: 99, contractStatus: "at_risk", review: { rating: 1 } },
      { daysSinceJob: 46 },
      { overdue: 1, review: { rating: 3 } },
    ];
    for (const c of cases) {
      const { score } = customerHealth(c);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("combines multiple mid-tier penalties additively", () => {
    // 46 days (−8) + 1 overdue (−18) + rating 3 (−10) + pending (−12) = −48 → 52
    const r = customerHealth({
      daysSinceJob: 46,
      overdue: 1,
      review: { rating: 3 },
      contractStatus: "pending",
    });
    expect(r.score).toBe(52);
    expect(r.band).toBe("Watch");
    expect(r.reasons).toHaveLength(4);
  });
});

describe("healthBandLabel — bucket boundaries", () => {
  it("100 / 70 → Healthy", () => {
    expect(healthBandLabel(100)).toBe("Healthy");
    expect(healthBandLabel(70)).toBe("Healthy");
  });

  it("69 / 40 → Watch", () => {
    expect(healthBandLabel(69)).toBe("Watch");
    expect(healthBandLabel(40)).toBe("Watch");
  });

  it("39 / 0 → At-risk", () => {
    expect(healthBandLabel(39)).toBe("At-risk");
    expect(healthBandLabel(0)).toBe("At-risk");
  });
});
