import { describe, it, expect } from "vitest";
import {
  computeArAging,
  computeCrewUtilization,
  computeReviewPulse,
  computeLowStock,
  computeTodaySchedule,
  computeJobsAtRisk,
  computeTopServices,
  usd0,
  toDate,
} from "./dashboardMetrics";

const NOW = new Date("2026-07-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
const dayKey = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

describe("toDate / usd0", () => {
  it("parses ISO, Date, epoch, Firestore Timestamp; rejects junk", () => {
    expect(toDate("2026-07-05")?.getFullYear()).toBe(2026);
    expect(toDate(new Date(0))?.getTime()).toBe(0);
    expect(toDate({ toDate: () => new Date("2026-01-01") })?.getMonth()).toBe(0);
    expect(toDate("not-a-date")).toBeNull();
    expect(toDate(null)).toBeNull();
  });
  it("formats whole-dollar USD and tolerates junk", () => {
    expect(usd0(1234.9)).toBe("$1,235");
    expect(usd0("nope")).toBe("$0");
  });
});

describe("computeArAging", () => {
  it("sums only collectible balances; excludes paid & draft", () => {
    const invoices = [
      { status: "paid", amount: 500 },
      { status: "draft", amount: 999 },
      { status: "sent", amount: 100, dueDate: daysAhead(5) }, // current
      { status: "sent", amount: 200, dueDate: daysAgo(10) }, // 1-30
      { status: "overdue", amount: 300, dueDate: daysAgo(45) }, // 31-60
      { status: "unpaid", amount: 400, dueDate: daysAgo(120) }, // 90+
    ];
    const a = computeArAging(invoices, NOW);
    expect(a.outstanding).toBe(1000);
    expect(a.count).toBe(4);
    expect(a.overdue).toBe(900);
    expect(a.overdueCount).toBe(3);
    const byLabel = Object.fromEntries(a.buckets.map((b) => [b.label, b.amount]));
    expect(byLabel["Current"]).toBe(100);
    expect(byLabel["1–30"]).toBe(200);
    expect(byLabel["31–60"]).toBe(300);
    expect(byLabel["90+"]).toBe(400);
  });
  it("treats status 'overdue' as at least 1 day late even without a due date", () => {
    const a = computeArAging([{ status: "overdue", amount: 50 }], NOW);
    expect(a.overdue).toBe(50);
    expect(a.overdueCount).toBe(1);
  });
  it("empty/nullish input yields zeros", () => {
    const a = computeArAging(null, NOW);
    expect(a.outstanding).toBe(0);
    expect(a.buckets).toHaveLength(5);
  });
});

describe("computeCrewUtilization", () => {
  it("classifies statuses and computes active pct", () => {
    const u = computeCrewUtilization([
      { status: "ON_SITE" },
      { status: "TRANSPORT" },
      { status: "OFF_DUTY" },
      { status: "OFF_DUTY" },
    ]);
    expect(u.total).toBe(4);
    expect(u.onSite).toBe(1);
    expect(u.transport).toBe(1);
    expect(u.active).toBe(2);
    expect(u.pct).toBe(50);
  });
  it("no crews => 0 pct, no divide-by-zero", () => {
    expect(computeCrewUtilization([]).pct).toBe(0);
  });
});

describe("computeReviewPulse", () => {
  it("averages ratings and counts recent/5-star", () => {
    const p = computeReviewPulse(
      [
        { rating: 5, createdAt: daysAgo(2) },
        { rating: 4, createdAt: daysAgo(10) },
        { rating: 3, createdAt: daysAgo(400) },
        { rating: 0 }, // ignored (no rating)
      ],
      NOW,
    );
    expect(p).not.toBeNull();
    expect(p!.count).toBe(3);
    expect(p!.avg).toBe(4);
    expect(p!.recent30).toBe(2);
    expect(p!.fiveStar).toBe(1);
  });
  it("no ratings => null (empty state)", () => {
    expect(computeReviewPulse([], NOW)).toBeNull();
    expect(computeReviewPulse([{ rating: 0 }], NOW)).toBeNull();
  });
});

describe("computeLowStock", () => {
  it("flags items at/under threshold across both schemas, most-depleted first", () => {
    const ls = computeLowStock([
      { name: "Mulch", stock: 2, minThreshold: 10, unit: "yd" }, // ratio .2
      { name: "Fuel", quantity: 8, minQuantity: 10 }, // ratio .8
      { name: "Seed", stock: 50, minThreshold: 10 }, // healthy
      { name: "NoMin", stock: 0 }, // no threshold => ignored
    ]);
    expect(ls.count).toBe(2);
    expect(ls.items[0].name).toBe("Mulch");
    expect(ls.items[1].name).toBe("Fuel");
  });
});

describe("computeTodaySchedule", () => {
  it("splits today / upcoming / overdue and skips completed", () => {
    const s = computeTodaySchedule(
      [
        { status: "SCHEDULED", date: dayKey(NOW), revenue: 300 },
        { status: "IN_PROGRESS", date: dayKey(NOW), revenue: 200 },
        { status: "SCHEDULED", date: daysAhead(3) },
        { status: "SCHEDULED", date: daysAgo(2) }, // overdue
        { status: "COMPLETED", date: dayKey(NOW), revenue: 999 }, // skipped
      ],
      NOW,
    );
    expect(s.todayCount).toBe(2);
    expect(s.todayRevenue).toBe(500);
    expect(s.upcomingCount).toBe(1);
    expect(s.overdueCount).toBe(1);
  });
});

describe("computeJobsAtRisk", () => {
  it("flags past-due open jobs as high risk", () => {
    const r = computeJobsAtRisk([{ status: "SCHEDULED", date: daysAgo(1), title: "Late" }], null, NOW);
    expect(r.count).toBe(1);
    expect(r.items[0].level).toBe("high");
  });
  it("adds today's jobs when weather delay risk is HIGH", () => {
    const r = computeJobsAtRisk(
      [{ status: "SCHEDULED", date: dayKey(NOW), title: "TodayJob" }],
      { delayRisk: "HIGH" },
      NOW,
    );
    expect(r.weatherRisk).toBe(true);
    expect(r.count).toBe(1);
    expect(r.items[0].level).toBe("medium");
  });
  it("on-track => empty", () => {
    const r = computeJobsAtRisk([{ status: "SCHEDULED", date: daysAhead(2) }], { delayRisk: "LOW" }, NOW);
    expect(r.count).toBe(0);
  });
});

describe("computeTopServices", () => {
  it("ranks paid revenue by service with share percentages", () => {
    const top = computeTopServices([
      { status: "paid", amount: 600, serviceType: "Mowing" },
      { status: "paid", amount: 400, serviceType: "Mulch" },
      { status: "sent", amount: 999, serviceType: "Ignored" },
    ]);
    expect(top).toHaveLength(2);
    expect(top[0]).toMatchObject({ label: "Mowing", value: 600, share: 60 });
  });
  it("no paid invoices => empty array", () => {
    expect(computeTopServices([{ status: "sent", amount: 100 }])).toEqual([]);
  });
});
