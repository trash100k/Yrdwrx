// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";

// agentActions.ts is the unified voice/text agent write path. Mis-parsing an amount,
// a customer name, or HOA rules produces bad DB writes, so the parsing helpers are the
// highest-value thing to pin down.
//
// The module imports `./repos` (which constructs a real Supabase client transitively)
// and `./supabase`. We mock both so importing the module is hermetic and so the dispatch
// tests can assert the exact args handed to each repo. Hoisted vi.mock factories run
// before the import below.
vi.mock("./repos", () => ({
  customersRepo: {
    create: vi.fn(),
    update: vi.fn(),
    findByNameOrPhone: vi.fn(),
  },
  jobsRepo: { create: vi.fn() },
  invoicesRepo: { create: vi.fn() },
  expensesRepo: { create: vi.fn() },
  inventoryRepo: { list: vi.fn(), update: vi.fn() },
  tasksRepo: { create: vi.fn() },
}));

vi.mock("./supabase", () => ({
  supabase: { from: vi.fn(() => ({ insert: vi.fn() })) },
}));

import {
  parseRules,
  toDateOrNull,
  prettyName,
  parseMoney,
  executeAgentAction,
} from "./agentActions";

describe("parseMoney", () => {
  it("parses plain numbers and numeric strings", () => {
    expect(parseMoney(1200)).toBe(1200);
    expect(parseMoney("1200")).toBe(1200);
    expect(parseMoney("1200.50")).toBe(1200.5);
  });
  it("strips currency formatting (regression: Number('$1,200') was NaN -> a $0 invoice)", () => {
    expect(parseMoney("$1,200")).toBe(1200);
    expect(parseMoney("$1,200.50")).toBe(1200.5);
    expect(parseMoney("1,000")).toBe(1000);
  });
  it("falls back to 0 for junk/empty/nullish", () => {
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("abc")).toBe(0);
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney(undefined)).toBe(0);
    expect(parseMoney(NaN)).toBe(0);
  });
});
import {
  customersRepo,
  invoicesRepo,
  jobsRepo,
} from "./repos";

// ---------------------------------------------------------------------------
// parseRules — HOA prose -> clean string[]
// ---------------------------------------------------------------------------
describe("parseRules", () => {
  it("returns [] for null / undefined / non-string-non-array input", () => {
    expect(parseRules(null)).toEqual([]);
    expect(parseRules(undefined)).toEqual([]);
    expect(parseRules(42)).toEqual([]);
    expect(parseRules({})).toEqual([]);
  });

  it("returns [] for empty / whitespace-only prose", () => {
    expect(parseRules("")).toEqual([]);
    expect(parseRules("   ")).toEqual([]);
    expect(parseRules("\n\n")).toEqual([]);
  });

  it("passes through an array, trimming and dropping empties", () => {
    expect(parseRules(["  No mowing before 8am ", "", "  ", "Bag clippings"])).toEqual([
      "No mowing before 8am",
      "Bag clippings",
    ]);
  });

  it("coerces non-string array members to trimmed strings", () => {
    expect(parseRules([1, 2])).toEqual(["1", "2"]);
  });

  it("splits prose on newlines", () => {
    expect(parseRules("No mowing before 8am\nBag all clippings\nGate stays shut")).toEqual([
      "No mowing before 8am",
      "Bag all clippings",
      "Gate stays shut",
    ]);
  });

  it("splits prose on commas and semicolons", () => {
    expect(parseRules("No mowing before 8am, bag clippings; gate stays shut")).toEqual([
      "No mowing before 8am",
      "bag clippings",
      "gate stays shut",
    ]);
  });

  it('splits on the word "and" (case-insensitive, word-boundaried)', () => {
    expect(parseRules("Bag clippings AND keep the gate shut and no leaf blowers")).toEqual([
      "Bag clippings",
      "keep the gate shut",
      "no leaf blowers",
    ]);
  });

  it('does NOT split "and" that is embedded inside a word', () => {
    // \band\b means "Sandbox" / "standard" must survive intact.
    expect(parseRules("Use standard mulch only")).toEqual(["Use standard mulch only"]);
  });

  it("handles numbered / mixed-delimiter prose, dropping empties between delimiters", () => {
    expect(parseRules("1. No mowing,, 2. Bag clippings\n\n3. Gate shut")).toEqual([
      "1. No mowing",
      "2. Bag clippings",
      "3. Gate shut",
    ]);
  });
});

