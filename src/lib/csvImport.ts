// CSV import + dedupe/merge — the pure, typed core (no I/O, fully unit-tested).
//
// Switching cost from a competitor (Jobber/LMN) is the operator's own history, so a
// frictionless, NON-duplicating import is a direct sales lever. Two hard guarantees live
// here and are proven in csvImport.test.ts:
//   1. Re-importing the SAME file produces ZERO duplicates — every row that already exists
//      resolves to an UPDATE of the matched record, not a second INSERT.
//   2. Near-duplicates (ambiguous fuzzy matches) are surfaced for user confirmation ("review")
//      rather than silently merged or silently duplicated.
// Plus: every imported cell is run through a CSV/formula-injection neutralizer at ingest (the
// same FORMULA_LEAD pattern the CSV *export* path uses in src/lib/csv.ts), so an attacker-
// controlled "=cmd|..." cell can never flow into a downstream spreadsheet as a live formula.
//
// This module is deliberately I/O-free and framework-free so it is trivially testable and
// reusable for both `customers` and `inventory`. The Supabase/repo wiring lives in
// csvImportExec.ts; the UI in components/CsvImportModal.tsx.

// Mirrors the FORMULA_LEAD pattern in src/lib/csv.ts (the export side). A cell beginning with
// = + - @ (or tab/CR) is treated as a live formula by Excel/Sheets/LibreOffice (CWE-1236);
// prefixing a single quote makes the spreadsheet render it as literal text. Kept local so this
// pure module stays dependency-free while using the exact same neutralization.
const FORMULA_LEAD = /^[=+\-@\t\r]/;
function neutralizeFormulaLead(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return FORMULA_LEAD.test(s) ? "'" + s : s;
}

// --- Normalization ----------------------------------------------------------
// Canonical forms used for equality/dedupe. Kept intentionally conservative: they collapse
// cosmetic differences (case, whitespace, punctuation, US country code) WITHOUT guessing
// (no gmail-dot folding, no plus-tag stripping) so we never merge two genuinely distinct people.

export function normalizeEmail(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  // Only treat syntactically-plausible emails as a match key; junk ("n/a", "=HYPERLINK(..)") → "".
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : "";
}

export function normalizePhone(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "");
  // Drop a leading US country code so "+1 (555) 010-1234" and "555-010-1234" match.
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length >= 7 ? d : "";
}

