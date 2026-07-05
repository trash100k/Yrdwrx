// Property-measurement provider adapters — the pluggable "how do we measure a lot"
// layer behind POST /api/measure/property (feat-aerial-takeoff).
//
// This file is the PURE core of measurement: an adapter interface, a small registry, one
// real provider adapter (Regrid parcel), and an honest no-provider fallback. Like
// `takeoff.ts` it is intentionally free of I/O (`fetch`/`Date.now`/`Math.random`), server
// helpers, and React/Firebase imports so it stays unit-testable and reproducible, and so
// `server.ts` can import it into its CJS bundle without dragging in browser/Supabase deps.
// It is NOT `@ts-nocheck`: it must stay type-clean.
//
// DESIGN — separation of concerns:
//   • This module BUILDS the outbound provider URL and PARSES the provider's JSON.
//   • `server.ts` owns the actual network call, so it can wrap it in `validateSafeUrl()`
//     (SSRF vet) + `fetchWithTimeout()` (bounded egress) exactly like every other
//     third-party call. Keeping the fetch out of here keeps this module pure + testable.
//
// HONESTY POLICY (critical): we never fabricate survey-grade precision.
//   • A configured provider returns a real measurement (`source: "provider"`).
//   • With NO provider key we return a clearly-labeled `source: "manual"` result with all
//     areas null — the operator enters/overrides areas by hand. We do NOT invent numbers.
//   • Where a real measurement gives the LOT but not the turf split, the lawn figure is a
//     documented ESTIMATE (confidence downgraded, note set), never presented as measured.

/** Confidence in a returned measurement. */
export type MeasureConfidence = "low" | "medium" | "high";

/**
 * Normalized measurement returned to the client. Every area is either a non-negative
 * whole number of square feet or `null` (unknown / not measured) — never NaN, never a
 * fabricated placeholder. `source` labels provenance so the UI can render it honestly.
 */
export interface MeasureResult {
  /** Maintainable turf area, sqft. */
  lawnSqft: number | null;
  /** Planting-bed area, sqft. */
  bedSqft: number | null;
  /** Hardscape (patio/walk/driveway) area, sqft. */
  hardscapeSqft: number | null;
  /** Whole-parcel/lot area, sqft. */
  lotSqft: number | null;
  /** Provenance: "provider" | "ai_estimate" | "manual". */
  source: string;
  confidence: MeasureConfidence;
  /** Adapter id when source === "provider" (e.g. "regrid"); null otherwise. */
  provider?: string | null;
  /** Human-readable honesty note (what's measured vs. estimated, next step). */
  note?: string;
}

/** Inputs an adapter needs to build a provider request. */
export interface AdapterRequest {
  /** Geocoded latitude (real, non-stub). */
  lat: number;
  /** Geocoded longitude (real, non-stub). */
  lng: number;
  /** Raw address string (for providers that accept an address query). */
  address: string;
  /** Resolved provider API key/token. */
  apiKey: string;
}

/**
 * A measurement provider. `server.ts` picks the first configured adapter, asks it for a
 * request URL, performs the SSRF-safe bounded fetch itself, then hands the raw JSON back
 * to `parse()`. Adding a provider (Google Solar building/lot, Nearmap, etc.) is just a new
 * object in {@link ADAPTERS}.
 */
export interface MeasureAdapter {
  /** Stable machine id, surfaced to the client as `provider`. */
  readonly id: string;
  /** Human label for logs/UI. */
  readonly label: string;
  /** Env var names to draw a key from, in priority order; first non-empty wins. */
  readonly keyEnvVars: readonly string[];
  /**
   * Build the outbound provider URL. Returns null when it can't (missing key or
   * non-finite coordinates) so the caller cleanly falls through to an honest estimate.
   */
  buildRequestUrl(req: AdapterRequest): string | null;
  /**
   * Normalize a raw provider JSON payload into a {@link MeasureResult}, or null when the
   * response has no usable measurement (caller then falls through — never a 500).
   */
  parse(raw: unknown): MeasureResult | null;
}

// ── Unit conversions & coverage assumptions (documented, not magic) ──────────────────────
/** Square feet per square meter (definitional, 1 m² = 10.7639 ft²). */
export const SQFT_PER_SQM = 10.7639;
/** Square feet per acre (definitional). */
export const SQFT_PER_ACRE = 43560;
/**
 * Fraction of a typical US residential LOT that is maintainable turf once the house
 * footprint, driveway and structures are removed (~60%). Used only to DERIVE a lawn
 * estimate from a measured lot when the provider gives no direct turf figure — the derived
 * lawn number is always flagged (confidence ≤ medium, note set), never sold as measured.
 */
export const RESIDENTIAL_LAWN_FRACTION_OF_LOT = 0.6;

/** Round to a whole square foot. */
export function roundSqft(n: number): number {
  return Math.round(n);
}

/**
 * Coerce an untrusted value to a non-negative whole sqft, or null. `null`/`undefined`/
 * `NaN`/`Infinity`/negative/zero all collapse to null so downstream never sees garbage.
 */
export function sanitizeSqft(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? roundSqft(n) : null;
}

