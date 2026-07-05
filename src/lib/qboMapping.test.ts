import { describe, it, expect } from "vitest";
import {
  mapCustomerToQbo,
  mapInvoiceToQbo,
  reconcile,
  type Link,
} from "./qboMapping";

/* -------------------------------------------------------------------------- */
/* mapCustomerToQbo                                                           */
/* -------------------------------------------------------------------------- */

describe("mapCustomerToQbo", () => {
  it("prefers company name for DisplayName", () => {
    const out = mapCustomerToQbo({
      companyName: "Acme Landscaping",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.com",
    });
    expect(out.DisplayName).toBe("Acme Landscaping");
    expect(out.PrimaryEmailAddr).toEqual({ Address: "jane@acme.com" });
  });

  it("falls back to full name when there is no company", () => {
    expect(mapCustomerToQbo({ firstName: "Jane", lastName: "Doe" }).DisplayName).toBe("Jane Doe");
  });

  it("uses only the available name part", () => {
    expect(mapCustomerToQbo({ firstName: "Jane" }).DisplayName).toBe("Jane");
    expect(mapCustomerToQbo({ lastName: "Doe" }).DisplayName).toBe("Doe");
  });

  it("falls back to email, then phone, then a safe placeholder", () => {
    expect(mapCustomerToQbo({ email: "solo@x.io" }).DisplayName).toBe("solo@x.io");
    expect(mapCustomerToQbo({ phone: "555-1212" }).DisplayName).toBe("555-1212");
    expect(mapCustomerToQbo({}).DisplayName).toBe("Unnamed Customer");
  });

  it("never emits an empty DisplayName from whitespace-only fields", () => {
    const out = mapCustomerToQbo({ companyName: "   ", firstName: "  ", email: "   " });
    expect(out.DisplayName).toBe("Unnamed Customer");
    expect(out.PrimaryEmailAddr).toBeUndefined();
  });

  it("trims contact fields and omits empty optionals", () => {
    const out = mapCustomerToQbo({ companyName: "  Acme  ", email: "  a@b.co  ", phone: "" });
    expect(out.DisplayName).toBe("Acme");
    expect(out.PrimaryEmailAddr).toEqual({ Address: "a@b.co" });
    expect(out.PrimaryPhone).toBeUndefined();
  });

  it("ignores non-string / null / undefined inputs without throwing", () => {
    // @ts-expect-error — exercising defensive runtime handling of bad data
    const out = mapCustomerToQbo({ companyName: 42, email: null, phone: undefined });
    expect(out.DisplayName).toBe("Unnamed Customer");
    expect(out.PrimaryEmailAddr).toBeUndefined();
    expect(out.PrimaryPhone).toBeUndefined();
    expect(mapCustomerToQbo(null).DisplayName).toBe("Unnamed Customer");
    expect(mapCustomerToQbo(undefined).DisplayName).toBe("Unnamed Customer");
  });
});

/* -------------------------------------------------------------------------- */
/* mapInvoiceToQbo                                                            */
/* -------------------------------------------------------------------------- */

