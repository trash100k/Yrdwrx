// Two-way QBO sync — FIXTURE tests.
//
// Proves the money-/identity-sensitive core of feat-quickbooks-twoway (mapping + three-way
// reconcile) against REALISTIC QuickBooks-shaped JSON — the exact shapes the server's engine
// pulls from the QBO query API and feeds into reconcile(). No live creds required: this is the
// evidence for the logic while the live Intuit round-trip stays a documented human sandbox step.
//
// It complements qboMapping.test.ts (which unit-tests each rule in isolation) by exercising:
//   1. a full two-way pass over a realistic mixed batch (push / pull / conflict / already-linked),
//   2. the guard paths the server must degrade cleanly on — first sync / not connected (empty
//      QBO set), nothing-to-do, a malformed QBO page, and a RATE-LIMITED / truncated read that
//      must NEVER be reconciled as authoritative (it would misclassify linked records as deleted),
//   3. the QBO write payloads the server sends (mapCustomerToQbo / mapInvoiceToQbo), and
//   4. the QBO Payment → "mark invoice paid" linkage the server reads.

import { describe, it, expect } from "vitest";
import {
  mapCustomerToQbo,
  mapInvoiceToQbo,
  reconcile,
  type Link,
  type ReconcilePlan,
} from "./qboMapping";

/* -------------------------------------------------------------------------- */
/* Timestamps: OLD < watermark(T0) < NEW.                                      */
/* -------------------------------------------------------------------------- */
const OLD = "2026-05-01T00:00:00.000Z";
const T0 = "2026-06-01T00:00:00.000Z";
const NEW = "2026-06-15T00:00:00.000Z";

/* -------------------------------------------------------------------------- */
/* Fixture builders — QBO query-API shapes + local (already-adapted) shapes.  */
/* -------------------------------------------------------------------------- */

/** A QBO Customer as returned by `select * from Customer`. */
const qboCustomer = (Id: string, updated: string, extra: Record<string, any> = {}) => ({
  Id,
  DisplayName: extra.DisplayName ?? `Customer ${Id}`,
  MetaData: { LastUpdatedTime: updated },
  ...extra,
});

/** A QBO Invoice as returned by `select * from Invoice`. */
const qboInvoice = (Id: string, updated: string, customerRef: string, total: number) => ({
  Id,
  CustomerRef: { value: customerRef },
  Line: [
    {
      DetailType: "SalesItemLineDetail",
      Amount: total,
      Description: "Landscape maintenance",
      SalesItemLineDetail: { Qty: 1, UnitPrice: total },
    },
  ],
  TotalAmt: total,
  Balance: 0,
  MetaData: { LastUpdatedTime: updated },
});

/** A local customer already adapted into the qboMapping planner shape. */
const localCustomer = (id: string, updatedAt: string, extra: Record<string, any> = {}) => ({
  id,
  firstName: extra.firstName ?? "Pat",
  lastName: extra.lastName ?? "Green",
  email: extra.email,
  phone: extra.phone,
  companyName: extra.companyName,
  qboId: extra.qboId,
  updatedAt,
});

const custLink = (localId: string, qboId: string, updatedAt = T0): Link => ({
  localId,
  qboId,
  entity: "customer",
  updatedAt,
});

const ids = (recs: any[]) => recs.map((r) => String(r.id ?? r.Id ?? "")).sort();

/* -------------------------------------------------------------------------- */
/* 1. Push payloads — the exact JSON the server sends to QBO.                  */
/* -------------------------------------------------------------------------- */

