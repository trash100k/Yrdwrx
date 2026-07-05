import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  normalizeCompany,
  normalizeSku,
  sanitizeImportedCell,
  similarity,
  guessMapping,
  mapRow,
  buildImportPlan,
  buildCustomerMergePlan,
  findDuplicateGroups,
  customerMatch,
  inventoryMatch,
  CUSTOMER_FIELDS,
  INVENTORY_FIELDS,
} from "./csvImport";

// Assign fake ids to a set of created rows, simulating what the DB returns after import,
// so we can re-run the planner against "existing" rows without any I/O.
function withIds<T extends Record<string, any>>(rows: T[]): Array<T & { id: string }> {
  return rows.map((r, i) => ({ ...r, id: `row-${i}` }));
}

describe("normalization", () => {
  it("normalizeEmail lowercases, trims, rejects junk", () => {
    expect(normalizeEmail("  Bob@Example.COM ")).toBe("bob@example.com");
    expect(normalizeEmail("n/a")).toBe("");
    expect(normalizeEmail("=HYPERLINK(1)")).toBe("");
    expect(normalizeEmail("")).toBe("");
  });

  it("normalizePhone strips formatting and the US country code", () => {
    expect(normalizePhone("+1 (555) 010-1234")).toBe("5550101234");
    expect(normalizePhone("555.010.1234")).toBe("5550101234");
    expect(normalizePhone("15550101234")).toBe("5550101234");
    expect(normalizePhone("123")).toBe(""); // too short to be a match key
  });

  it("normalizeName strips accents/punctuation and collapses whitespace", () => {
    expect(normalizeName("  José  O'Brien-Smith ")).toBe("jose o brien smith");
  });

  it("normalizeCompany drops legal suffixes", () => {
    expect(normalizeCompany("Green Thumb LLC")).toBe("green thumb");
    expect(normalizeCompany("The Lawn Co.")).toBe("lawn");
  });

  it("normalizeSku keeps only uppercase alphanumerics", () => {
    expect(normalizeSku("mulch-brown_01")).toBe("MULCHBROWN01");
  });
});

