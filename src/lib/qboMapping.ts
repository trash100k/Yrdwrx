// Two-way QuickBooks Online (QBO) entity mapping + reconciliation planner.
//
// This is the pure hard-logic core for the `feat-quickbooks-twoway` sync. It has NO I/O:
// no network calls, no Firebase/Supabase, no server.ts, no clock/randomness. Every result
// is a deterministic function of its inputs so the sync engine can wrap it with confidence
// and the money-/identity-sensitive edges stay unit-tested.
//
// Three responsibilities:
//   1. mapCustomerToQbo  — local Customer  -> minimal QBO Customer payload.
//   2. mapInvoiceToQbo   — local Invoice   -> minimal QBO Invoice payload (Line[] + CustomerRef).
//   3. reconcile         — three-way diff of local records, QBO records and a link table into
//                          an idempotent { toPush, toPull, conflicts, alreadyLinked } plan.

/* -------------------------------------------------------------------------- */
/* Local (YardWorx) input shapes — intentionally permissive/partial.          */
/* -------------------------------------------------------------------------- */

export interface LocalCustomer {
  id?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  /** Optional external pointer to a previously-synced QBO Customer Id. */
  qboId?: string;
  updatedAt?: string | number;
}

export interface LocalInvoiceItem {
  description?: string;
  name?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  /** Pre-computed line amount, used when quantity/unitPrice are absent. */
  amount?: number | string;
}

export interface LocalInvoice {
  id?: string;
  items?: LocalInvoiceItem[];
  /** Whole-invoice total, used as a lump-sum fallback when there are no line items. */
  amount?: number | string;
  qboId?: string;
  updatedAt?: string | number;
}

/* -------------------------------------------------------------------------- */
/* QBO output shapes — minimal subset the sync engine actually sends.         */
/* -------------------------------------------------------------------------- */

export interface QboEmailAddr {
  Address: string;
}

export interface QboPhone {
  FreeFormNumber: string;
}

export interface QboCustomer {
  DisplayName: string;
  PrimaryEmailAddr?: QboEmailAddr;
  PrimaryPhone?: QboPhone;
}

export interface QboRef {
  value: string;
  name?: string;
}

export interface QboSalesItemLineDetail {
  Qty?: number;
  UnitPrice?: number;
}

export interface QboLine {
  DetailType: "SalesItemLineDetail";
  Amount: number;
  Description?: string;
  SalesItemLineDetail: QboSalesItemLineDetail;
}

export interface QboInvoice {
  CustomerRef: QboRef;
  Line: QboLine[];
  TotalAmt: number;
}

/* -------------------------------------------------------------------------- */
/* Reconciliation types.                                                      */
/* -------------------------------------------------------------------------- */

export type QboEntity = "customer" | "invoice";

/** A persisted correspondence between a local record and its QBO twin. */
export interface Link {
  localId: string;
  qboId: string;
  entity: QboEntity;
  /**
   * Last-successful-sync watermark (ISO string or epoch ms). A record is considered
   * "changed since sync" when its own updatedAt is strictly newer than this value.
   */
  updatedAt?: string;
}

export interface ReconcileConflict {
  localId: string;
  qboId: string;
}

export interface ReconcilePlan {
  /** Local records that must be created/updated in QBO. */
  toPush: any[];
  /** QBO records that must be created/updated locally. */
  toPull: any[];
  /** Records edited on both sides since the last sync — need human/merge resolution. */
  conflicts: ReconcileConflict[];
  /** Links that are present, matched and unchanged (a no-op), plus any newly discovered links. */
  alreadyLinked: Link[];
}

/* -------------------------------------------------------------------------- */
/* Small pure helpers.                                                        */
/* -------------------------------------------------------------------------- */

