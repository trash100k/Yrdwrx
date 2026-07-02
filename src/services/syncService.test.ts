import { describe, it, expect, vi } from "vitest";

// Stub the repo layer so importing syncService doesn't drag in the Supabase
// client — these tests exercise only the pure decision logic.
vi.mock("../lib/repos", () => ({
  customersRepo: {},
  jobsRepo: {},
  leadsRepo: {},
  materialLogsRepo: {},
  invoicesRepo: {},
  expensesRepo: {},
  reviewsRepo: {},
  inventoryRepo: {},
  crewsRepo: {},
  vendorsRepo: {},
  knowledgeRepo: {},
  designCatalogRepo: {},
  contractsRepo: {},
  inspectionFormsRepo: {},
  designVisionsRepo: {},
  tasksRepo: {},
  timesheetsRepo: {},
}));

import {
  parseLease,
  isLeaseValid,
  tryAcquireLease,
  renewLease,
  releaseLease,
  recordFailure,
  pushApplied,
  mergeIdRings,
  mergeQueues,
  newOpId,
  MAX_ATTEMPTS,
  APPLIED_RING_CAP,
  type PendingAction,
  type StorageLike,
} from "./syncService";

// Simple object-backed localStorage shim — no jsdom APIs involved.
function makeStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

function action(overrides: Partial<PendingAction> = {}): PendingAction {
  return {
    id: "op-1",
    type: "CREATE",
    collection: "customers",
    tenantId: "t1",
    data: { name: "Ada" },
    timestamp: 1000,
    attempts: 0,
    ...overrides,
  };
}

const KEY = "lease";

describe("parseLease", () => {
  it("returns null for missing or empty values", () => {
    expect(parseLease(null)).toBeNull();
    expect(parseLease(undefined)).toBeNull();
    expect(parseLease("")).toBeNull();
  });

  it("returns null for corrupt JSON and wrong shapes", () => {
    expect(parseLease("{not json")).toBeNull();
    expect(parseLease('"a string"')).toBeNull();
    expect(parseLease("42")).toBeNull();
    expect(parseLease(JSON.stringify({ owner: "", expiresAt: 99 }))).toBeNull();
    expect(parseLease(JSON.stringify({ owner: "tab-a" }))).toBeNull();
    expect(parseLease(JSON.stringify({ expiresAt: 99 }))).toBeNull();
    expect(parseLease(JSON.stringify({ owner: "tab-a", expiresAt: "soon" }))).toBeNull();
  });

  it("parses a well-formed lease", () => {
    expect(parseLease(JSON.stringify({ owner: "tab-a", expiresAt: 5000 }))).toEqual({
      owner: "tab-a",
      expiresAt: 5000,
    });
  });
});

describe("isLeaseValid", () => {
  it("is false for null and for expired leases", () => {
    expect(isLeaseValid(null, 100)).toBe(false);
    expect(isLeaseValid({ owner: "a", expiresAt: 100 }, 100)).toBe(false); // expiry is exclusive
    expect(isLeaseValid({ owner: "a", expiresAt: 99 }, 100)).toBe(false);
  });

  it("is true while the expiry is in the future", () => {
    expect(isLeaseValid({ owner: "a", expiresAt: 101 }, 100)).toBe(true);
  });
});

describe("tryAcquireLease", () => {
  it("acquires when no lease exists and persists owner + expiry", () => {
    const s = makeStorage();
    expect(tryAcquireLease(s, KEY, "tab-a", 30_000, 1000)).toBe(true);
    expect(parseLease(s.getItem(KEY))).toEqual({ owner: "tab-a", expiresAt: 31_000 });
  });

  it("refuses while another tab holds a live lease, without overwriting it", () => {
    const s = makeStorage({ [KEY]: JSON.stringify({ owner: "tab-a", expiresAt: 10_000 }) });
    expect(tryAcquireLease(s, KEY, "tab-b", 30_000, 5000)).toBe(false);
    expect(parseLease(s.getItem(KEY))!.owner).toBe("tab-a");
  });

  it("takes over a stale (expired) lease", () => {
    const s = makeStorage({ [KEY]: JSON.stringify({ owner: "tab-a", expiresAt: 10_000 }) });
    expect(tryAcquireLease(s, KEY, "tab-b", 30_000, 10_001)).toBe(true);
    expect(parseLease(s.getItem(KEY))).toEqual({ owner: "tab-b", expiresAt: 40_001 });
  });

  it("takes over a corrupt lease", () => {
    const s = makeStorage({ [KEY]: "{garbage" });
    expect(tryAcquireLease(s, KEY, "tab-b", 30_000, 1000)).toBe(true);
    expect(parseLease(s.getItem(KEY))!.owner).toBe("tab-b");
  });

  it("is re-entrant for the current owner and extends the expiry", () => {
    const s = makeStorage({ [KEY]: JSON.stringify({ owner: "tab-a", expiresAt: 10_000 }) });
    expect(tryAcquireLease(s, KEY, "tab-a", 30_000, 9000)).toBe(true);
    expect(parseLease(s.getItem(KEY))).toEqual({ owner: "tab-a", expiresAt: 39_000 });
  });

  it("backs off if the read-back shows another tab won the write race", () => {
    // Simulate a same-instant race: our write is immediately clobbered by tab-b.
    const s = makeStorage();
    const rawSet = s.setItem;
    s.setItem = (k: string, _v: string) => {
      rawSet(k, JSON.stringify({ owner: "tab-b", expiresAt: 99_999 }));
    };
    expect(tryAcquireLease(s, KEY, "tab-a", 30_000, 1000)).toBe(false);
  });
});