describe("CSV/formula injection neutralization on import (CWE-1236)", () => {
  it("prefixes a single quote on formula-lead cells", () => {
    expect(sanitizeImportedCell("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    expect(sanitizeImportedCell("+1+2")).toBe("'+1+2");
    expect(sanitizeImportedCell("-1")).toBe("'-1");
    expect(sanitizeImportedCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("defeats the leading-whitespace bypass by trimming first", () => {
    expect(sanitizeImportedCell("   =WEBSERVICE(1)")).toBe("'=WEBSERVICE(1)");
    expect(sanitizeImportedCell("\t=1")).toBe("'=1");
  });

  it("leaves ordinary text and numbers untouched", () => {
    expect(sanitizeImportedCell("Bob")).toBe("Bob");
    expect(sanitizeImportedCell("42")).toBe("42");
    expect(sanitizeImportedCell(null)).toBe("");
  });

  it("neutralizes a formula that arrives through the full mapRow pipeline", () => {
    const mapping = { Name: "firstName", Notes: "notes" };
    const row = mapRow({ Name: "=2+5", Notes: "@evil()" }, mapping, CUSTOMER_FIELDS);
    expect(String(row.firstName).startsWith("'=")).toBe(true);
    expect(String(row.notes).startsWith("'@")).toBe(true);
  });
});

describe("similarity", () => {
  it("scores identical strings 1 and disjoint strings low", () => {
    expect(similarity("bob smith", "bob smith")).toBe(1);
    expect(similarity("katherine johnson", "katherine johnston")).toBeGreaterThan(0.9);
    expect(similarity("bob", "alice")).toBeLessThan(0.5);
  });
});

describe("guessMapping (arbitrary headers -> fields)", () => {
  it("auto-maps common header spellings for customers", () => {
    const m = guessMapping(
      ["First Name", "last_name", "E-Mail", "Phone Number", "Service Address", "Junk Column"],
      CUSTOMER_FIELDS,
    );
    expect(m["First Name"]).toBe("firstName");
    expect(m["last_name"]).toBe("lastName");
    expect(m["E-Mail"]).toBe("email");
    expect(m["Phone Number"]).toBe("phone");
    expect(m["Service Address"]).toBe("address");
    expect(m["Junk Column"]).toBe(""); // unmatched -> ignore
  });

  it("maps inventory headers including qty/reorder aliases", () => {
    const m = guessMapping(["Item", "SKU", "Qty On Hand", "Reorder Point", "Supplier"], INVENTORY_FIELDS);
    expect(m["Item"]).toBe("name");
    expect(m["SKU"]).toBe("sku");
    expect(m["Qty On Hand"]).toBe("quantity");
    expect(m["Reorder Point"]).toBe("minThreshold");
    expect(m["Supplier"]).toBe("vendor");
  });

  it("does not assign the same field to two headers", () => {
    const m = guessMapping(["email", "email address"], CUSTOMER_FIELDS);
    const assigned = Object.values(m).filter((f) => f === "email");
    expect(assigned.length).toBe(1);
  });
});

describe("mapRow coercion", () => {
  it("coerces numbers and drops empty cells (inventory)", () => {
    const mapping = { Qty: "quantity", Price: "unitPrice", Blank: "brand" };
    const row = mapRow({ Qty: "12", Price: "$4.50", Blank: "  " }, mapping, INVENTORY_FIELDS);
    expect(row.quantity).toBe(12);
    expect(row.unitPrice).toBe(4.5);
    expect("brand" in row).toBe(false); // empty -> omitted (won't blank an existing value)
  });

  it("splits tags on |,; separators (customers)", () => {
    const row = mapRow({ Tags: "vip | net30 ; hoa" }, { Tags: "tags" }, CUSTOMER_FIELDS);
    expect(row.tags).toEqual(["vip", "net30", "hoa"]);
  });
});

describe("buildImportPlan — dedupe on customers", () => {
  const file = [
    { firstName: "Bob", lastName: "Smith", email: "BOB@x.com", phone: "(555) 010-1234", address: "1 Elm St" },
    { firstName: "Alice", lastName: "Jones", email: "alice@x.com", phone: "", address: "2 Oak Ave" },
    { firstName: "Carlos", lastName: "Reyes", email: "", phone: "555-777-8888", address: "3 Pine Rd" },
  ];

  it("first import (empty DB) creates every row", () => {
    const plan = buildImportPlan(file, [], customerMatch);
    expect(plan.counts.create).toBe(3);
    expect(plan.counts.update).toBe(0);
  });

  it("ACCEPTANCE: re-importing the SAME file creates ZERO duplicates (all updates)", () => {
    // Simulate the DB after the first import.
    const existing = withIds(file);
    const plan = buildImportPlan(file, existing, customerMatch);
    expect(plan.counts.create).toBe(0);
    expect(plan.counts.update).toBe(3);
    // Each update targets the right existing row.
    expect(plan.decisions[0].matchId).toBe("row-0"); // matched on email
    expect(plan.decisions[2].matchId).toBe("row-2"); // matched on phone (no email)
  });

  it("matches on phone even when email/casing/formatting differ", () => {
    const existing = withIds([{ firstName: "Bobby", lastName: "S", email: "different@x.com", phone: "5550101234" }]);
    const plan = buildImportPlan(
      [{ firstName: "Bob", lastName: "Smith", email: "", phone: "+1 (555) 010-1234" }],
      existing,
      customerMatch,
    );
    expect(plan.decisions[0].action).toBe("update");
    expect(plan.decisions[0].matchId).toBe(existing[0].id);
  });

  it("collapses duplicate rows WITHIN the same file (create + skip, never two creates)", () => {
    const dupFile = [
      { firstName: "Dana", lastName: "Lee", email: "dana@x.com" },
      { firstName: "Dana", lastName: "Lee", email: "DANA@x.com" }, // same person, different casing
    ];
    const plan = buildImportPlan(dupFile, [], customerMatch);
    expect(plan.counts.create).toBe(1);
    expect(plan.counts.skip).toBe(1);
  });

  it("ACCEPTANCE: flags a near-duplicate for confirmation instead of creating or updating", () => {
    const existing = withIds([{ firstName: "Katherine", lastName: "Johnson", email: "kj@x.com" }]);
    // Same person, typo'd last name, and a DIFFERENT email/no phone → not an exact key match.
    const plan = buildImportPlan(
      [{ firstName: "Katherine", lastName: "Johnston", email: "", phone: "" }],
      existing,
      customerMatch,
    );
    const d = plan.decisions[0];
    expect(d.action).toBe("review");
    expect(d.matchId).toBe(existing[0].id);
    expect(d.score).toBeGreaterThan(0.9);
    expect(d.reason).toContain("Possible duplicate");
  });

  it("flags ambiguity when an exact key hits multiple existing rows", () => {
    const existing = [
      { id: "a", firstName: "Sam", lastName: "One", phone: "5551112222" },
      { id: "b", firstName: "Sam", lastName: "Two", phone: "5551112222" },
    ];
    const plan = buildImportPlan([{ firstName: "Sam", lastName: "X", phone: "555-111-2222" }], existing, customerMatch);
    expect(plan.decisions[0].action).toBe("review");
    expect(plan.decisions[0].candidates?.length).toBe(2);
  });
});

describe("buildImportPlan — dedupe on inventory", () => {
  it("re-import by SKU updates rather than duplicates", () => {
    const file = [
      { name: "Brown Mulch", sku: "MULCH-01", vendor: "Acme", quantity: 40 },
      { name: "Grass Seed", sku: "SEED-09", vendor: "Acme", quantity: 12 },
    ];
    const existing = withIds(file);
    const plan = buildImportPlan(file, existing, inventoryMatch);
    expect(plan.counts.update).toBe(2);
    expect(plan.counts.create).toBe(0);
  });

  it("matches SKU regardless of dashes/case", () => {
    const existing = withIds([{ name: "Brown Mulch", sku: "MULCH01", vendor: "Acme" }]);
    const plan = buildImportPlan([{ name: "Brown Mulch", sku: "mulch-01" }], existing, inventoryMatch);
    expect(plan.decisions[0].action).toBe("update");
  });
});

describe("buildCustomerMergePlan", () => {
  const survivor = {
    id: "keep",
    firstName: "Bob",
    lastName: "Smith",
    email: "bob@x.com",
    phone: "",
    address: "1 Elm St",
    tags: ["vip"],
    notes: "prefers morning visits",
    data: { budget: "5000" },
  };
  const loser = {
    id: "drop",
    firstName: "Bob",
    lastName: "Smith",
    email: "bob.old@x.com",
    phone: "5550101234",
    address: "",
    tags: ["net30"],
    notes: "gate code 4455",
    data: { serviceInterest: "lawn" },
  };

  it("fills only the survivor's blanks and never overwrites its values", () => {
    const plan = buildCustomerMergePlan(survivor, loser);
    expect(plan.patch.phone).toBe("5550101234"); // survivor was blank -> filled
    expect(plan.patch.email).toBeUndefined(); // survivor already had one -> kept
    expect(plan.patch.address).toBeUndefined(); // survivor had one -> loser's blank ignored
  });

  it("unions tags and concatenates notes", () => {
    const plan = buildCustomerMergePlan(survivor, loser);
    expect(plan.patch.tags).toEqual(["vip", "net30"]);
    expect(String(plan.patch.notes)).toContain("prefers morning visits");
    expect(String(plan.patch.notes)).toContain("[merged] gate code 4455");
  });

  it("shallow-merges jsonb (survivor wins, loser fills gaps)", () => {
    const plan = buildCustomerMergePlan(survivor, loser);
    expect(plan.patch.data).toEqual({ serviceInterest: "lawn", budget: "5000" });
  });

  it("targets the customer child tables for reassignment", () => {
    const plan = buildCustomerMergePlan(survivor, loser);
    expect(plan.reassignChildTables).toContain("jobs");
    expect(plan.reassignChildTables).toContain("invoices");
    expect(plan.survivorId).toBe("keep");
    expect(plan.loserId).toBe("drop");
  });
});

describe("findDuplicateGroups", () => {
  it("groups exact-key dupes and fuzzy near-dupes", () => {
    const rows = [
      { id: "1", firstName: "Bob", lastName: "Smith", email: "bob@x.com" },
      { id: "2", firstName: "Bobby", lastName: "Smith", email: "BOB@x.com" }, // exact (email)
      { id: "3", firstName: "Katherine", lastName: "Johnson", phone: "5551110000" },
      { id: "4", firstName: "Katherine", lastName: "Johnston", phone: "5559990000" }, // near (name)
      { id: "5", firstName: "Unique", lastName: "Person", email: "u@x.com" },
    ];
    const groups = findDuplicateGroups(rows, customerMatch);
    const exact = groups.find((g) => g.confidence === "exact");
    const near = groups.find((g) => g.confidence === "near");
    expect(exact?.members.map((m) => m.id).sort()).toEqual(["1", "2"]);
    expect(near?.members.map((m) => m.id).sort()).toEqual(["3", "4"]);
    // The unique row is in no group.
    expect(groups.every((g) => !g.members.some((m) => m.id === "5"))).toBe(true);
  });
});
