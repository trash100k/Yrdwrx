import { describe, it, expect, vi, beforeEach } from "vitest";

// sampleData.ts imports ./repos (which transitively constructs a real Supabase client)
// and ./supabase, so both are mocked to keep the module hermetic and to let tests
// assert the exact repo calls clearSampleData() makes. Factories are hoisted, so all
// shared state lives in vi.hoisted().

const mocks = vi.hoisted(() => {
  const repo = () => ({
    list: vi.fn<() => Promise<unknown[]>>(async () => []),
    remove: vi.fn<(id: string) => Promise<void>>(async () => undefined),
  });
  return {
    customersRepo: repo(),
    jobsRepo: repo(),
    invoicesRepo: repo(),
    crewsRepo: repo(),
    leadsRepo: repo(),
    vendorsRepo: repo(),
    inventoryRepo: repo(),
    // hasSampleData() probe results, keyed by table name.
    probeResults: {} as Record<string, { data: unknown[] | null; error: unknown }>,
  };
});

vi.mock("./repos", () => ({
  customersRepo: mocks.customersRepo,
  jobsRepo: mocks.jobsRepo,
  invoicesRepo: mocks.invoicesRepo,
  crewsRepo: mocks.crewsRepo,
  leadsRepo: mocks.leadsRepo,
  vendorsRepo: mocks.vendorsRepo,
  inventoryRepo: mocks.inventoryRepo,
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        contains: () => ({
          limit: async () => mocks.probeResults[table] ?? { data: [], error: null },
        }),
      }),
    }),
  },
}));

import {
  SAMPLE_FLAG,
  isSampleRow,
  filterSampleRows,
  hasSampleData,
  clearSampleData,
} from "./sampleData";

const allRepos = [
  mocks.customersRepo,
  mocks.jobsRepo,
  mocks.invoicesRepo,
  mocks.crewsRepo,
  mocks.leadsRepo,
  mocks.vendorsRepo,
  mocks.inventoryRepo,
];

beforeEach(() => {
  for (const r of allRepos) {
    r.list.mockReset().mockResolvedValue([]);
    r.remove.mockReset().mockResolvedValue(undefined);
  }
  mocks.probeResults = {};
});