describe("QBO write payloads (mapping fixtures)", () => {
  it("maps a company customer to a valid QBO Customer payload", () => {
    const payload = mapCustomerToQbo({
      id: "c1",
      companyName: "Cedar Ridge HOA",
      email: "board@cedarridge.org",
      phone: "601-555-0103",
    });
    expect(payload).toEqual({
      DisplayName: "Cedar Ridge HOA",
      PrimaryEmailAddr: { Address: "board@cedarridge.org" },
      PrimaryPhone: { FreeFormNumber: "601-555-0103" },
    });
  });

  it("maps a local invoice (with a resolved QBO customer ref) to a QBO Invoice payload", () => {
    const payload = mapInvoiceToQbo(
      { id: "inv1", items: [{ description: "Spring cleanup", quantity: 2, unitPrice: 140 }] },
      "q1",
    );
    expect(payload.CustomerRef.value).toBe("q1");
    expect(payload.TotalAmt).toBe(280);
    expect(payload.Line).toHaveLength(1);
    expect(payload.Line[0].Amount).toBe(280);
  });

  it("still emits a payload with an empty CustomerRef when no customer is synced yet — the server uses this to SKIP the push rather than crash", () => {
    const payload = mapInvoiceToQbo({ id: "inv2", amount: 99 }, null);
    expect(payload.CustomerRef.value).toBe("");
    // The server guard: `if (!custQboId) skip`. The mapper must not throw on the missing ref.
    expect(payload.TotalAmt).toBe(99);
  });

  it("never throws on junk customer input (defensive push path)", () => {
    expect(() => mapCustomerToQbo(null as any)).not.toThrow();
    expect(mapCustomerToQbo({} as any).DisplayName).toBe("Unnamed Customer");
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Full two-way pass over a realistic mixed batch.                          */
/* -------------------------------------------------------------------------- */

describe("two-way reconcile over a realistic mixed batch", () => {
  // c1↔q1 unchanged | c2↔q2 edited locally | c4↔q3 edited in QBO |
  // c5↔q5 edited on BOTH sides | c3 brand-new local | q9 brand-new in QBO.
  const locals = [
    localCustomer("c1", OLD, { qboId: "q1" }),
    localCustomer("c2", NEW, { qboId: "q2" }),
    localCustomer("c3", NEW),
    localCustomer("c4", OLD, { qboId: "q3" }),
    localCustomer("c5", NEW, { qboId: "q5" }),
  ];
  const qbos = [
    qboCustomer("q1", OLD),
    qboCustomer("q2", OLD),
    qboCustomer("q3", NEW),
    qboCustomer("q5", NEW),
    qboCustomer("q9", OLD),
  ];
  const links = [custLink("c1", "q1"), custLink("c2", "q2"), custLink("c4", "q3"), custLink("c5", "q5")];

  let plan: ReconcilePlan;
  it("partitions the batch deterministically", () => {
    plan = reconcile(locals, qbos, links, "customer");
    expect(ids(plan.toPush)).toEqual(["c2", "c3"]); // local-only edit + brand-new local
    expect(ids(plan.toPull)).toEqual(["q3", "q9"]); // QBO-only edit + brand-new QBO record
    expect(plan.conflicts).toEqual([{ localId: "c5", qboId: "q5" }]); // both edited since watermark
    expect(plan.alreadyLinked.map((l) => l.localId)).toEqual(["c1"]); // present + unchanged no-op
  });

  it("is a pure no-op once every watermark is caught up (idempotent settled state)", () => {
    // After a successful pass the server stamps each link's watermark to `now` (>= both sides).
    const settledLinks = [
      custLink("c1", "q1", NEW),
      custLink("c2", "q2", NEW),
      custLink("c3", "q3new", NEW),
      custLink("c4", "q3", NEW),
      custLink("c5", "q5", NEW),
    ];
    const settledQbo = [
      qboCustomer("q1", OLD),
      qboCustomer("q2", OLD),
      qboCustomer("q3", NEW),
      qboCustomer("q3new", NEW),
      qboCustomer("q5", NEW),
    ];
    const settledLocals = [
      localCustomer("c1", OLD, { qboId: "q1" }),
      localCustomer("c2", NEW, { qboId: "q2" }),
      localCustomer("c3", NEW, { qboId: "q3new" }),
      localCustomer("c4", OLD, { qboId: "q3" }),
      localCustomer("c5", NEW, { qboId: "q5" }),
    ];
    const settled = reconcile(settledLocals, settledQbo, settledLinks, "customer");
    expect(settled.toPush).toHaveLength(0);
    expect(settled.toPull).toHaveLength(0);
    expect(settled.conflicts).toHaveLength(0);
  });

  it("reconciles invoices with the same rules (QBO-edited invoice pulls back)", () => {
    const localInvoices = [
      { id: "inv1", amount: 280, qboId: "qi1", updatedAt: OLD },
      { id: "inv2", amount: 150, updatedAt: NEW }, // brand-new local -> push
    ];
    const qboInvoices = [qboInvoice("qi1", NEW, "q1", 300)]; // edited in QBO -> pull
    const invLinks: Link[] = [{ localId: "inv1", qboId: "qi1", entity: "invoice", updatedAt: T0 }];
    const invPlan = reconcile(localInvoices, qboInvoices, invLinks, "invoice");
    expect(ids(invPlan.toPush)).toEqual(["inv2"]);
    expect(ids(invPlan.toPull)).toEqual(["qi1"]);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Guard paths — every one must degrade cleanly (no throw, no destructive plan). */
/* -------------------------------------------------------------------------- */

// Mirrors the server engine's contract: only a COMPLETE QBO read is reconciled. A failed /
// rate-limited / truncated read yields this no-op plan so nothing is pushed or pulled.
const NOOP_PLAN: ReconcilePlan = { toPush: [], toPull: [], conflicts: [], alreadyLinked: [] };
const planTwoWay = (read: { ok: boolean; records: any[] }, locals: any[], links: Link[]): ReconcilePlan =>
  read.ok ? reconcile(locals, read.records, links, "customer") : NOOP_PLAN;

describe("guard paths degrade cleanly", () => {
  it("FIRST SYNC / not connected (no QBO records, no links) → pure one-way push, no spurious pulls", () => {
    const locals = [localCustomer("c1", NEW), localCustomer("c2", NEW)];
    const plan = reconcile(locals, [], [], "customer");
    expect(ids(plan.toPush)).toEqual(["c1", "c2"]);
    expect(plan.toPull).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("NOTHING TO DO (empty local + empty QBO) → empty plan", () => {
    const plan = reconcile([], [], [], "customer");
    expect(plan).toEqual(NOOP_PLAN);
  });

  it("MALFORMED QBO page (nulls / missing Id / missing MetaData) → no throw, only well-formed records classified", () => {
    const junk = [null, undefined, {}, { Id: "" }, qboCustomer("q9", OLD)];
    let plan!: ReconcilePlan;
    expect(() => {
      plan = reconcile([], junk as any, [], "customer");
    }).not.toThrow();
    expect(ids(plan.toPull)).toEqual(["q9"]); // the junk entries are ignored, q9 survives
  });

  it("RATE-LIMITED / truncated read is NEVER reconciled as authoritative — it degrades to a no-op", () => {
    const locals = [localCustomer("c1", OLD, { qboId: "q1" }), localCustomer("c2", OLD, { qboId: "q2" })];
    const links = [custLink("c1", "q1"), custLink("c2", "q2")];

    // What the server ACTUALLY does on a 429/partial read: skip reconcile entirely.
    const rateLimited = { ok: false, records: [] as any[] };
    const safePlan = planTwoWay(rateLimited, locals, links);
    expect(safePlan).toEqual(NOOP_PLAN); // clean degrade — nothing pushed or pulled

    // The HAZARD the guard prevents: naively reconciling the truncated (empty) set would
    // treat every linked-but-unseen record as missing and wrongly re-push them.
    const hazard = reconcile(locals, [], links, "customer");
    expect(ids(hazard.toPush)).toEqual(["c1", "c2"]); // <- exactly why the server must NOT do this
  });

  it("guards against null / non-array inputs without throwing", () => {
    expect(() => reconcile(null as any, null as any, null as any, "customer")).not.toThrow();
    const plan = reconcile(null as any, null as any, null as any, "customer");
    expect(plan).toEqual(NOOP_PLAN);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. QBO Payment → "mark invoice paid" linkage the server reads.             */
/* -------------------------------------------------------------------------- */

// The server marks a local invoice paid when a QBO Payment carries a LinkedTxn of type
// "Invoice" pointing at a QBO invoice we have linked. This fixture documents that shape and
// the extraction the server performs.
const paidInvoiceQboIds = (payments: any[]): string[] => {
  const out: string[] = [];
  for (const p of payments || []) {
    for (const ln of Array.isArray(p?.Line) ? p.Line : []) {
      for (const t of Array.isArray(ln?.LinkedTxn) ? ln.LinkedTxn : []) {
        if (t?.TxnType === "Invoice" && t?.TxnId != null) out.push(String(t.TxnId));
      }
    }
  }
  return out;
};

describe("QBO payments linkage", () => {
  it("extracts the QBO invoice ids a payment settles", () => {
    const payments = [
      {
        Id: "p1",
        TotalAmt: 280,
        Line: [{ Amount: 280, LinkedTxn: [{ TxnId: "qi1", TxnType: "Invoice" }] }],
      },
      { Id: "p2", TotalAmt: 0, Line: [] }, // unlinked / zero payment — safely ignored
    ];
    expect(paidInvoiceQboIds(payments)).toEqual(["qi1"]);
  });

  it("returns nothing (no throw) for malformed payment fixtures", () => {
    expect(paidInvoiceQboIds([null, {}, { Line: [null, { LinkedTxn: null }] }] as any)).toEqual([]);
  });
});