describe("renewLease / releaseLease", () => {
  it("renews only a lease we own", () => {
    const s = makeStorage({ [KEY]: JSON.stringify({ owner: "tab-a", expiresAt: 10_000 }) });
    expect(renewLease(s, KEY, "tab-a", 30_000, 9000)).toBe(true);
    expect(parseLease(s.getItem(KEY))!.expiresAt).toBe(39_000);

    expect(renewLease(s, KEY, "tab-b", 30_000, 9000)).toBe(false);
    expect(parseLease(s.getItem(KEY))!.owner).toBe("tab-a");
  });

  it("does not renew when no lease exists", () => {
    const s = makeStorage();
    expect(renewLease(s, KEY, "tab-a", 30_000, 1000)).toBe(false);
    expect(s.getItem(KEY)).toBeNull();
  });

  it("releases only our own lease and leaves foreign leases intact", () => {
    const s = makeStorage({ [KEY]: JSON.stringify({ owner: "tab-a", expiresAt: 10_000 }) });
    releaseLease(s, KEY, "tab-b");
    expect(parseLease(s.getItem(KEY))!.owner).toBe("tab-a");

    releaseLease(s, KEY, "tab-a");
    expect(s.getItem(KEY)).toBeNull();

    // no-op on empty storage
    releaseLease(s, KEY, "tab-a");
    expect(s.getItem(KEY)).toBeNull();
  });
});

describe("recordFailure", () => {
  it("bumps the counter without mutating the input", () => {
    const a = action({ attempts: 2 });
    const { action: next, dead } = recordFailure(a);
    expect(next.attempts).toBe(3);
    expect(dead).toBe(false);
    expect(a.attempts).toBe(2); // input untouched
  });

  it("treats missing/invalid attempts as zero (pre-hardening queue items)", () => {
    const legacy = action();
    delete (legacy as unknown as Record<string, unknown>).attempts;
    expect(recordFailure(legacy).action.attempts).toBe(1);
    expect(recordFailure(action({ attempts: -3 })).action.attempts).toBe(1);
    expect(recordFailure(action({ attempts: Number.NaN })).action.attempts).toBe(1);
  });

  it("declares the op dead at the MAX_ATTEMPTS threshold", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    const { action: fourth, dead: deadAt4 } = recordFailure(action({ attempts: 3 }));
    expect(fourth.attempts).toBe(4);
    expect(deadAt4).toBe(false);

    const { action: fifth, dead: deadAt5 } = recordFailure(action({ attempts: 4 }));
    expect(fifth.attempts).toBe(5);
    expect(deadAt5).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(recordFailure(action({ attempts: 0 }), 1).dead).toBe(true);
    expect(recordFailure(action({ attempts: 0 }), 3).dead).toBe(false);
  });
});

describe("pushApplied", () => {
  it("appends new ids", () => {
    expect(pushApplied(["a", "b"], "c", 10)).toEqual(["a", "b", "c"]);
  });

  it("dedupes by moving a re-applied id to the newest slot", () => {
    expect(pushApplied(["a", "b", "c"], "a", 10)).toEqual(["b", "c", "a"]);
  });

  it("caps the ring by evicting the oldest ids", () => {
    expect(pushApplied(["a", "b", "c"], "d", 3)).toEqual(["b", "c", "d"]);
  });

  it("defaults to the exported cap", () => {
    let ring: string[] = [];
    for (let i = 0; i < APPLIED_RING_CAP + 50; i++) ring = pushApplied(ring, `id-${i}`);
    expect(ring).toHaveLength(APPLIED_RING_CAP);
    expect(ring[0]).toBe("id-50"); // oldest 50 evicted
    expect(ring[ring.length - 1]).toBe(`id-${APPLIED_RING_CAP + 49}`);
  });
});

describe("mergeIdRings", () => {
  it("unions with persisted-first order and dedupes", () => {
    expect(mergeIdRings(["a", "b"], ["b", "c"], 10)).toEqual(["a", "b", "c"]);
  });

  it("drops non-string junk and caps to the newest entries", () => {
    const junk = ["a", 7, null, "b"] as unknown as string[];
    expect(mergeIdRings(junk, ["c", "d"], 3)).toEqual(["b", "c", "d"]);
  });
});

describe("mergeQueues", () => {
  it("unions by id and sorts by timestamp", () => {
    const p = [action({ id: "x", timestamp: 300 })];
    const m = [action({ id: "y", timestamp: 100 }), action({ id: "z", timestamp: 200 })];
    expect(mergeQueues(p, m).map((a) => a.id)).toEqual(["y", "z", "x"]);
  });

  it("keeps the copy with the higher attempt count on conflict", () => {
    const p = [action({ id: "x", attempts: 3 })];
    const m = [action({ id: "x", attempts: 1 })];
    expect(mergeQueues(p, m)[0].attempts).toBe(3); // persisted was further along
    expect(mergeQueues(m, p)[0].attempts).toBe(3); // symmetric
  });

  it("prefers the in-memory copy on an attempts tie", () => {
    const p = [action({ id: "x", attempts: 1, data: { src: "persisted" } })];
    const m = [action({ id: "x", attempts: 1, data: { src: "memory" } })];
    expect(mergeQueues(p, m)[0].data.src).toBe("memory");
  });

  it("skips malformed entries without ids", () => {
    const junk = [null, {}, action({ id: "" })] as unknown as PendingAction[];
    const m = [action({ id: "ok" })];
    expect(mergeQueues(junk, m).map((a) => a.id)).toEqual(["ok"]);
  });

  it("tie-breaks equal timestamps by id for a stable order", () => {
    const p = [action({ id: "b", timestamp: 100 }), action({ id: "a", timestamp: 100 })];
    expect(mergeQueues(p, []).map((a) => a.id)).toEqual(["a", "b"]);
  });
});

describe("newOpId", () => {
  it("produces non-empty, unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newOpId()));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(8);
    }
  });
});
