// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the supabase client so makeRepo's query/channel plumbing is observable.
// (Factory is hoisted by vitest, so all state lives inside and is reached via
// the mocked module's `supabase.__*` handles.)
vi.mock("../supabase", () => {
  const pages: any[][] = []; // queue of result pages for .range()
  const rangeCalls: Array<[number, number]> = [];
  const channels: any[] = [];
  const removed: any[] = [];
  const supabase: any = {
    __pages: pages,
    __rangeCalls: rangeCalls,
    __channels: channels,
    __removed: removed,
    from: vi.fn(() => {
      const b: any = {
        select: () => b,
        eq: () => b,
        order: () => b,
        range: (from: number, to: number) => {
          rangeCalls.push([from, to]);
          return Promise.resolve({ data: pages.length ? pages.shift() : [], error: null });
        },
      };
      return b;
    }),
    channel: vi.fn((topic: string) => {
      const ch: any = {
        topic,
        handler: null,
        statusCb: null,
        on: vi.fn((_type, _filter, handler) => {
          ch.handler = handler;
          return ch;
        }),
        subscribe: vi.fn((statusCb) => {
          ch.statusCb = statusCb;
          return ch;
        }),
      };
      channels.push(ch);
      return ch;
    }),
    removeChannel: vi.fn((ch: any) => removed.push(ch)),
    auth: { getSession: async () => ({ data: { session: null } }) },
  };
  return { supabase, getCurrentUser: () => null };
});

import { supabase } from "../supabase";
import { makeRepo, applyRealtimeDelta } from "./base";

const s: any = supabase;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  s.__pages.length = 0;
  s.__rangeCalls.length = 0;
  s.__channels.length = 0;
  s.__removed.length = 0;
});