// ---------------------------------------------------------------------------
// isSampleRow — the pure predicate everything else keys off
// ---------------------------------------------------------------------------
describe("isSampleRow", () => {
  it("matches the exact seeder stamp: data.isSample === true", () => {
    expect(isSampleRow({ id: "1", data: { isSample: true } })).toBe(true);
    expect(isSampleRow({ id: "1", data: { isSample: true, client: "Gable Jenkins" } })).toBe(true);
  });

  it("uses the exported flag key (convention lock)", () => {
    expect(SAMPLE_FLAG).toBe("isSample");
    expect(isSampleRow({ data: { [SAMPLE_FLAG]: true } })).toBe(true);
  });

  it("rejects truthy-but-not-true flag values (no accidental matches on user data)", () => {
    expect(isSampleRow({ data: { isSample: "true" } })).toBe(false);
    expect(isSampleRow({ data: { isSample: 1 } })).toBe(false);
    expect(isSampleRow({ data: { isSample: {} } })).toBe(false);
    expect(isSampleRow({ data: { isSample: false } })).toBe(false);
  });

  it("rejects rows without the stamp or without data", () => {
    expect(isSampleRow({ id: "1" })).toBe(false);
    expect(isSampleRow({ id: "1", data: {} })).toBe(false);
    expect(isSampleRow({ id: "1", data: null })).toBe(false);
    expect(isSampleRow({ id: "1", data: [true] })).toBe(false);
  });

  it("never throws on junk input", () => {
    expect(isSampleRow(null)).toBe(false);
    expect(isSampleRow(undefined)).toBe(false);
    expect(isSampleRow("isSample")).toBe(false);
    expect(isSampleRow(42)).toBe(false);
    expect(isSampleRow({ data: "isSample" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterSampleRows
// ---------------------------------------------------------------------------
describe("filterSampleRows", () => {
  it("keeps only sample-flagged rows, preserving order", () => {
    const sample1 = { id: "a", data: { isSample: true } };
    const real = { id: "b", data: { gateCode: "4420" } };
    const sample2 = { id: "c", data: { isSample: true, client: "Marcus Pohl" } };
    expect(filterSampleRows([sample1, real, sample2])).toEqual([sample1, sample2]);
  });

  it("returns [] for empty / nullish / non-array input", () => {
    expect(filterSampleRows([])).toEqual([]);
    expect(filterSampleRows(null)).toEqual([]);
    expect(filterSampleRows(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// clearSampleData — repo-driven sweep
// ---------------------------------------------------------------------------
describe("clearSampleData", () => {
  it("removes only sample-flagged rows and returns per-table counts", async () => {
    mocks.customersRepo.list.mockResolvedValue([
      { id: "c1", data: { isSample: true } },
      { id: "c2", data: {} }, // real customer — must survive
      { id: "c3", data: { isSample: true } },
    ]);
    mocks.jobsRepo.list.mockResolvedValue([{ id: "j1", data: { isSample: true } }]);

    const result = await clearSampleData();

    expect(mocks.customersRepo.remove.mock.calls.map((c) => c[0])).toEqual(["c1", "c3"]);
    expect(mocks.jobsRepo.remove).toHaveBeenCalledExactlyOnceWith("j1");
    expect(mocks.crewsRepo.remove).not.toHaveBeenCalled();
    expect(result.total).toBe(3);
    expect(result.byTable).toEqual({
      invoices: 0,
      jobs: 1,
      customers: 2,
      crews: 0,
      leads: 0,
      vendors: 0,
      inventory: 0,
    });
  });

  it("deletes child tables (invoices, jobs) before customers", async () => {
    const order: string[] = [];
    mocks.invoicesRepo.list.mockResolvedValue([{ id: "i1", data: { isSample: true } }]);
    mocks.jobsRepo.list.mockResolvedValue([{ id: "j1", data: { isSample: true } }]);
    mocks.customersRepo.list.mockResolvedValue([{ id: "c1", data: { isSample: true } }]);
    mocks.invoicesRepo.remove.mockImplementation(async () => { order.push("invoices"); });
    mocks.jobsRepo.remove.mockImplementation(async () => { order.push("jobs"); });
    mocks.customersRepo.remove.mockImplementation(async () => { order.push("customers"); });

    await clearSampleData();
    expect(order).toEqual(["invoices", "jobs", "customers"]);
  });

  it("skips rows without an id instead of calling remove(undefined)", async () => {
    mocks.leadsRepo.list.mockResolvedValue([
      { data: { isSample: true } }, // no id — skip
      { id: "l2", data: { isSample: true } },
    ]);
    const result = await clearSampleData();
    expect(mocks.leadsRepo.remove).toHaveBeenCalledExactlyOnceWith("l2");
    expect(result.byTable.leads).toBe(1);
  });

  it("sweeps archived (Trash) rows too when the repo exposes listArchived()", async () => {
    // customersRepo is soft-delete in the real app: list() hides archived rows, but an
    // archived sample customer still keeps hasSampleData() true, so it must be cleared.
    const listArchived = vi.fn(async () => [{ id: "c-archived", data: { isSample: true } }]);
    (mocks.customersRepo as Record<string, unknown>).listArchived = listArchived;
    try {
      mocks.customersRepo.list.mockResolvedValue([{ id: "c-live", data: { isSample: true } }]);
      const result = await clearSampleData();
      expect(mocks.customersRepo.remove.mock.calls.map((c) => c[0])).toEqual([
        "c-live",
        "c-archived",
      ]);
      expect(result.byTable.customers).toBe(2);
    } finally {
      delete (mocks.customersRepo as Record<string, unknown>).listArchived;
    }
  });

  it("keeps sweeping when one table's list() rejects", async () => {
    mocks.invoicesRepo.list.mockRejectedValue(new Error("RLS says no"));
    mocks.inventoryRepo.list.mockResolvedValue([{ id: "inv1", data: { isSample: true } }]);

    const result = await clearSampleData();
    expect(result.byTable.invoices).toBe(0);
    expect(result.byTable.inventory).toBe(1);
    expect(result.total).toBe(1);
  });

  it("counts only successful deletes when a remove() rejects", async () => {
    mocks.crewsRepo.list.mockResolvedValue([
      { id: "k1", data: { isSample: true } },
      { id: "k2", data: { isSample: true } },
    ]);
    mocks.crewsRepo.remove
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    const result = await clearSampleData();
    expect(result.byTable.crews).toBe(1);
    expect(result.total).toBe(1);
  });

  it("returns all-zero counts on a clean tenant", async () => {
    const result = await clearSampleData();
    expect(result.total).toBe(0);
    expect(Object.values(result.byTable).every((n) => n === 0)).toBe(true);
    for (const r of allRepos) expect(r.remove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// hasSampleData — cheap probe
// ---------------------------------------------------------------------------
describe("hasSampleData", () => {
  it("is true when any probed table has a flagged row", async () => {
    mocks.probeResults.invoices = { data: [{ id: "i1" }], error: null };
    await expect(hasSampleData()).resolves.toBe(true);
  });

  it("is false when no probed table has flagged rows", async () => {
    await expect(hasSampleData()).resolves.toBe(false);
  });

  it("fails closed on query errors (no banner when we can't tell)", async () => {
    mocks.probeResults.customers = { data: null, error: new Error("offline") };
    mocks.probeResults.jobs = { data: null, error: new Error("offline") };
    mocks.probeResults.invoices = { data: null, error: new Error("offline") };
    await expect(hasSampleData()).resolves.toBe(false);
  });
});
