// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  num,
  marginBand,
  customerIdOf,
  jobIdOf,
  makeMaterialLineCost,
  rollupJobCosts,
} from "./jobCosting";

// ---------------------------------------------------------------------------
// num — the `Number(x) || 0` style guard (here: finite-or-zero)
// ---------------------------------------------------------------------------
describe("num", () => {
  it("coerces numeric strings and numbers", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num(7)).toBe(7);
    expect(num(0)).toBe(0);
  });

  it("falls back to 0 for non-finite / junk", () => {
    expect(num(undefined)).toBe(0);
    expect(num(null)).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num(-Infinity)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// marginBand — threshold boundaries at 40 and 15
// ---------------------------------------------------------------------------
describe("marginBand", () => {
  it("is Healthy (forest) at >= 40", () => {
    expect(marginBand(40).label).toBe("Healthy");
    expect(marginBand(40).text).toBe("text-forest-400");
    expect(marginBand(120).label).toBe("Healthy");
  });

  it("is Thin (amber) in [15, 40)", () => {
    expect(marginBand(39.999).label).toBe("Thin");
    expect(marginBand(15).label).toBe("Thin");
    expect(marginBand(15).text).toBe("text-amber-400");
  });

  it("is At Risk (rose) below 15, including negatives", () => {
    expect(marginBand(14.999).label).toBe("At Risk");
    expect(marginBand(0).label).toBe("At Risk");
    expect(marginBand(-50).label).toBe("At Risk");
    expect(marginBand(-50).text).toBe("text-rose-400");
  });
});

// ---------------------------------------------------------------------------
// id resolvers — accept any of the common field aliases
// ---------------------------------------------------------------------------
describe("jobIdOf / customerIdOf", () => {
  it("jobIdOf reads jobId / job_id / associatedJobId, else null", () => {
    expect(jobIdOf({ jobId: "j1" })).toBe("j1");
    expect(jobIdOf({ job_id: "j2" })).toBe("j2");
    expect(jobIdOf({ associatedJobId: "j3" })).toBe("j3");
    expect(jobIdOf({})).toBe(null);
  });

  it("jobIdOf prefers jobId over the aliases", () => {
    expect(jobIdOf({ jobId: "a", job_id: "b", associatedJobId: "c" })).toBe("a");
  });

  it("customerIdOf reads customerId / customer_id / clientId / client_id, else null", () => {
    expect(customerIdOf({ customerId: "c1" })).toBe("c1");
    expect(customerIdOf({ customer_id: "c2" })).toBe("c2");
    expect(customerIdOf({ clientId: "c3" })).toBe("c3");
    expect(customerIdOf({ client_id: "c4" })).toBe("c4");
    expect(customerIdOf({})).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// makeMaterialLineCost — unit-cost lookup priority + quantity guard
// ---------------------------------------------------------------------------
describe("makeMaterialLineCost", () => {
  it("uses inventory unit cost by itemId first", () => {
    const cost = makeMaterialLineCost([{ id: "mulch", unitCost: 4 }]);
    expect(cost({ itemId: "mulch", quantity: 3 })).toBe(12);
  });

  it("falls back to inventory by (lowercased) itemName", () => {
    const cost = makeMaterialLineCost([{ name: "Mulch", unitPrice: 5 }]);
    expect(cost({ itemName: "MULCH", quantity: 2 })).toBe(10);
  });

  it("falls back to the material line's own unitCost / unitPrice", () => {
    const cost = makeMaterialLineCost([]);
    expect(cost({ unitCost: 6, quantity: 2 })).toBe(12);
    expect(cost({ unitPrice: 7, quantity: 2 })).toBe(14);
  });

  it("guards quantity and missing unit with Number(x)||0 -> 0", () => {
    const cost = makeMaterialLineCost([]);
    expect(cost({ unitCost: 6 })).toBe(0); // no quantity
    expect(cost({ quantity: 5 })).toBe(0); // no unit cost anywhere
    expect(cost({ quantity: "bad", unitCost: 6 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rollupJobCosts — the core attribution + allocation + margin math
// ---------------------------------------------------------------------------
describe("rollupJobCosts", () => {
  it("returns zeros (no NaN) for fully empty inputs", () => {
    const { rows, summary } = rollupJobCosts({
      jobs: [],
      invoices: [],
      expenses: [],
      timesheets: [],
      materialLogs: [],
      inventory: [],
      laborRate: 35,
    });
    expect(rows).toEqual([]);
    expect(summary).toEqual({
      totalRevenue: 0,
      totalCost: 0,
      totalLabor: 0,
      totalMaterial: 0,
      blendedMargin: 0,
      blendedMarginPct: 0,
      anyEst: false,
    });
    // explicit NaN guard
    expect(Number.isNaN(summary.blendedMarginPct)).toBe(false);
  });

  it("attributes a job-linked timesheet, material log, and expense to that job", () => {
    const { rows } = rollupJobCosts({
      jobs: [{ id: "j1", revenue: 1000 }],
      invoices: [],
      // 120 min @ $50/hr = 2 hrs * 50 = $100 labor
      timesheets: [{ jobId: "j1", durationMins: 120 }],
      // 3 units of mulch @ $4 = $12 material
      materialLogs: [{ jobId: "j1", itemId: "mulch", quantity: 3 }],
      // $40 expense
      expenses: [{ jobId: "j1", amount: 40 }],
      inventory: [{ id: "mulch", unitCost: 4 }],
      laborRate: 50,
    });

    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.revenue).toBe(1000);
    expect(r.revenueIsBilled).toBe(false); // no invoice -> quoted
    expect(r.revenueIsEst).toBe(true);
    expect(r.laborHours).toBe(2);
    expect(r.laborCost).toBe(100);
    expect(r.laborIsEst).toBe(false); // directly attributed
    expect(r.materialCost).toBe(52); // 12 material + 40 expense
    expect(r.materialIsEst).toBe(false);
    expect(r.totalCost).toBe(152);
    expect(r.marginDollars).toBe(848);
    expect(r.marginPct).toBeCloseTo(84.8, 5);
  });

  it("prefers a job-linked invoice over the job's own revenue and marks it billed", () => {
    const { rows } = rollupJobCosts({
      jobs: [{ id: "j1", revenue: 1000 }],
      invoices: [{ jobId: "j1", amount: 1500 }],
      expenses: [],
      timesheets: [],
      materialLogs: [],
      inventory: [],
      laborRate: 35,
    });
    expect(rows[0].revenue).toBe(1500);
    expect(rows[0].revenueIsBilled).toBe(true);
    expect(rows[0].revenueIsEst).toBe(false);
  });

  it("falls back to job revenue via amount/total/price aliases", () => {
    const out = (job) =>
      rollupJobCosts({
        jobs: [job],
        invoices: [],
        expenses: [],
        timesheets: [],
        materialLogs: [],
        inventory: [],
        laborRate: 35,
      }).rows[0].revenue;
    expect(out({ id: "a", amount: 200 })).toBe(200);
    expect(out({ id: "b", total: 300 })).toBe(300);
    expect(out({ id: "c", price: 400 })).toBe(400);
  });

  it("evenly allocates UNALLOCATED labor across active jobs (the est. fallback)", () => {
    // 240 unallocated mins / 2 jobs = 120 mins/job = 2 hrs * $30 = $60 labor each
    const { rows } = rollupJobCosts({
      jobs: [
        { id: "j1", revenue: 1000 },
        { id: "j2", revenue: 1000 },
      ],
      invoices: [],
      expenses: [],
      // no jobId -> unallocated pool
      timesheets: [{ durationMins: 240 }],
      materialLogs: [],
      inventory: [],
      laborRate: 30,
    });
    for (const r of rows) {
      expect(r.laborHours).toBe(2);
      expect(r.laborCost).toBe(60);
      expect(r.laborIsEst).toBe(true); // allocated, not directly logged
    }
  });

  it("evenly allocates unallocated material+expense pool across active jobs", () => {
    // (material 100 + expense 60) / 2 jobs = $80 material/other each
    const { rows } = rollupJobCosts({
      jobs: [
        { id: "j1", revenue: 1000 },
        { id: "j2", revenue: 1000 },
      ],
      invoices: [],
      expenses: [{ amount: 60 }], // unallocated
      timesheets: [],
      materialLogs: [{ itemId: "rock", quantity: 10 }], // unallocated, 10*$10
      inventory: [{ id: "rock", unitCost: 10 }],
      laborRate: 35,
    });
    for (const r of rows) {
      expect(r.materialCost).toBe(80);
      expect(r.materialIsEst).toBe(true);
    }
  });

  it("ignores material logs of type 'in' (restock is not job cost)", () => {
    const { rows } = rollupJobCosts({
      jobs: [{ id: "j1", revenue: 1000 }],
      invoices: [],
      expenses: [],
      timesheets: [],
      materialLogs: [{ jobId: "j1", itemId: "soil", quantity: 5, type: "IN" }],
      inventory: [{ id: "soil", unitCost: 9 }],
      laborRate: 35,
    });
    // restock excluded -> no direct material -> 0 (no allocation pool either)
    expect(rows[0].materialCost).toBe(0);
    expect(rows[0].materialIsEst).toBe(true);
  });

  it("derives timesheet minutes from clockIn/clockOut when durationMins is absent", () => {
    const { rows } = rollupJobCosts({
      jobs: [{ id: "j1", revenue: 1000 }],
      invoices: [],
      expenses: [],
      timesheets: [
        {
          jobId: "j1",
          clockIn: "2026-01-01T08:00:00Z",
          clockOut: "2026-01-01T10:00:00Z", // 2 hrs
        },
      ],
      materialLogs: [],
      inventory: [],
      laborRate: 40,
    });
    expect(rows[0].laborHours).toBe(2);
    expect(rows[0].laborCost).toBe(80);
    expect(rows[0].laborIsEst).toBe(false);
  });

  it("computes marginPct = 0 (not NaN) when revenue is 0", () => {
    const { rows } = rollupJobCosts({
      jobs: [{ id: "j1" }], // no revenue field
      invoices: [],
      expenses: [],
      timesheets: [],
      materialLogs: [],
      inventory: [],
      laborRate: 35,
    });
    expect(rows[0].revenue).toBe(0);
    expect(rows[0].marginPct).toBe(0);
    expect(Number.isNaN(rows[0].marginPct)).toBe(false);
  });

  it("hits the marginBand threshold boundary via computed marginPct (exactly 40%)", () => {
    // revenue 1000, cost = labor only. 360 min @ $100/hr = 6 hrs * 100 = $600 cost
    // margin $ = 400 -> 40% -> Healthy boundary
    const { rows } = rollupJobCosts({
      jobs: [{ id: "j1", revenue: 1000 }],
      invoices: [],
      expenses: [],
      timesheets: [{ jobId: "j1", durationMins: 360 }],
      materialLogs: [],
      inventory: [],
      laborRate: 100,
    });
    expect(rows[0].marginPct).toBe(40);
    expect(marginBand(rows[0].marginPct).label).toBe("Healthy");
  });

  it("sorts rows lowest-margin-first and aggregates the blended summary", () => {
    const { rows, summary } = rollupJobCosts({
      jobs: [
        { id: "good", revenue: 1000 }, // no costs -> 100% margin
        { id: "bad", revenue: 1000 }, // big labor -> low margin
      ],
      invoices: [],
      expenses: [],
      // attribute all labor to "bad": 600 min = 10 hrs @ $90/hr = $900
      timesheets: [{ jobId: "bad", durationMins: 600 }],
      materialLogs: [],
      inventory: [],
      laborRate: 90,
    });

    // lowest margin first
    expect(rows[0].id).toBe("bad");
    expect(rows[1].id).toBe("good");

    // blended: revenue 2000, cost 900 -> margin 1100 -> 55%
    expect(summary.totalRevenue).toBe(2000);
    expect(summary.totalCost).toBe(900);
    expect(summary.totalLabor).toBe(900);
    expect(summary.totalMaterial).toBe(0);
    expect(summary.blendedMargin).toBe(1100);
    expect(summary.blendedMarginPct).toBeCloseTo(55, 5);
    expect(summary.anyEst).toBe(true); // revenue is quoted on both jobs
  });

  it("caps the table at 60 active jobs (newest by date first)", () => {
    const jobs = Array.from({ length: 70 }, (_, i) => ({
      id: `j${i}`,
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      revenue: 100,
    }));
    const { rows } = rollupJobCosts({
      jobs,
      invoices: [],
      expenses: [],
      timesheets: [],
      materialLogs: [],
      inventory: [],
      laborRate: 35,
    });
    expect(rows).toHaveLength(60);
  });
});