// ---------------------------------------------------------------------------
// toDateOrNull — lenient date coercion -> ISO string | null
// ---------------------------------------------------------------------------
describe("toDateOrNull", () => {
  it("returns null for falsy input", () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
    expect(toDateOrNull("")).toBeNull();
    expect(toDateOrNull(0)).toBeNull();
  });

  it("returns null for unparseable garbage", () => {
    expect(toDateOrNull("not a date")).toBeNull();
    expect(toDateOrNull("abc123")).toBeNull();
  });

  it("parses an ISO date string to a normalized ISO string", () => {
    const out = toDateOrNull("2026-06-30T12:00:00.000Z");
    expect(out).toBe("2026-06-30T12:00:00.000Z");
  });

  it("parses a plain calendar date (date-only) to an ISO string", () => {
    const out = toDateOrNull("2026-06-30");
    expect(out).not.toBeNull();
    // Round-trips to the same instant regardless of how Date normalized it.
    expect(new Date(out).toISOString()).toBe(out);
    expect(out.startsWith("2026-06-30")).toBe(true);
  });

  it("accepts a Date instance and a numeric epoch", () => {
    const d = new Date("2026-01-15T00:00:00.000Z");
    expect(toDateOrNull(d)).toBe("2026-01-15T00:00:00.000Z");
    // Note: 0 is treated as falsy by the helper (returns null), so use a non-zero epoch.
    expect(toDateOrNull(d.getTime())).toBe("2026-01-15T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// prettyName — already exported; underscores -> spaces, falsy -> "action"
// ---------------------------------------------------------------------------
describe("prettyName", () => {
  it("replaces underscores with spaces", () => {
    expect(prettyName("create_invoice")).toBe("create invoice");
    expect(prettyName("set_hoa_rules")).toBe("set hoa rules");
  });

  it('falls back to "action" for empty / falsy names', () => {
    expect(prettyName("")).toBe("action");
    expect(prettyName(undefined)).toBe("action");
    expect(prettyName(null)).toBe("action");
  });
});

// ---------------------------------------------------------------------------
// executeAgentAction — dispatch + arg coercion (the part that produces DB writes)
// ---------------------------------------------------------------------------
describe("executeAgentAction dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create_contact / create_lead — name splitting", () => {
    it('splits a single "name" into first + last', async () => {
      customersRepo.create.mockResolvedValue({ id: "c1" });
      const res = await executeAgentAction({ name: "create_contact", args: { name: "John Smith" } });
      expect(res.ok).toBe(true);
      expect(customersRepo.create).toHaveBeenCalledTimes(1);
      const arg = customersRepo.create.mock.calls[0][0];
      expect(arg.first_name).toBe("John");
      expect(arg.last_name).toBe("Smith");
      expect(arg.status).toBe("lead");
    });

    it("treats a multi-token surname as everything after the first token", async () => {
      customersRepo.create.mockResolvedValue({ id: "c2" });
      await executeAgentAction({ name: "create_lead", args: { name: "Mary Anne Van Der Berg" } });
      const arg = customersRepo.create.mock.calls[0][0];
      expect(arg.first_name).toBe("Mary");
      expect(arg.last_name).toBe("Anne Van Der Berg");
    });

    it('falls back to "New"/"Lead" when name is a single token (no last name)', async () => {
      customersRepo.create.mockResolvedValue({ id: "c3" });
      await executeAgentAction({ name: "create_contact", args: { name: "Cher" } });
      const arg = customersRepo.create.mock.calls[0][0];
      expect(arg.first_name).toBe("Cher");
      // split(" ").slice(1).join(" ") on a single token is "", which || "Lead" replaces.
      expect(arg.last_name).toBe("Lead");
    });

    it('falls back to "New"/"Lead" when no name is supplied at all', async () => {
      customersRepo.create.mockResolvedValue({ id: "c4" });
      await executeAgentAction({ name: "create_contact", args: {} });
      const arg = customersRepo.create.mock.calls[0][0];
      expect(arg.first_name).toBe("New");
      expect(arg.last_name).toBe("Lead");
    });

    it("prefers explicit firstName/lastName over the combined name", async () => {
      customersRepo.create.mockResolvedValue({ id: "c5" });
      await executeAgentAction({
        name: "create_contact",
        args: { firstName: "Jane", lastName: "Doe", name: "Ignore Me" },
      });
      const arg = customersRepo.create.mock.calls[0][0];
      expect(arg.first_name).toBe("Jane");
      expect(arg.last_name).toBe("Doe");
    });
  });

  describe("create_invoice / create_quote — amount coercion", () => {
    beforeEach(() => {
      // No loaded customer and no name match -> customer is null, amount path still runs.
      customersRepo.findByNameOrPhone.mockResolvedValue([]);
      invoicesRepo.create.mockResolvedValue({ id: "inv1" });
    });

    it("coerces a clean numeric string to a number", async () => {
      await executeAgentAction({ name: "create_invoice", args: { amount: "1200" } });
      expect(invoicesRepo.create.mock.calls[0][0].amount).toBe(1200);
    });

    it("coerces a numeric value as-is", async () => {
      await executeAgentAction({ name: "create_invoice", args: { amount: 1200 } });
      expect(invoicesRepo.create.mock.calls[0][0].amount).toBe(1200);
    });

    it('parses a currency-formatted string like "$1,200" (was a $0 footgun before parseMoney)', async () => {
      await executeAgentAction({ name: "create_invoice", args: { amount: "$1,200" } });
      expect(invoicesRepo.create.mock.calls[0][0].amount).toBe(1200);
    });

    it("falls back to 0 for empty string, null, and non-numeric junk", async () => {
      for (const bad of ["", null, undefined, "abc"]) {
        invoicesRepo.create.mockClear();
        await executeAgentAction({ name: "create_invoice", args: { amount: bad } });
        expect(invoicesRepo.create.mock.calls[0][0].amount).toBe(0);
      }
    });

    it("marks create_invoice as an invoice and create_quote as a quote in data.kind", async () => {
      await executeAgentAction({ name: "create_invoice", args: { amount: 100 } });
      expect(invoicesRepo.create.mock.calls[0][0].data.kind).toBe("invoice");

      invoicesRepo.create.mockClear();
      await executeAgentAction({ name: "create_quote", args: { amount: 100 } });
      expect(invoicesRepo.create.mock.calls[0][0].data.kind).toBe("quote");
    });

    it("writes status 'draft' (lowercase, portal-oriented)", async () => {
      await executeAgentAction({ name: "create_invoice", args: { amount: 50 } });
      expect(invoicesRepo.create.mock.calls[0][0].status).toBe("draft");
    });
  });

  describe("schedule_job — date coercion via toDateOrNull", () => {
    it("passes a parsed ISO date through to jobsRepo.create", async () => {
      customersRepo.findByNameOrPhone.mockResolvedValue([]);
      jobsRepo.create.mockResolvedValue({ id: "j1", title: "Mow" });
      await executeAgentAction({
        name: "schedule_job",
        args: { title: "Mow", date: "2026-07-04T09:00:00.000Z" },
      });
      expect(jobsRepo.create.mock.calls[0][0].date).toBe("2026-07-04T09:00:00.000Z");
    });

    it("leaves date null when no date arg is supplied", async () => {
      customersRepo.findByNameOrPhone.mockResolvedValue([]);
      jobsRepo.create.mockResolvedValue({ id: "j2", title: "Service visit" });
      await executeAgentAction({ name: "schedule_job", args: {} });
      expect(jobsRepo.create.mock.calls[0][0].date).toBeNull();
    });
  });

  describe("error + unknown-action handling (never throws)", () => {
    it("returns a structured failure (not a throw) when a repo rejects", async () => {
      customersRepo.create.mockRejectedValue(new Error("db exploded"));
      const res = await executeAgentAction({ name: "create_contact", args: { name: "Boom Boom" } });
      expect(res.ok).toBe(false);
      expect(res.message).toContain("db exploded");
    });

    it("returns ok:false with a friendly message for an unknown action", async () => {
      const res = await executeAgentAction({ name: "make_coffee", args: {} });
      expect(res.ok).toBe(false);
      expect(res.message).toContain("make coffee");
    });
  });
});