/** Trimmed string for genuine string inputs; "" for anything else (null/number/object/undefined). */
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Stable string key for ids that may arrive as string | number. "" when absent. */
function keyOf(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Finite number from a number or numeric string; null for NaN/Infinity/empty/non-numeric. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Round to 2 decimals (cents), guarding NaN -> 0. */
function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Epoch ms from an ISO string or numeric timestamp; 0 for missing/invalid (NaN-safe). */
function toTime(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    const t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

/** ISO string for the later of two epoch-ms times; undefined when neither is set. Deterministic. */
function isoMax(a: number, b: number): string | undefined {
  const m = Math.max(a, b);
  if (!Number.isFinite(m) || m <= 0) return undefined;
  const d = new Date(m);
  const iso = d.toISOString();
  return iso;
}

/* -------------------------------------------------------------------------- */
/* Customer mapping.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * QBO requires a non-empty DisplayName. Derive the best available label, preferring an
 * explicit company name, then a person's full name, then email, then phone, and finally a
 * safe non-empty fallback so we never emit an invalid empty DisplayName.
 */
function displayNameFor(local: LocalCustomer): string {
  const company = str(local.companyName);
  if (company) return company;

  const full = [str(local.firstName), str(local.lastName)].filter(Boolean).join(" ");
  if (full) return full;

  const email = str(local.email);
  if (email) return email;

  const phone = str(local.phone);
  if (phone) return phone;

  return "Unnamed Customer";
}

/** Map a local Customer to a minimal QBO Customer payload. Pure; omits empty optional fields. */
export function mapCustomerToQbo(local: LocalCustomer | null | undefined): QboCustomer {
  const src: LocalCustomer = local ?? {};
  const out: QboCustomer = { DisplayName: displayNameFor(src) };

  const email = str(src.email);
  if (email) out.PrimaryEmailAddr = { Address: email };

  const phone = str(src.phone);
  if (phone) out.PrimaryPhone = { FreeFormNumber: phone };

  return out;
}

/* -------------------------------------------------------------------------- */
/* Invoice mapping.                                                           */
/* -------------------------------------------------------------------------- */

/** Build one QBO SalesItemLine from a local line item, guarding missing/NaN numbers. */
function lineFor(item: LocalInvoiceItem): QboLine {
  const qty = num(item.quantity);
  const unitPrice = num(item.unitPrice);

  let amount: number;
  if (qty !== null && unitPrice !== null) {
    amount = round2(qty * unitPrice);
  } else {
    amount = round2(num(item.amount) ?? 0);
  }

  const detail: QboSalesItemLineDetail = {};
  if (qty !== null) detail.Qty = qty;
  if (unitPrice !== null) detail.UnitPrice = unitPrice;

  const line: QboLine = {
    DetailType: "SalesItemLineDetail",
    Amount: amount,
    SalesItemLineDetail: detail,
  };

  const description = str(item.description) || str(item.name);
  if (description) line.Description = description;

  return line;
}

/**
 * Map a local Invoice to a minimal QBO Invoice payload.
 *
 * - `Line[]` is built from `local.items`. When there are no items but the invoice carries a
 *   non-zero total, a single lump-sum line is emitted so QBO still receives a chargeable amount.
 * - `TotalAmt` is the sum of the produced line amounts.
 * - `CustomerRef.value` is always a string (empty when no ref supplied).
 */
export function mapInvoiceToQbo(
  local: LocalInvoice | null | undefined,
  qboCustomerRef: string | number | null | undefined,
): QboInvoice {
  const src: LocalInvoice = local ?? {};
  const rawItems = Array.isArray(src.items) ? src.items : [];

  const lines: QboLine[] = rawItems
    .filter((i): i is LocalInvoiceItem => i != null)
    .map(lineFor);

  if (lines.length === 0) {
    const amt = num(src.amount);
    if (amt !== null && amt !== 0) {
      lines.push({
        DetailType: "SalesItemLineDetail",
        Amount: round2(amt),
        SalesItemLineDetail: {},
      });
    }
  }

  const total = round2(lines.reduce((sum, l) => sum + l.Amount, 0));

  return {
    CustomerRef: { value: keyOf(qboCustomerRef) },
    Line: lines,
    TotalAmt: total,
  };
}

/* -------------------------------------------------------------------------- */
/* Reconciliation.                                                            */
/* -------------------------------------------------------------------------- */

function localUpdatedAt(rec: any): unknown {
  return rec?.updatedAt;
}

function qboUpdatedAt(rec: any): unknown {
  // Real QBO records nest the modified time under MetaData.LastUpdatedTime; accept a flat
  // updatedAt as a convenience for locally-shaped fixtures.
  const meta = rec?.MetaData;
  if (meta && meta.LastUpdatedTime != null) return meta.LastUpdatedTime;
  return rec?.updatedAt;
}

function localIdKey(rec: any): string {
  return keyOf(rec?.id);
}

function qboIdKey(rec: any): string {
  const id = rec?.Id != null ? rec.Id : rec?.id;
  return keyOf(id);
}

/**
 * Three-way reconcile of local records, QBO records and the link table into an idempotent
 * sync plan. Idempotent by the link table (authoritative watermark) and, for records not yet
 * in the table, by an external-id pointer (`local.qboId` -> QBO `Id`).
 *
 * Classification (per matched pair, using `link.updatedAt` as the last-sync watermark):
 *   - both sides unchanged since the watermark        -> alreadyLinked (no-op)
 *   - only the local side changed                      -> toPush
 *   - only the QBO side changed                        -> toPull
 *   - both sides changed                               -> conflict
 *
 * Records only on one side:
 *   - linked local present / QBO missing               -> toPush (repair)
 *   - linked QBO present / local missing               -> toPull (repair)
 *   - unlinked local (no external match)               -> toPush (create in QBO)
 *   - unlinked QBO (no external match)                 -> toPull (import locally)
 *
 * External-id discovery (unlinked local whose `qboId` matches an unlinked QBO `Id`):
 *   - equal / absent timestamps                        -> alreadyLinked (a synthesized Link
 *                                                         the caller can persist; keeps reruns no-op)
 *   - both timestamped and differing                   -> conflict
 */
export function reconcile(
  local: any[],
  qbo: any[],
  links: Link[],
  entity: QboEntity,
): ReconcilePlan {
  const toPush: any[] = [];
  const toPull: any[] = [];
  const conflicts: ReconcileConflict[] = [];
  const alreadyLinked: Link[] = [];

  const locals = Array.isArray(local) ? local : [];
  const qbos = Array.isArray(qbo) ? qbo : [];
  const linkList = Array.isArray(links) ? links.filter((l) => l != null && l.entity === entity) : [];

  const localById = new Map<string, any>();
  for (const r of locals) {
    if (r == null) continue;
    const id = localIdKey(r);
    if (id && !localById.has(id)) localById.set(id, r);
  }

  const qboById = new Map<string, any>();
  for (const r of qbos) {
    if (r == null) continue;
    const id = qboIdKey(r);
    if (id && !qboById.has(id)) qboById.set(id, r);
  }

  const linkedLocalIds = new Set<string>();
  const linkedQboIds = new Set<string>();

  for (const link of linkList) {
    const lid = keyOf(link.localId);
    const qid = keyOf(link.qboId);
    if (lid) linkedLocalIds.add(lid);
    if (qid) linkedQboIds.add(qid);

    const L = lid ? localById.get(lid) : undefined;
    const Q = qid ? qboById.get(qid) : undefined;

    if (L !== undefined && Q !== undefined) {
      const base = toTime(link.updatedAt);
      const lt = toTime(localUpdatedAt(L));
      const qt = toTime(qboUpdatedAt(Q));
      const localChanged = lt > base;
      const qboChanged = qt > base;

      if (localChanged && qboChanged) {
        conflicts.push({ localId: lid, qboId: qid });
      } else if (localChanged) {
        toPush.push(L);
      } else if (qboChanged) {
        toPull.push(Q);
      } else {
        alreadyLinked.push(link);
      }
    } else if (L !== undefined && Q === undefined) {
      toPush.push(L);
    } else if (L === undefined && Q !== undefined) {
      toPull.push(Q);
    }
    // both missing -> orphan link, skip.
  }

  // Remaining (unlinked) QBO records, mutated as external-id matches consume them.
  const unlinkedQbos = new Map<string, any>();
  for (const [id, r] of qboById) {
    if (!linkedQboIds.has(id)) unlinkedQbos.set(id, r);
  }

  for (const [lid, L] of localById) {
    if (linkedLocalIds.has(lid)) continue;

    const ext = keyOf(L?.qboId);
    if (ext && unlinkedQbos.has(ext)) {
      const Q = unlinkedQbos.get(ext);
      unlinkedQbos.delete(ext);

      const lt = toTime(localUpdatedAt(L));
      const qt = toTime(qboUpdatedAt(Q));
      if (lt > 0 && qt > 0 && lt !== qt) {
        conflicts.push({ localId: lid, qboId: ext });
      } else {
        alreadyLinked.push({ localId: lid, qboId: ext, entity, updatedAt: isoMax(lt, qt) });
      }
    } else {
      toPush.push(L);
    }
  }

  for (const Q of unlinkedQbos.values()) {
    toPull.push(Q);
  }

  return { toPush, toPull, conflicts, alreadyLinked };
}