// Lowercase, strip accents + punctuation, collapse whitespace. Shared by name/company/generic
// fuzzy text so similarity compares apples to apples.
export function normalizeName(v: unknown): string {
  return String(v ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPANY_SUFFIX = /\b(l\s?l\s?c|inc|incorporated|co|company|corp|corporation|ltd|limited|llp|pllc|the)\b/g;
export function normalizeCompany(v: unknown): string {
  return normalizeName(v).replace(COMPANY_SUFFIX, "").replace(/\s+/g, " ").trim();
}

// SKU/barcode: uppercase, keep only alphanumerics (drops dashes/spaces vendors add inconsistently).
export function normalizeSku(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// --- Injection-safe ingest --------------------------------------------------
// Neutralize CSV/formula injection (CWE-1236) at the point of ingest, so the stored value is
// safe wherever it later flows (CSV re-export, another spreadsheet, an email merge, etc.), not
// only on our own export path. Trim FIRST so a leading-whitespace bypass (" =SUM()") is caught.
export function sanitizeImportedCell(v: unknown): string {
  const s = String(v === null || v === undefined ? "" : v).trim();
  return neutralizeFormulaLead(s);
}

// --- String similarity (for fuzzy near-dup detection) -----------------------

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr: number[] = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** 0..1 similarity ratio on the two strings (1 = identical). Empty vs empty = 1. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

// --- Field definitions + header auto-mapping --------------------------------

export type FieldKind = "text" | "email" | "phone" | "number" | "tags" | "bool";

export interface FieldDef {
  field: string; // canonical target field name (camelCase, matches the repo row shape)
  label: string;
  aliases: string[]; // extra header spellings to auto-detect (matched loosely)
  kind: FieldKind;
}

export const CUSTOMER_FIELDS: FieldDef[] = [
  { field: "firstName", label: "First Name", kind: "text", aliases: ["first", "fname", "givenname", "firstname"] },
  { field: "lastName", label: "Last Name", kind: "text", aliases: ["last", "lname", "surname", "familyname", "lastname"] },
  { field: "companyName", label: "Company", kind: "text", aliases: ["company", "business", "organization", "org", "account"] },
  { field: "email", label: "Email", kind: "email", aliases: ["emailaddress", "e-mail", "mail"] },
  { field: "phone", label: "Phone", kind: "phone", aliases: ["phonenumber", "mobile", "cell", "tel", "telephone", "contact"] },
  { field: "address", label: "Address", kind: "text", aliases: ["street", "serviceaddress", "propertyaddress", "location", "addr"] },
  { field: "propertySize", label: "Property Size", kind: "text", aliases: ["lotsize", "sqft", "acreage", "size"] },
  { field: "status", label: "Status", kind: "text", aliases: ["stage", "type"] },
  { field: "segment", label: "Segment", kind: "text", aliases: ["category", "tier"] },
  { field: "tags", label: "Tags", kind: "tags", aliases: ["labels", "groups"] },
  { field: "notes", label: "Notes", kind: "text", aliases: ["note", "comments", "description", "memo"] },
];

export const INVENTORY_FIELDS: FieldDef[] = [
  { field: "name", label: "Item Name", kind: "text", aliases: ["item", "itemname", "product", "productname", "description", "title"] },
  { field: "sku", label: "SKU", kind: "text", aliases: ["skus", "itemcode", "code", "productcode"] },
  { field: "barcode", label: "Barcode", kind: "text", aliases: ["upc", "ean", "gtin"] },
  { field: "partNumber", label: "Part Number", kind: "text", aliases: ["part", "partno", "mpn", "modelnumber", "model"] },
  { field: "category", label: "Category", kind: "text", aliases: ["type", "group"] },
  { field: "vendor", label: "Vendor", kind: "text", aliases: ["supplier", "manufacturer", "source"] },
  { field: "brand", label: "Brand", kind: "text", aliases: ["make"] },
  { field: "location", label: "Location", kind: "text", aliases: ["bin", "shelf", "warehouse", "aisle"] },
  { field: "unit", label: "Unit", kind: "text", aliases: ["uom", "units", "measure"] },
  { field: "quantity", label: "Quantity", kind: "number", aliases: ["qty", "count", "onhand", "stock", "instock"] },
  { field: "minThreshold", label: "Min Threshold", kind: "number", aliases: ["min", "reorder", "reorderpoint", "minimum", "par"] },
  { field: "unitPrice", label: "Unit Price", kind: "number", aliases: ["price", "sellprice", "retail", "listprice"] },
  { field: "unitCost", label: "Unit Cost", kind: "number", aliases: ["cost", "buyprice", "wholesale"] },
];

const NO_FIELD = ""; // "ignore this column"

// Loose header key: strip everything but alphanumerics + lowercase, so "First Name", "first_name",
// "FIRST-NAME" all collapse to "firstname".
export function headerKey(h: string): string {
  return String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Best-effort auto-map arbitrary CSV headers -> canonical fields. Returns header -> field
 * (NO_FIELD for unmatched). Each field is claimed by at most one header (first exact-ish win),
 * so the user only has to fix the leftovers in the mapping UI.
 */
export function guessMapping(headers: string[], fields: FieldDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  const claimed = new Set<string>();

  // Precompute candidate keys per field (its own name + aliases), all loosely-keyed.
  const fieldKeys = fields.map((f) => ({
    field: f.field,
    keys: new Set([headerKey(f.field), headerKey(f.label), ...f.aliases.map(headerKey)]),
  }));

  for (const h of headers) {
    const hk = headerKey(h);
    let picked = NO_FIELD;
    // 1) exact loose-key match on field name/label/alias
    for (const fk of fieldKeys) {
      if (claimed.has(fk.field)) continue;
      if (fk.keys.has(hk)) {
        picked = fk.field;
        break;
      }
    }
    // 2) substring fallback ("customer email address" contains "email")
    if (picked === NO_FIELD && hk) {
      for (const fk of fieldKeys) {
        if (claimed.has(fk.field)) continue;
        if ([...fk.keys].some((k) => k.length >= 3 && (hk.includes(k) || k.includes(hk)))) {
          picked = fk.field;
          break;
        }
      }
    }
    if (picked !== NO_FIELD) claimed.add(picked);
    out[h] = picked;
  }
  return out;
}

// --- Row mapping (raw parsed CSV row -> canonical, sanitized field object) ---

function coerceValue(kind: FieldKind, raw: unknown): unknown {
  const cell = sanitizeImportedCell(raw);
  switch (kind) {
    case "email":
      return cell.toLowerCase();
    case "number": {
      const n = Number(String(cell).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) && cell !== "" ? n : undefined;
    }
    case "tags":
      return cell
        ? cell.split(/[|,;]/).map((t) => t.trim()).filter(Boolean)
        : undefined;
    case "bool":
      return /^(1|true|yes|y)$/i.test(cell);
    default:
      return cell || undefined;
  }
}

/**
 * Apply a header->field mapping to one raw parsed row, coercing + sanitizing each mapped cell.
 * Unmapped headers are dropped. Empty cells produce `undefined` (so an update never blanks an
 * existing value with an empty column). Returns a plain object keyed by canonical field.
 */
export function mapRow(
  raw: Record<string, unknown>,
  mapping: Record<string, string>,
  fields: FieldDef[],
): Record<string, unknown> {
  const byField = new Map(fields.map((f) => [f.field, f]));
  const out: Record<string, unknown> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    const def = byField.get(field);
    if (!def) continue;
    const val = coerceValue(def.kind, raw[header]);
    if (val === undefined) continue;
    out[field] = val;
  }
  return out;
}

// --- Dedupe: match config + import plan -------------------------------------

export type ImportAction = "create" | "update" | "review" | "skip";

export interface MatchCandidate {
  id: string;
  score: number; // 1 for exact, 0..1 for fuzzy
  reason: string;
}

export interface ImportDecision<T> {
  index: number; // position in the incoming array (stable across UI edits)
  row: T;
  action: ImportAction;
  matchId?: string; // existing row id to update / merge into (create=undefined)
  score?: number; // fuzzy score when action === "review"
  reason?: string;
  candidates?: MatchCandidate[]; // for "review": the ambiguous existing rows
}

export interface ImportPlan<T> {
  decisions: ImportDecision<T>[];
  counts: Record<ImportAction, number>;
}

export interface MatchConfig<T> {
  /** Canonical exact-match keys for a row (e.g. `email:bob@x.com`). Empty entries are ignored. */
  exactKeys: (row: T) => string[];
  /** Normalized text used for fuzzy near-dup comparison (e.g. the person's or item's name). */
  fuzzyText: (row: T) => string;
  /** Similarity at/above which a fuzzy candidate is surfaced for confirmation (0..1). */
  fuzzyThreshold: number;
  /** Human label for a row, used in "possible duplicate of X" messages. */
  displayName: (row: T) => string;
}

export const customerMatch: MatchConfig<Record<string, any>> = {
  exactKeys: (r) => {
    const keys: string[] = [];
    const email = normalizeEmail(r.email);
    if (email) keys.push("email:" + email);
    const phone = normalizePhone(r.phone);
    if (phone) keys.push("phone:" + phone);
    const name = normalizeName(`${r.firstName ?? ""} ${r.lastName ?? ""}`) || normalizeCompany(r.companyName);
    const addr = normalizeName(r.address);
    // Name + address is a strong key only when BOTH are present (name alone is too weak).
    if (name && addr) keys.push("na:" + name + "|" + addr);
    return keys;
  },
  fuzzyText: (r) =>
    normalizeName(`${r.firstName ?? ""} ${r.lastName ?? ""}`).trim() || normalizeCompany(r.companyName),
  fuzzyThreshold: 0.9,
  displayName: (r) =>
    `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.companyName || r.email || r.phone || "(unnamed)",
};

export const inventoryMatch: MatchConfig<Record<string, any>> = {
  exactKeys: (r) => {
    const keys: string[] = [];
    const sku = normalizeSku(r.sku);
    if (sku) keys.push("sku:" + sku);
    const barcode = normalizeSku(r.barcode);
    if (barcode) keys.push("barcode:" + barcode);
    const name = normalizeName(r.name);
    const vendor = normalizeName(r.vendor);
    if (name && vendor) keys.push("nv:" + name + "|" + vendor);
    return keys;
  },
  fuzzyText: (r) => normalizeName(r.name),
  fuzzyThreshold: 0.92,
  displayName: (r) => r.name || r.sku || "(unnamed item)",
};

/**
 * Classify each incoming row against the existing (already-persisted) rows AND against earlier
 * rows in this same batch:
 *   - `update` — exactly one existing row shares an exact key  → re-import updates in place
 *   - `review` — a fuzzy near-dup, OR an exact key that hits >1 existing row (ambiguous)
 *   - `skip`   — a within-file duplicate of an earlier row being created this batch
 *   - `create` — no match anywhere
 * This is what makes re-importing the same file a no-op on row count (all `update`).
 */
export function buildImportPlan<T extends Record<string, any>>(
  incoming: T[],
  existing: Array<T & { id: string }>,
  match: MatchConfig<T>,
): ImportPlan<T> {
  // Index existing rows by every exact key. A key hitting multiple ids means the DB already
  // holds duplicates for that key — we flag rather than guess which to update.
  const keyToIds = new Map<string, string[]>();
  for (const e of existing) {
    for (const k of match.exactKeys(e)) {
      const arr = keyToIds.get(k) ?? [];
      if (!arr.includes(e.id)) arr.push(e.id);
      keyToIds.set(k, arr);
    }
  }
  // Keys consumed by a `create` earlier in THIS batch — catches within-file duplicate rows.
  const batchKeys = new Set<string>();

  const decisions: ImportDecision<T>[] = incoming.map((row, index) => {
    const keys = match.exactKeys(row).filter(Boolean);

    // 1) Exact match against existing.
    const matchedIds = Array.from(new Set(keys.flatMap((k) => keyToIds.get(k) ?? [])));
    if (matchedIds.length === 1) {
      return { index, row, action: "update", matchId: matchedIds[0], reason: "Matches an existing record" };
    }
    if (matchedIds.length > 1) {
      return {
        index,
        row,
        action: "review",
        reason: "Matches multiple existing records — pick one",
        candidates: matchedIds.map((id) => ({ id, score: 1, reason: "exact key match" })),
      };
    }

    // 2) Within-file duplicate of a row we're already creating this batch.
    if (keys.some((k) => batchKeys.has(k))) {
      return { index, row, action: "skip", reason: "Duplicate of another row in this file" };
    }

    // 3) Fuzzy near-dup against existing.
    const ft = match.fuzzyText(row);
    if (ft) {
      let best: { id: string; score: number } | null = null;
      for (const e of existing) {
        const score = similarity(ft, match.fuzzyText(e));
        if (score >= match.fuzzyThreshold && (!best || score > best.score)) best = { id: e.id, score };
      }
      if (best) {
        const target = existing.find((e) => e.id === best!.id)!;
        return {
          index,
          row,
          action: "review",
          matchId: best.id,
          score: best.score,
          reason: `Possible duplicate of "${match.displayName(target)}"`,
          candidates: [{ id: best.id, score: best.score, reason: "similar name" }],
        };
      }
    }

    // 4) Genuinely new — reserve its keys so a later identical row in this file becomes a skip.
    for (const k of keys) batchKeys.add(k);
    return { index, row, action: "create", reason: "New record" };
  });

  const counts: Record<ImportAction, number> = { create: 0, update: 0, review: 0, skip: 0 };
  for (const d of decisions) counts[d.action]++;
  return { decisions, counts };
}

// --- Merge two duplicate customers ------------------------------------------
// Reassign the loser's child records to the survivor, fold in any fields the survivor is
// missing, then archive the loser. This is the exact set of tables with a customer_id FK to
// customers(id) (per supabase/migrations); the executor updates customer_id on each (RLS-scoped).
// `customer_messages`/`messages` are the conversation threads. (material_logs is intentionally
// absent — it links by item_id/job_id, not customer_id.)
export const CUSTOMER_CHILD_TABLES = [
  "jobs",
  "invoices",
  "tasks",
  "documents",
  "reviews",
  "contracts",
  "customer_design_visions",
  "customer_messages",
  "messages",
] as const;

export interface MergePlan {
  survivorId: string;
  loserId: string;
  /** Patch to apply to the survivor — only fields the survivor is MISSING (survivor wins conflicts). */
  patch: Record<string, unknown>;
  reassignChildTables: readonly string[];
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/**
 * Compute a non-destructive merge: the survivor keeps all its own values and only gains the
 * loser's data where the survivor is blank. Tags are unioned; notes are concatenated; the
 * freeform `data`/`customFields` jsonb are shallow-merged (survivor wins). Returns just the
 * patch (fields that would actually change) so the caller can no-op an empty merge.
 */
export function buildCustomerMergePlan(
  survivor: Record<string, any> & { id: string },
  loser: Record<string, any> & { id: string },
): MergePlan {
  const patch: Record<string, unknown> = {};

  const scalarFields = [
    "firstName", "lastName", "companyName", "email", "phone", "address",
    "propertySize", "status", "segment", "notes", "gateCode", "stripeCustomerId",
  ];
  for (const f of scalarFields) {
    if (isEmpty(survivor[f]) && !isEmpty(loser[f])) patch[f] = loser[f];
  }

  // Tags: union (order-stable), only patch if it grows.
  const sTags = Array.isArray(survivor.tags) ? survivor.tags : [];
  const lTags = Array.isArray(loser.tags) ? loser.tags : [];
  const union = Array.from(new Set([...sTags, ...lTags]));
  if (union.length > sTags.length) patch.tags = union;

  // Notes: keep the survivor's, append the loser's if it adds anything new.
  if (!isEmpty(loser.notes) && loser.notes !== survivor.notes) {
    patch.notes = isEmpty(survivor.notes)
      ? loser.notes
      : `${survivor.notes}\n\n[merged] ${loser.notes}`;
  }

  // Freeform jsonb: survivor wins on key conflicts, loser fills gaps.
  for (const jsonb of ["data", "customFields"]) {
    const s = (survivor[jsonb] && typeof survivor[jsonb] === "object") ? survivor[jsonb] : {};
    const l = (loser[jsonb] && typeof loser[jsonb] === "object") ? loser[jsonb] : {};
    const merged = { ...l, ...s };
    if (Object.keys(l).some((k) => !(k in s))) patch[jsonb] = merged;
  }

  return {
    survivorId: survivor.id,
    loserId: loser.id,
    patch,
    reassignChildTables: CUSTOMER_CHILD_TABLES,
  };
}

/**
 * Find duplicate GROUPS among a set of existing records (for the "merge duplicates" UI).
 * Rows sharing an exact key are grouped as high-confidence; fuzzy near-dups are grouped as
 * "review". Groups have >= 2 members. Used to surface merge candidates without a DB scan.
 */
export interface DuplicateGroup<T> {
  confidence: "exact" | "near";
  reason: string;
  members: Array<T & { id: string }>;
}

export function findDuplicateGroups<T extends Record<string, any>>(
  rows: Array<T & { id: string }>,
  match: MatchConfig<T>,
): Array<DuplicateGroup<T>> {
  const groups: Array<DuplicateGroup<T>> = [];
  const grouped = new Set<string>();

  // Exact-key groups first.
  const keyToRows = new Map<string, Array<T & { id: string }>>();
  for (const r of rows) {
    for (const k of match.exactKeys(r)) {
      const arr = keyToRows.get(k) ?? [];
      arr.push(r);
      keyToRows.set(k, arr);
    }
  }
  for (const [key, members] of keyToRows) {
    const unique = dedupeById(members);
    if (unique.length < 2) continue;
    if (unique.every((m) => grouped.has(m.id))) continue;
    unique.forEach((m) => grouped.add(m.id));
    groups.push({ confidence: "exact", reason: `Shared ${key.split(":")[0]}`, members: unique });
  }

  // Fuzzy near-dup pairs among not-yet-grouped rows.
  const remaining = rows.filter((r) => !grouped.has(r.id));
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const a = remaining[i];
      const b = remaining[j];
      if (grouped.has(a.id) || grouped.has(b.id)) continue;
      const at = match.fuzzyText(a);
      const bt = match.fuzzyText(b);
      if (!at || !bt) continue;
      const score = similarity(at, bt);
      if (score >= match.fuzzyThreshold) {
        grouped.add(a.id);
        grouped.add(b.id);
        groups.push({
          confidence: "near",
          reason: `Similar name (${Math.round(score * 100)}% match)`,
          members: [a, b],
        });
      }
    }
  }

  return groups;
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