// ---------------------------------------------------------------------------
// applyRealtimeDelta — pure delta application (the per-event replacement for
// full-table refetches). Payload rows are snake_case, in-memory rows camelCase.
// ---------------------------------------------------------------------------
describe("applyRealtimeDelta", () => {
  const desc = { orderBy: { column: "created_at" } }; // ascending defaults to false
  const rows = [
    { id: "b", createdAt: "2026-02-01" },
    { id: "a", createdAt: "2026-01-01" },
  ];

  it("INSERT places the camelized row per a descending orderBy (newest first)", () => {
    const out = applyRealtimeDelta(rows, {
      eventType: "INSERT",
      new: { id: "c", created_at: "2026-03-01" },
      old: {},
    }, desc);
    expect(out.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(out[0].createdAt).toBe("2026-03-01"); // camelized
    expect(rows).toHaveLength(2); // input not mutated
  });

  it("INSERT lands mid-list when the order value dictates", () => {
    const out = applyRealtimeDelta(rows, {
      eventType: "INSERT",
      new: { id: "d", created_at: "2026-01-15" },
      old: {},
    }, desc);
    expect(out.map((r) => r.id)).toEqual(["b", "d", "a"]);
  });

  it("INSERT respects an ascending orderBy", () => {
    const asc = { orderBy: { column: "due_date", ascending: true } };
    const tasks = [
      { id: "t1", dueDate: "2026-01-01" },
      { id: "t2", dueDate: "2026-03-01" },
    ];
    const out = applyRealtimeDelta(tasks, {
      eventType: "INSERT",
      new: { id: "t3", due_date: "2026-02-01" },
      old: {},
    }, asc);
    expect(out.map((r) => r.id)).toEqual(["t1", "t3", "t2"]);
  });

  it("INSERT appends when the repo declares no orderBy", () => {
    const out = applyRealtimeDelta(rows, {
      eventType: "INSERT",
      new: { id: "z", created_at: "2099-01-01" },
      old: {},
    }, {});
    expect(out.map((r) => r.id)).toEqual(["b", "a", "z"]);
  });

  it("UPDATE replaces the row by id (and repositions if the order column moved)", () => {
    const out = applyRealtimeDelta(rows, {
      eventType: "UPDATE",
      new: { id: "a", created_at: "2026-05-01", status: "done" },
      old: { id: "a" },
    }, desc);
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
    expect(out[0].status).toBe("done");
    expect(out).toHaveLength(2); // replaced, not duplicated
  });

  it("DELETE removes by id even when old carries only the primary key", () => {
    const out = applyRealtimeDelta(rows, { eventType: "DELETE", new: {}, old: { id: "b" } }, desc);
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("softDelete: UPDATE setting is_archived=true drops the row from the default list", () => {
    const opts = { orderBy: { column: "created_at" }, softDelete: true };
    const out = applyRealtimeDelta(rows, {
      eventType: "UPDATE",
      new: { id: "b", created_at: "2026-02-01", is_archived: true },
      old: { id: "b" },
    }, opts);
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("softDelete: INSERT of an archived row is not added", () => {
    const opts = { orderBy: { column: "created_at" }, softDelete: true };
    const out = applyRealtimeDelta(rows, {
      eventType: "INSERT",
      new: { id: "x", created_at: "2027-01-01", is_archived: true },
      old: {},
    }, opts);
    expect(out.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("softDelete: UPDATE restoring (is_archived=false) re-inserts in order", () => {
    const opts = { orderBy: { column: "created_at" }, softDelete: true };
    const out = applyRealtimeDelta(rows, {
      eventType: "UPDATE",
      new: { id: "r", created_at: "2026-01-15", is_archived: false },
      old: { id: "r" },
    }, opts);
    expect(out.map((r) => r.id)).toEqual(["b", "r", "a"]);
  });

  it("is a no-op when the payload has no id (backstop refetch reconciles)", () => {
    const out = applyRealtimeDelta(rows, { eventType: "DELETE", new: {}, old: {} }, desc);
    expect(out).toBe(rows);
  });
});

// ---------------------------------------------------------------------------
// list() pagination — PostgREST caps unranged selects at 1000 rows.
// ---------------------------------------------------------------------------
describe("makeRepo list() pagination", () => {
  const mkRows = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, created_at: "2026-01-01" }));

  it("fetches a single page when under the 1000-row cap", async () => {
    s.__pages.push(mkRows("a", 3));
    const repo = makeRepo("things", { orderBy: { column: "created_at" } });
    const rows = await repo.list();
    expect(rows).toHaveLength(3);
    expect(rows[0].createdAt).toBe("2026-01-01"); // camelized
    expect(s.__rangeCalls).toEqual([[0, 999]]);
  });

  it("pages past 1000 rows and concatenates until a short page", async () => {
    s.__pages.push(mkRows("a", 1000), mkRows("b", 250));
    const repo = makeRepo("things", { orderBy: { column: "created_at" } });
    const rows = await repo.list();
    expect(rows).toHaveLength(1250);
    expect(s.__rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("stops at MAX_ROWS (10000) and warns instead of looping forever", async () => {
    for (let i = 0; i < 12; i++) s.__pages.push(mkRows(`p${i}-`, 1000));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const repo = makeRepo("things", {});
    const rows = await repo.list();
    expect(rows).toHaveLength(10000);
    expect(s.__rangeCalls).toHaveLength(10);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("MAX_ROWS"));
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// subscribe() — unique channel topics, delta-driven callbacks, retry-once.
// ---------------------------------------------------------------------------
describe("makeRepo subscribe()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives every subscription its own channel topic (no cross-component collisions)", async () => {
    const repo = makeRepo("jobs", { orderBy: { column: "date", ascending: true } });
    const unsub1 = repo.subscribe(() => {});
    const unsub2 = repo.subscribe(() => {});
    await flush();

    expect(s.__channels).toHaveLength(2);
    const [c1, c2] = s.__channels;
    expect(c1.topic).not.toBe(c2.topic);
    expect(c1.topic.startsWith("jobs-")).toBe(true);

    // Unsubscribing one tears down ONLY its own channel.
    unsub1();
    expect(s.__removed).toEqual([c1]);
    unsub2();
    expect(s.__removed).toEqual([c1, c2]);
  });

  it("applies event deltas to the list without refetching, always calling back with the full array", async () => {
    s.__pages.push([{ id: "a", created_at: "2026-01-01" }]);
    const seen: any[] = [];
    const repo = makeRepo("crews", { orderBy: { column: "created_at" } });
    const unsub = repo.subscribe((rows) => seen.push(rows));
    await flush(); // initial full load
    expect(seen.at(-1).map((r: any) => r.id)).toEqual(["a"]);

    const fetchesBefore = s.__rangeCalls.length;
    const ch = s.__channels[0];
    ch.handler({ eventType: "INSERT", new: { id: "b", created_at: "2026-02-01" }, old: {} });
    ch.handler({ eventType: "DELETE", new: {}, old: { id: "a" } });

    expect(seen.at(-1).map((r: any) => r.id)).toEqual(["b"]);
    expect(s.__rangeCalls.length).toBe(fetchesBefore); // no per-event refetch
    unsub(); // also clears the trailing backstop timer
  });

  it("schedules ONE trailing full refetch 30s after the last event (consistency backstop)", async () => {
    vi.useFakeTimers();
    const repo = makeRepo("crews", { orderBy: { column: "created_at" } });
    const unsub = repo.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0); // initial load
    const fetchesBefore = s.__rangeCalls.length;

    const ch = s.__channels[0];
    ch.handler({ eventType: "INSERT", new: { id: "x", created_at: "1" }, old: {} });
    await vi.advanceTimersByTimeAsync(15_000);
    ch.handler({ eventType: "INSERT", new: { id: "y", created_at: "2" }, old: {} }); // resets debounce
    await vi.advanceTimersByTimeAsync(29_000);
    expect(s.__rangeCalls.length).toBe(fetchesBefore); // not yet

    await vi.advanceTimersByTimeAsync(1_100);
    expect(s.__rangeCalls.length).toBe(fetchesBefore + 1); // exactly one backstop refetch
    unsub();
  });

  it("retries the subscription once (after 2s) on CHANNEL_ERROR, then stops", async () => {
    vi.useFakeTimers();
    const repo = makeRepo("jobs", {});
    const unsub = repo.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);

    const first = s.__channels[0];
    first.statusCb("CHANNEL_ERROR");
    expect(s.__removed).toContain(first); // dead channel torn down

    await vi.advanceTimersByTimeAsync(2_100);
    expect(s.__channels).toHaveLength(2); // reconnected on a fresh channel
    const second = s.__channels[1];
    expect(second.topic).not.toBe(first.topic);

    second.statusCb("CHANNEL_ERROR"); // second failure: no infinite loop
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.__channels).toHaveLength(2);
    unsub();
  });
});
