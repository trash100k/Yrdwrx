/**
 * docExtract — pure, deterministic document-understanding core.
 *
 * Turns a loosely-parsed document (e.g. the JSON a vision/LLM extractor emits for a
 * scanned vendor invoice) into a normalized draft record the app can persist or show
 * for human review. This module is the hard-logic core that the `feat-doc-understanding`
 * feature imports.
 *
 * Design contract:
 *  - Pure functions only. No I/O, no network, no React, no server imports.
 *  - Deterministic: no Date.now / Math.random. All inputs are passed in.
 *  - Never throws on garbage input — every field is defensively coerced.
 *  - `amount` on a line item is treated as the *extended* line total (the money for that
 *    row). `quantity` is carried through as metadata and is NOT multiplied into the sum,
 *    so the total reconciliation compares `total` against `Σ amount`.
 */

/* ------------------------------------------------------------------ *
 * Public types
 * ------------------------------------------------------------------ */

export interface ParsedLineItem {
  description?: string;
  amount?: number;
  quantity?: number;
}

export interface ParsedVendorInvoice {
  vendor?: string;
  date?: string;
  lineItems?: ParsedLineItem[];
  total?: number;
}

export interface ExpenseDraftContext {
  jobId?: string;
  customerId?: string;
}

export interface ExpenseLine {
  description: string;
  amount: number;
  quantity: number;
}

export interface ExpenseDraft {
  vendor: string;
  date: string | null;
  items: ExpenseLine[];
  total: number;
  jobId?: string;
  customerId?: string;
  needsReview: boolean;
}

export interface ExtractionValidation {
  ok: boolean;
  errors: string[];
}

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/** Placeholder used when no vendor name could be extracted. */
export const UNKNOWN_VENDOR = 'Unknown Vendor';

/** Currency reconciliation tolerance, in whole currency units (i.e. one cent). */
export const AMOUNT_TOLERANCE = 0.01;

/* ------------------------------------------------------------------ *
 * Coercion / normalization helpers (all take `unknown`, never throw)
 * ------------------------------------------------------------------ */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Round to 2 decimal places, normalizing `-0` to `0`. */
function round2(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  return r === 0 ? 0 : r;
}

/** Coerce any value to a trimmed string; numbers stringify, everything else -> "". */
function coerceString(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/** True when the value carries a parseable numeric amount (finite number or numeric string). */
function hasNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') {
    if (!/[0-9]/.test(v)) return false;
    const n = Number(v.trim().replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n);
  }
  return false;
}

/**
 * Coerce a monetary value to a finite, 2-dp number. Handles currency symbols,
 * thousands separators, and accounting-style parentheses for negatives. Falls back
 * to 0 for anything unparseable (NaN, Infinity, null, objects, empty strings).
 */
function coerceAmount(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : 0;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return 0;
    const isParenNegative = /^\(.*\)$/.test(trimmed);
    const cleaned = trimmed.replace(/[^0-9.\-]/g, '');
    if (!/[0-9]/.test(cleaned)) return 0;
    let n = Number(cleaned);
    if (!Number.isFinite(n)) return 0;
    if (isParenNegative) n = -Math.abs(n);
    return round2(n);
  }
  return 0;
}

/**
 * Coerce a quantity to a positive finite number. Missing, non-positive, or
 * unparseable quantities default to 1 (one unit).
 */
