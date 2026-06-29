// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  parseCadence,
  nextVisitDates,
  visitDatesUntil,
  pricePerVisitFromMrr,
} from "./recurring";

describe("parseCadence", () => {
  it("recognizes weekly variants", () => {
    expect(parseCadence("Weekly")).toBe("weekly");
    expect(parseCadence("every week")).toBe("weekly");
  });

  it("recognizes biweekly variants", () => {
    expect(parseCadence("Bi-Weekly")).toBe("biweekly");
    expect(parseCadence("every other week")).toBe("biweekly");
    expect(parseCadence("every 2 weeks")).toBe("biweekly");
    expect(parseCadence("fortnightly")).toBe("biweekly");
  });

  it("recognizes monthly", () => {
    expect(parseCadence("Monthly")).toBe("monthly");
  });

  it("recognizes annually variants", () => {
    expect(parseCadence("Annually")).toBe("annually");
    expect(parseCadence("annual")).toBe("annually");
    expect(parseCadence("Yearly")).toBe("annually");
    expect(parseCadence("once a year")).toBe("annually");
  });

  it("defaults to monthly for empty/unknown input", () => {
    expect(parseCadence("")).toBe("monthly");
    expect(parseCadence(undefined)).toBe("monthly");
    expect(parseCadence("gibberish")).toBe("monthly");
  });
});

describe("nextVisitDates", () => {
  it("starts at the anchor date and steps weekly", () => {
    expect(nextVisitDates("2026-06-29", "weekly", 3)).toEqual([
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
    ]);
  });

  it("steps biweekly by 14 days", () => {
    expect(nextVisitDates("2026-06-29", "biweekly", 3)).toEqual([
      "2026-06-29",
      "2026-07-13",
      "2026-07-27",
    ]);
  });

  it("steps monthly with day clamping", () => {
    expect(nextVisitDates("2026-01-31", "monthly", 3)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("steps annually by one calendar year", () => {
    expect(nextVisitDates("2026-06-29", "annually", 3)).toEqual([
      "2026-06-29",
      "2027-06-29",
      "2028-06-29",
    ]);
  });

  it("clamps Feb 29 across non-leap years for annually", () => {
    expect(nextVisitDates("2024-02-29", "annually", 2)).toEqual([
      "2024-02-29",
      "2025-02-28",
    ]);
  });

  it("returns empty for count 0 or negative", () => {
    expect(nextVisitDates("2026-06-29", "weekly", 0)).toEqual([]);
    expect(nextVisitDates("2026-06-29", "weekly", -3)).toEqual([]);
  });
});

describe("visitDatesUntil", () => {
  it("behaves like nextVisitDates capped at maxCount when no end date", () => {
    expect(visitDatesUntil("2026-06-29", "weekly", null, 3)).toEqual([
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
    ]);
  });

  it("stops at the end date inclusive", () => {
    expect(visitDatesUntil("2026-06-29", "weekly", "2026-07-13", 10)).toEqual([
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
    ]);
  });

  it("excludes dates strictly after the end date", () => {
    expect(visitDatesUntil("2026-06-29", "weekly", "2026-07-10", 10)).toEqual([
      "2026-06-29",
      "2026-07-06",
    ]);
  });

  it("respects maxCount even when end date allows more", () => {
    expect(visitDatesUntil("2026-06-29", "weekly", "2026-12-31", 2)).toEqual([
      "2026-06-29",
      "2026-07-06",
    ]);
  });

  it("handles monthly cadence with an end date", () => {
    expect(visitDatesUntil("2026-01-15", "monthly", "2026-03-15", 12)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ]);
  });

  it("handles annually cadence with an end date", () => {
    expect(visitDatesUntil("2026-06-29", "annually", "2028-06-29", 12)).toEqual([
      "2026-06-29",
      "2027-06-29",
      "2028-06-29",
    ]);
  });

  it("treats an unparseable end date as no end", () => {
    expect(visitDatesUntil("2026-06-29", "weekly", "not-a-date", 2)).toEqual([
      "2026-06-29",
      "2026-07-06",
    ]);
  });

  it("returns empty for maxCount 0", () => {
    expect(visitDatesUntil("2026-06-29", "weekly", "2026-12-31", 0)).toEqual([]);
  });

  it("returns empty if the very first date is past the end", () => {
    expect(visitDatesUntil("2026-06-29", "weekly", "2026-06-01", 5)).toEqual([]);
  });
});

describe("pricePerVisitFromMrr", () => {
  it("returns mrr for monthly", () => {
    expect(pricePerVisitFromMrr(200, "monthly")).toBe(200);
  });

  it("approximates weekly as mrr / 4.33", () => {
    expect(pricePerVisitFromMrr(200, "weekly")).toBe(46.19);
  });

  it("approximates biweekly as mrr / 2.17", () => {
    expect(pricePerVisitFromMrr(200, "biweekly")).toBe(92.17);
  });

  it("approximates annually as mrr * 12", () => {
    expect(pricePerVisitFromMrr(200, "annually")).toBe(2400);
  });

  it("rounds to two decimals", () => {
    expect(pricePerVisitFromMrr(100, "weekly")).toBe(23.09);
  });

  it("guards mrr <= 0", () => {
    expect(pricePerVisitFromMrr(0, "monthly")).toBe(0);
    expect(pricePerVisitFromMrr(-50, "weekly")).toBe(0);
  });

  it("guards non-finite mrr", () => {
    expect(pricePerVisitFromMrr(NaN, "monthly")).toBe(0);
    expect(pricePerVisitFromMrr(Infinity, "monthly")).toBe(0);
  });
});