describe("mapInvoiceToQbo", () => {
  it("builds lines from qty * unitPrice and sums TotalAmt", () => {
    const out = mapInvoiceToQbo(
      {
        items: [
          { description: "Mowing", quantity: 2, unitPrice: 50 },
          { name: "Mulch", quantity: 3, unitPrice: 10 },
        ],
      },
      "QBO-C-1",
    );
    expect(out.CustomerRef).toEqual({ value: "QBO-C-1" });
    expect(out.Line).toEqual([
      {
        DetailType: "SalesItemLineDetail",
        Amount: 100,
        Description: "Mowing",
        SalesItemLineDetail: { Qty: 2, UnitPrice: 50 },
      },
      {
        DetailType: "SalesItemLineDetail",
        Amount: 30,
        Description: "Mulch",
        SalesItemLineDetail: { Qty: 3, UnitPrice: 10 },
      },
    ]);
    expect(out.TotalAmt).toBe(130);
  });

  it("uses item.amount when qty/unitPrice are absent", () => {
    const out = mapInvoiceToQbo({ items: [{ description: "Flat fee", amount: 75 }] }, "c1");
    expect(out.Line[0]).toEqual({
      DetailType: "SalesItemLineDetail",
      Amount: 75,
      Description: "Flat fee",
      SalesItemLineDetail: {},
    });
    expect(out.TotalAmt).toBe(75);
  });

  it("coerces numeric strings and rounds to cents", () => {
    const out = mapInvoiceToQbo({ items: [{ quantity: "3", unitPrice: "10.005" }] }, "c1");
    expect(out.Line[0].Amount).toBe(30.02); // 30.015 -> 30.02
    expect(out.Line[0].SalesItemLineDetail).toEqual({ Qty: 3, UnitPrice: 10.005 });
  });

  it("guards NaN / non-numeric values to a zero amount", () => {
    const out = mapInvoiceToQbo({ items: [{ description: "Bad", quantity: "abc", amount: "nope" }] }, "c1");
    expect(out.Line[0].Amount).toBe(0);
    expect(out.Line[0].SalesItemLineDetail).toEqual({});
    expect(out.TotalAmt).toBe(0);
  });

  it("emits a single lump-sum line when there are no items but a total exists", () => {
    const out = mapInvoiceToQbo({ amount: 250 }, "c1");
    expect(out.Line).toHaveLength(1);
    expect(out.Line[0]).toEqual({
      DetailType: "SalesItemLineDetail",
      Amount: 250,
      SalesItemLineDetail: {},
    });
    expect(out.TotalAmt).toBe(250);
  });

  it("produces an empty Line array for an empty / zero invoice", () => {
    expect(mapInvoiceToQbo({}, "c1").Line).toEqual([]);
    expect(mapInvoiceToQbo({ items: [] }, "c1").Line).toEqual([]);
    expect(mapInvoiceToQbo({ amount: 0 }, "c1").Line).toEqual([]);
    expect(mapInvoiceToQbo({}, "c1").TotalAmt).toBe(0);
  });

  it("skips null entries in the items array", () => {
    const out = mapInvoiceToQbo(
      // @ts-expect-error — defensive against dirty arrays
      { items: [null, { quantity: 1, unitPrice: 5 }, undefined] },
      "c1",
    );
    expect(out.Line).toHaveLength(1);
    expect(out.Line[0].Amount).toBe(5);
  });

  it("stringifies / defaults the CustomerRef value", () => {
    expect(mapInvoiceToQbo({}, 99).CustomerRef).toEqual({ value: "99" });
    expect(mapInvoiceToQbo({}, null).CustomerRef).toEqual({ value: "" });
    expect(mapInvoiceToQbo({}, undefined).CustomerRef).toEqual({ value: "" });
  });

  it("handles null / undefined invoice input", () => {
    expect(mapInvoiceToQbo(null, "c1")).toEqual({
      CustomerRef: { value: "c1" },
      Line: [],
      TotalAmt: 0,
    });
    expect(mapInvoiceToQbo(undefined, "c1").Line).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* reconcile fixtures                                                         */
/* -------------------------------------------------------------------------- */

const T0 = "2026-01-01T00:00:00.000Z"; // last-sync watermark
const T_OLD = "2025-12-31T00:00:00.000Z"; // before watermark (unchanged)
const T_NEW = "2026-02-01T00:00:00.000Z"; // after watermark (changed)
const T_NEWER = "2026-03-01T00:00:00.000Z";

function customer(id: string, updatedAt?: string, extra: Record<string, unknown> = {}) {
  return { id, companyName: `Cust ${id}`, updatedAt, ...extra };
}

function qboCustomer(Id: string, lastUpdated?: string) {
  return { Id, DisplayName: `Cust ${Id}`, MetaData: { LastUpdatedTime: lastUpdated } };
}

describe("reconcile", () => {
  it("treats a present + linked + unchanged pair as a no-op", () => {
    const local = [customer("L1", T_OLD)];
    const qbo = [qboCustomer("Q1", T_OLD)];
    const links: Link[] = [{ localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 }];

    const plan = reconcile(local, qbo, links, "customer");
    expect(plan.toPush).toEqual([]);
    expect(plan.toPull).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.alreadyLinked).toEqual(links);
  });

  it("pushes when only the local side changed", () => {
    const local = [customer("L1", T_NEW)];
    const qbo = [qboCustomer("Q1", T_OLD)];
    const links: Link[] = [{ localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 }];

    const plan = reconcile(local, qbo, links, "customer");
    expect(plan.toPush).toEqual(local);
    expect(plan.toPull).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.alreadyLinked).toEqual([]);
  });

  it("pulls when only the QBO side changed", () => {
    const local = [customer("L1", T_OLD)];
    const qbo = [qboCustomer("Q1", T_NEW)];
    const links: Link[] = [{ localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 }];

    const plan = reconcile(local, qbo, links, "customer");
    expect(plan.toPull).toEqual(qbo);
    expect(plan.toPush).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it("flags a conflict when both sides changed since the watermark", () => {
    const local = [customer("L1", T_NEW)];
    const qbo = [qboCustomer("Q1", T_NEWER)];
    const links: Link[] = [{ localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 }];

    const plan = reconcile(local, qbo, links, "customer");
    expect(plan.conflicts).toEqual([{ localId: "L1", qboId: "Q1" }]);
    expect(plan.toPush).toEqual([]);
    expect(plan.toPull).toEqual([]);
    expect(plan.alreadyLinked).toEqual([]);
  });

  it("pushes an unlinked local record and pulls an unlinked QBO record", () => {
    const local = [customer("L1", T_NEW)];
    const qbo = [qboCustomer("Q9", T_NEW)];

    const plan = reconcile(local, qbo, [], "customer");
    expect(plan.toPush).toEqual(local);
    expect(plan.toPull).toEqual(qbo);
    expect(plan.conflicts).toEqual([]);
    expect(plan.alreadyLinked).toEqual([]);
  });

  it("discovers a link via external id (local.qboId) and reports it as alreadyLinked", () => {
    const local = [customer("L1", T_OLD, { qboId: "Q1" })];
    const qbo = [qboCustomer("Q1", T_OLD)];

    const plan = reconcile(local, qbo, [], "customer");
    expect(plan.toPush).toEqual([]);
    expect(plan.toPull).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.alreadyLinked).toEqual([
      { localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T_OLD },
    ]);
  });

  it("treats a diverged external-id match (both timestamped, differing) as a conflict", () => {
    const local = [customer("L1", T_NEW, { qboId: "Q1" })];
    const qbo = [qboCustomer("Q1", T_OLD)];

    const plan = reconcile(local, qbo, [], "customer");
    expect(plan.conflicts).toEqual([{ localId: "L1", qboId: "Q1" }]);
    expect(plan.alreadyLinked).toEqual([]);
    expect(plan.toPush).toEqual([]);
    expect(plan.toPull).toEqual([]);
  });

  it("is idempotent: feeding discovered links back yields a pure no-op", () => {
    const local = [customer("L1", T_OLD, { qboId: "Q1" })];
    const qbo = [qboCustomer("Q1", T_OLD)];

    const first = reconcile(local, qbo, [], "customer");
    const second = reconcile(local, qbo, first.alreadyLinked, "customer");
    expect(second.toPush).toEqual([]);
    expect(second.toPull).toEqual([]);
    expect(second.conflicts).toEqual([]);
    expect(second.alreadyLinked).toEqual(first.alreadyLinked);
  });

  it("only considers links for the requested entity", () => {
    const local = [customer("L1", T_NEW)];
    const qbo = [qboCustomer("Q1", T_OLD)];
    // A link exists but for a different entity, so it must be ignored here.
    const links: Link[] = [{ localId: "L1", qboId: "Q1", entity: "invoice", updatedAt: T0 }];

    const plan = reconcile(local, qbo, links, "customer");
    // L1 is effectively unlinked for customers -> push; Q1 unlinked -> pull.
    expect(plan.toPush).toEqual(local);
    expect(plan.toPull).toEqual(qbo);
    expect(plan.alreadyLinked).toEqual([]);
  });

  it("repairs a linked pair whose QBO side is missing (push) or local side is missing (pull)", () => {
    const localOnly = [customer("L1", T_OLD)];
    const pushPlan = reconcile(localOnly, [], [
      { localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 },
    ], "customer");
    expect(pushPlan.toPush).toEqual(localOnly);
    expect(pushPlan.toPull).toEqual([]);

    const qboOnly = [qboCustomer("Q1", T_OLD)];
    const pullPlan = reconcile([], qboOnly, [
      { localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 },
    ], "customer");
    expect(pullPlan.toPull).toEqual(qboOnly);
    expect(pullPlan.toPush).toEqual([]);
  });

  it("drops an orphan link that references neither side", () => {
    const plan = reconcile([], [], [
      { localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 },
    ], "customer");
    expect(plan).toEqual({ toPush: [], toPull: [], conflicts: [], alreadyLinked: [] });
  });

  it("handles a mixed batch deterministically", () => {
    const local = [
      customer("L1", T_OLD), // linked, unchanged -> alreadyLinked
      customer("L2", T_NEW), // linked, local changed -> push
      customer("L3", T_OLD), // linked, qbo changed -> pull
      customer("L4", T_NEW), // linked, both changed -> conflict
      customer("L5", T_NEW), // unlinked -> push
    ];
    const qbo = [
      qboCustomer("Q1", T_OLD),
      qboCustomer("Q2", T_OLD),
      qboCustomer("Q3", T_NEW),
      qboCustomer("Q4", T_NEWER),
      qboCustomer("Q9", T_NEW), // unlinked -> pull
    ];
    const links: Link[] = [
      { localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 },
      { localId: "L2", qboId: "Q2", entity: "customer", updatedAt: T0 },
      { localId: "L3", qboId: "Q3", entity: "customer", updatedAt: T0 },
      { localId: "L4", qboId: "Q4", entity: "customer", updatedAt: T0 },
    ];

    const plan = reconcile(local, qbo, links, "customer");
    expect(plan.toPush.map((r) => r.id)).toEqual(["L2", "L5"]);
    expect(plan.toPull.map((r) => r.Id)).toEqual(["Q3", "Q9"]);
    expect(plan.conflicts).toEqual([{ localId: "L4", qboId: "Q4" }]);
    expect(plan.alreadyLinked.map((l) => l.localId)).toEqual(["L1"]);
  });

  it("treats missing/invalid timestamps as unchanged (NaN-safe watermark math)", () => {
    const local = [customer("L1", "not-a-date"), customer("L2")];
    const qbo = [qboCustomer("Q1"), qboCustomer("Q2", "garbage")];
    const links: Link[] = [
      { localId: "L1", qboId: "Q1", entity: "customer", updatedAt: T0 },
      { localId: "L2", qboId: "Q2", entity: "customer" }, // no watermark either
    ];

    const plan = reconcile(local, qbo, links, "customer");
    // No parseable timestamps anywhere -> nothing looks changed -> all already linked.
    expect(plan.toPush).toEqual([]);
    expect(plan.toPull).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.alreadyLinked).toHaveLength(2);
  });

  it("guards against null / non-array inputs and null entries", () => {
    // @ts-expect-error — defending against bad callers
    const plan = reconcile(null, undefined, null, "customer");
    expect(plan).toEqual({ toPush: [], toPull: [], conflicts: [], alreadyLinked: [] });

    const dirtyLocal = [null, customer("L1", T_NEW), undefined];
    const dirtyQbo = [undefined, qboCustomer("Q9", T_NEW), null];
    // @ts-expect-error — dirty arrays with holes
    const plan2 = reconcile(dirtyLocal, dirtyQbo, [null], "customer");
    expect(plan2.toPush.map((r) => r.id)).toEqual(["L1"]);
    expect(plan2.toPull.map((r) => r.Id)).toEqual(["Q9"]);
  });

  it("reconciles invoice-entity records using the same rules", () => {
    const local = [{ id: "INV1", amount: 100, updatedAt: T_NEW }];
    const qbo = [{ Id: "QINV1", updatedAt: T_OLD }];
    const links: Link[] = [{ localId: "INV1", qboId: "QINV1", entity: "invoice", updatedAt: T0 }];

    const plan = reconcile(local, qbo, links, "invoice");
    expect(plan.toPush).toEqual(local);
    expect(plan.toPull).toEqual([]);
  });
});