function coerceQuantity(v: unknown): number {
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    if (!/[0-9]/.test(v)) return 1;
    n = Number(v.trim().replace(/[^0-9.\-]/g, ''));
  } else {
    return 1;
  }
  if (!Number.isFinite(n) || n <= 0) return 1;
  return round2(n);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function isValidYMD(y: number, mo: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return false;
  if (y < 1 || y > 9999) return false;
  if (mo < 1 || mo > 12) return false;
  if (d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[mo - 1];
}

/**
 * Normalize a date string to ISO `YYYY-MM-DD`, or `null` if it can't be understood.
 * Fully deterministic — parses digits by hand rather than going through `Date`, so
 * there are no timezone or locale effects. Supports:
 *   - ISO-ish `YYYY-MM-DD` / `YYYY/MM/DD` / `YYYY.MM.DD`
 *   - US `MM/DD/YYYY`, `M/D/YY` (2-digit year -> 20YY)
 * Invalid calendar dates (e.g. `2024-13-40`, `02/30/2024`) return `null`.
 */
function normalizeDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s === '') return null;

  let y: number;
  let mo: number;
  let d: number;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const us = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/.exec(s);
    if (!us) return null;
    mo = Number(us[1]);
    d = Number(us[2]);
    let yr = Number(us[3]);
    if (yr < 100) yr += 2000;
    y = yr;
  }

  if (!isValidYMD(y, mo, d)) return null;
  return `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
}

/* ------------------------------------------------------------------ *
 * Internal item extraction (shared by both public functions)
 * ------------------------------------------------------------------ */

function extractItems(source: Record<string, unknown>): ExpenseLine[] {
  const rawItems = Array.isArray(source.lineItems) ? source.lineItems : [];
  const items: ExpenseLine[] = [];
  for (const raw of rawItems) {
    if (!isObject(raw)) continue;
    const description = coerceString(raw.description);
    const amount = coerceAmount(raw.amount);
    const quantity = coerceQuantity(raw.quantity);
    // Drop wholly-empty rows (no description AND no money) — they're extractor noise.
    if (description === '' && amount === 0) continue;
    items.push({ description, amount, quantity });
  }
  return items;
}

function sumItems(items: ExpenseLine[]): number {
  return round2(items.reduce((acc, it) => acc + it.amount, 0));
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Convert a parsed vendor invoice into a normalized expense draft.
 *
 * - Coerces/normalizes every field; never throws on malformed input.
 * - When `total` is missing/unparseable, it is derived from the sum of line items.
 * - Sets `needsReview` when the draft is not confidently complete: a missing vendor,
 *   unparseable date, no line items, a missing total, or a total that doesn't
 *   reconcile with the line-item sum (beyond {@link AMOUNT_TOLERANCE}).
 */
export function vendorInvoiceToExpense(
  parsed: ParsedVendorInvoice | null | undefined,
  ctx?: ExpenseDraftContext,
): ExpenseDraft {
  const source: Record<string, unknown> = isObject(parsed) ? parsed : {};

  const rawVendor = coerceString(source.vendor);
  const vendorMissing = rawVendor === '';
  const vendor = vendorMissing ? UNKNOWN_VENDOR : rawVendor;

  const date = normalizeDate(source.date);
  const dateMissing = date === null;

  const items = extractItems(source);
  const hasItems = items.length > 0;
  const lineSum = sumItems(items);

  const totalProvided = hasNumericValue(source.total);
  const total = totalProvided ? coerceAmount(source.total) : lineSum;

  const mismatch =
    totalProvided && hasItems && Math.abs(total - lineSum) > AMOUNT_TOLERANCE;

  const needsReview =
    vendorMissing || dateMissing || !hasItems || !totalProvided || mismatch;

  const draft: ExpenseDraft = {
    vendor,
    date,
    items,
    total,
    needsReview,
  };

  if (ctx && typeof ctx.jobId === 'string' && ctx.jobId.trim() !== '') {
    draft.jobId = ctx.jobId.trim();
  }
  if (ctx && typeof ctx.customerId === 'string' && ctx.customerId.trim() !== '') {
    draft.customerId = ctx.customerId.trim();
  }

  return draft;
}

/**
 * Validate a parsed vendor invoice, collecting human-readable reasons it isn't
 * confidently usable. `ok` is true only when `errors` is empty. Never throws.
 */
export function validateExtraction(
  parsed: ParsedVendorInvoice | null | undefined,
): ExtractionValidation {
  const errors: string[] = [];

  if (!isObject(parsed)) {
    return { ok: false, errors: ['No document data to validate'] };
  }
  const source: Record<string, unknown> = parsed;

  if (coerceString(source.vendor) === '') {
    errors.push('Missing vendor name');
  }

  if (normalizeDate(source.date) === null) {
    errors.push('Missing or invalid date');
  }

  const rawItems = Array.isArray(source.lineItems) ? source.lineItems : [];
  if (rawItems.length === 0) {
    errors.push('No line items found');
  } else {
    rawItems.forEach((raw, i) => {
      const n = i + 1;
      if (!isObject(raw)) {
        errors.push(`Line item ${n} is malformed`);
        return;
      }
      if (coerceString(raw.description) === '') {
        errors.push(`Line item ${n} is missing a description`);
      }
      if (!hasNumericValue(raw.amount)) {
        errors.push(`Line item ${n} has an invalid amount`);
      }
    });
  }

  if (!hasNumericValue(source.total)) {
    errors.push('Missing invoice total');
  } else {
    const items = extractItems(source);
    if (items.length > 0) {
      const total = coerceAmount(source.total);
      const lineSum = sumItems(items);
      if (Math.abs(total - lineSum) > AMOUNT_TOLERANCE) {
        errors.push('Invoice total does not match sum of line items');
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