/** First finite positive number among candidates, else null. */
function firstPositive(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

// ── Regrid parcel adapter — real provider (parcel/lot) ───────────────────────────────────
// Regrid's parcel-by-point API returns nationwide parcel geometry + standardized fields.
// We read the GIS-computed parcel AREA (the authoritative lot measurement) and, when the
// enhanced building-footprint field is present, subtract it for a better lawn estimate;
// otherwise we fall back to the documented lot-fraction. Docs: https://regrid.com/api
//
// Env: REGRID_API_KEY (preferred) or the generic MEASUREMENT_API_KEY.

/** Dig the first parcel's standardized `fields` object out of a Regrid response. */
function regridFields(raw: any): any | null {
  const fc = raw?.parcels ?? raw;
  const feats = fc?.features;
  if (Array.isArray(feats) && feats.length > 0) {
    const props = feats[0]?.properties;
    return props?.fields ?? props ?? null;
  }
  return null;
}

export const regridAdapter: MeasureAdapter = {
  id: "regrid",
  label: "Regrid parcel",
  keyEnvVars: ["REGRID_API_KEY", "MEASUREMENT_API_KEY"],

  buildRequestUrl(req) {
    if (!req.apiKey) return null;
    if (!Number.isFinite(req.lat) || !Number.isFinite(req.lng)) return null;
    const q = new URLSearchParams({
      lat: String(req.lat),
      lon: String(req.lng),
      token: req.apiKey,
    });
    return `https://app.regrid.com/api/v2/parcels/point?${q.toString()}`;
  },

  parse(raw) {
    const f = regridFields(raw);
    if (!f) return null;

    // Lot area: prefer an explicit sqft/sqm field, else convert GIS acreage.
    const sqft = firstPositive(f.ll_gissqft, f.gissqft, f.sqft);
    const sqm = firstPositive(f.ll_gissqm, f.gissqm);
    const acres = firstPositive(f.ll_gisacre, f.gisacre, f.acres, f.deeded_acres);
    let lotSqft: number | null = null;
    if (sqft != null) lotSqft = roundSqft(sqft);
    else if (sqm != null) lotSqft = roundSqft(sqm * SQFT_PER_SQM);
    else if (acres != null) lotSqft = roundSqft(acres * SQFT_PER_ACRE);
    if (lotSqft == null || lotSqft <= 0) return null; // no usable measurement → caller falls through

    // Optional building footprint (Regrid enhanced) tightens the lawn estimate.
    const buildingSqft = firstPositive(f.ll_bldg_footprint_sqft, f.bldg_sqft);

    let lawnSqft: number;
    let note: string;
    if (buildingSqft != null && buildingSqft < lotSqft) {
      // Lawn ≈ lot minus building footprint (still excludes driveway/beds → an estimate).
      lawnSqft = roundSqft(lotSqft - buildingSqft);
      note =
        "Lot area is measured from parcel records; lawn area is estimated as the lot minus the building footprint (excludes driveway and beds). Adjust as needed.";
    } else {
      lawnSqft = roundSqft(lotSqft * RESIDENTIAL_LAWN_FRACTION_OF_LOT);
      note =
        "Lot area is measured from parcel records; lawn area is estimated at ~60% of the lot (excludes structures and driveway). Adjust as needed.";
    }

    return {
      lawnSqft,
      bedSqft: null,
      hardscapeSqft: null,
      lotSqft,
      source: "provider",
      // Lot is measured, but the turf split is derived — cap confidence at medium.
      confidence: "medium",
      provider: "regrid",
      note,
    };
  },
};

/**
 * Adapter registry. Order = priority. Add new providers (e.g. a Google Solar building/lot
 * adapter keyed on GOOGLE_SOLAR_API_KEY, Nearmap, etc.) by appending an object here — no
 * server changes beyond wiring a key. `server.ts` calls {@link selectAdapter} to choose.
 */
export const ADAPTERS: readonly MeasureAdapter[] = [regridAdapter];

/** Resolve an adapter's API key from an env bag, or null if none of its vars are set. */
export function resolveApiKey(
  adapter: MeasureAdapter,
  env: Record<string, string | undefined>,
): string | null {
  for (const name of adapter.keyEnvVars) {
    const v = env[name];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** First adapter that has a configured key in `env`, or null (⇒ no real provider). */
export function selectAdapter(
  env: Record<string, string | undefined>,
): MeasureAdapter | null {
  for (const a of ADAPTERS) {
    if (resolveApiKey(a, env)) return a;
  }
  return null;
}

/**
 * Honest no-provider fallback: a clearly-labeled MANUAL result with every area null. The
 * operator enters areas by hand and {@link import("./takeoff")} turns them into quantities.
 * We never fabricate a measurement here.
 */
export function manualFallback(note?: string): MeasureResult {
  return {
    lawnSqft: null,
    bedSqft: null,
    hardscapeSqft: null,
    lotSqft: null,
    source: "manual",
    confidence: "low",
    provider: null,
    note:
      note ??
      "No measurement provider configured — enter the lawn and bed areas manually, or set a provider key (REGRID_API_KEY / MEASUREMENT_API_KEY) for automated parcel takeoff.",
  };
}
