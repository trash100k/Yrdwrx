// @ts-nocheck
/**
 * plantIntelligence.ts
 *
 * Pure, dependency-free horticultural grounding layer for the Design Studio.
 *
 * GOALS
 *  - Place the RIGHT plant for a site (zone fit, sun, deer pressure, native preference,
 *    non-invasive, fits the bed).
 *  - Price a design DETERMINISTICALLY so the same inputs always yield the same estimate.
 *
 * IMPORTANT CONSTRAINTS
 *  - NO imports. NO Node-only APIs. NO browser-only APIs. This module is imported by BOTH
 *    the React frontend (DesignStudio) AND the Express server.ts bundle, so it must be
 *    environment-agnostic.
 *  - All geography (state->zone, zip->zone) is APPROXIMATE and intended only as a DEFAULT
 *    the contractor confirms. We are honest about approximation (see `approx` flags and the
 *    documented, deliberately-small zip sample).
 *
 * USDA hardiness zones run 1..13. Rutgers deer-resistance ratings run A (rarely damaged)
 * .. D (frequently damaged): https://njaes.rutgers.edu/deer-resistant-plants/
 */

export type Sun = "full_sun" | "part_sun" | "part_shade" | "full_shade";
export type DeerRating = "A" | "B" | "C" | "D"; // Rutgers: A=rarely damaged … D=frequently
export type PlantKind = "plant" | "hardscape" | "mulch" | "edging" | "structure";

export interface PlantCatalogItem {
  id: string;
  name: string;
  botanicalName?: string;
  kind?: PlantKind;
  zoneMin?: number;
  zoneMax?: number; // USDA 1..13
  sun?: Sun[];
  matureHeightFt?: number;
  matureSpreadFt?: number;
  spacingFt?: number;
  native?: boolean;
  invasive?: boolean;
  deerRating?: DeerRating;
  unit?: "each" | "sqft" | "cuyd" | "linft";
  unitPrice?: number;
  installLaborMinutes?: number;
}

export interface SiteContext {
  zone?: number | null;
  sun?: Sun;
  deerPressure?: boolean;
  bedAreaSqft?: number;
  budgetBand?: "low" | "mid" | "high";
  nativeOnly?: boolean;
}

// --------------------------------------------------------------------------------------
// Geography helpers (APPROXIMATE — defaults the contractor confirms)
// --------------------------------------------------------------------------------------

/**
 * Approximate USDA hardiness zone ranges by US state (+ DC).
 *
 * States span MULTIPLE zones (e.g. California ranges roughly 5..11), so these are coarse
 * approximations meant only as a sensible default. `zone` is a representative mid value.
 * Keyed by 2-letter postal code; full names are resolved via STATE_NAME_TO_ABBR below.
 */
const STATE_ZONE_RANGES: Record<string, { zoneMin: number; zoneMax: number }> = {
  AL: { zoneMin: 7, zoneMax: 9 },
  AK: { zoneMin: 1, zoneMax: 8 },
  AZ: { zoneMin: 4, zoneMax: 10 },
  AR: { zoneMin: 6, zoneMax: 8 },
  CA: { zoneMin: 5, zoneMax: 11 },
  CO: { zoneMin: 3, zoneMax: 7 },
  CT: { zoneMin: 5, zoneMax: 7 },
  DE: { zoneMin: 7, zoneMax: 7 },
  DC: { zoneMin: 7, zoneMax: 8 },
  FL: { zoneMin: 8, zoneMax: 11 },
  GA: { zoneMin: 6, zoneMax: 9 },
  HI: { zoneMin: 10, zoneMax: 13 },
  ID: { zoneMin: 3, zoneMax: 7 },
  IL: { zoneMin: 5, zoneMax: 7 },
  IN: { zoneMin: 5, zoneMax: 7 },
  IA: { zoneMin: 4, zoneMax: 6 },
  KS: { zoneMin: 5, zoneMax: 7 },
  KY: { zoneMin: 6, zoneMax: 7 },
  LA: { zoneMin: 8, zoneMax: 10 },
  ME: { zoneMin: 3, zoneMax: 6 },
  MD: { zoneMin: 5, zoneMax: 8 },
  MA: { zoneMin: 5, zoneMax: 7 },
  MI: { zoneMin: 4, zoneMax: 6 },
  MN: { zoneMin: 3, zoneMax: 4 },
  MS: { zoneMin: 7, zoneMax: 9 },
  MO: { zoneMin: 5, zoneMax: 7 },
  MT: { zoneMin: 3, zoneMax: 6 },
  NE: { zoneMin: 4, zoneMax: 6 },
  NV: { zoneMin: 4, zoneMax: 10 },
  NH: { zoneMin: 3, zoneMax: 6 },
  NJ: { zoneMin: 6, zoneMax: 7 },
  NM: { zoneMin: 4, zoneMax: 9 },
  NY: { zoneMin: 3, zoneMax: 7 },
  NC: { zoneMin: 5, zoneMax: 8 },
  ND: { zoneMin: 2, zoneMax: 4 },
  OH: { zoneMin: 5, zoneMax: 6 },
  OK: { zoneMin: 6, zoneMax: 8 },
  OR: { zoneMin: 4, zoneMax: 9 },
  PA: { zoneMin: 5, zoneMax: 7 },
  RI: { zoneMin: 5, zoneMax: 7 },
  SC: { zoneMin: 7, zoneMax: 9 },
  SD: { zoneMin: 3, zoneMax: 5 },
  TN: { zoneMin: 5, zoneMax: 8 },
  TX: { zoneMin: 6, zoneMax: 10 },
  UT: { zoneMin: 4, zoneMax: 9 },
  VT: { zoneMin: 3, zoneMax: 5 },
  VA: { zoneMin: 5, zoneMax: 8 },
  WA: { zoneMin: 4, zoneMax: 9 },
  WV: { zoneMin: 5, zoneMax: 7 },
  WI: { zoneMin: 3, zoneMax: 5 },
  WY: { zoneMin: 2, zoneMax: 6 },
};

const STATE_NAME_TO_ABBR: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  "DISTRICT OF COLUMBIA": "DC",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
};

/**
 * Approximate USDA zone range for a US state (2-letter postal code OR full name).
 * Returns null for unknown / junk input.
 *
 * The result is APPROXIMATE — states span multiple zones — and is intended only as a
 * default the contractor confirms.
 */
export function zoneFromState(
  state: string,
): { zoneMin: number; zoneMax: number; zone: number } | null {
  if (typeof state !== "string") return null;
  const trimmed = state.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();

  // Resolve a full name to its abbreviation if needed.
  let abbr: string | undefined;
  if (upper.length === 2 && STATE_ZONE_RANGES[upper]) {
    abbr = upper;
  } else if (STATE_NAME_TO_ABBR[upper]) {
    abbr = STATE_NAME_TO_ABBR[upper];
  }

  if (!abbr) return null;
  const range = STATE_ZONE_RANGES[abbr];
  if (!range) return null;

  // Representative mid zone (rounded toward the lower end for a conservative default).
  const zone = Math.round((range.zoneMin + range.zoneMax) / 2);
  return { zoneMin: range.zoneMin, zoneMax: range.zoneMax, zone };
}

/**
 * Coarse, DOCUMENTED ZIP3-prefix -> zone sample.
 *
 * This is a deliberately SMALL, honest sample of common US regions keyed by the first three
 * digits of the ZIP code. It is NOT a complete table — most ZIPs will (correctly) return
 * null from zoneFromZip below. Each entry is a representative mid zone for that ZIP3 region.
 *
 * Sources: USDA Plant Hardiness Zone Map (2023) regional values, rounded to whole zones.
 */
const ZIP3_ZONE_SAMPLE: Record<string, number> = {
  // Northeast / Mid-Atlantic
  "021": 6, // Boston, MA
  "100": 7, // New York, NY
  "190": 7, // Philadelphia, PA
  "207": 7, // Suburban Maryland / DC metro
  // Southeast
  "300": 8, // Atlanta, GA
  "331": 10, // Miami, FL
  "337": 10, // Tampa, FL
  // Midwest
  "481": 6, // Detroit, MI
  "554": 4, // Minneapolis, MN
  "606": 6, // Chicago, IL
  // South Central
  "752": 8, // Dallas, TX
  "770": 9, // Houston, TX
  // Mountain / Southwest
  "802": 5, // Denver, CO
  "850": 9, // Phoenix, AZ
  // West Coast
  "900": 10, // Los Angeles, CA
  "941": 10, // San Francisco, CA
  "980": 8, // Seattle, WA
};

/**
 * Best-effort coarse ZIP -> USDA zone via the small documented ZIP3 sample above.
 * Returns null when the ZIP3 prefix is not in the sample (the common case) or input is junk.
 *
 * We do NOT fabricate a full nationwide table — null is the honest answer for most ZIPs.
 */
export function zoneFromZip(zip: string): number | null {
  if (typeof zip !== "string") return null;
  const digits = zip.trim().replace(/[^0-9]/g, "");
  if (digits.length < 3) return null;
  const prefix = digits.slice(0, 3);
  const zone = ZIP3_ZONE_SAMPLE[prefix];
  return typeof zone === "number" ? zone : null;
}

/**
 * Resolve a working zone, preferring explicit > zip > state.
 *
 * - `explicit` is treated as authoritative and NOT approximate.
 * - `zip` and `state` are approximate defaults.
 * - Returns { zone: null, source: "unknown", approx: false } when nothing resolves.
 */
export function resolveZone(opts: {
  explicit?: number | null;
  zip?: string;
  state?: string;
}): { zone: number | null; source: "explicit" | "zip" | "state" | "unknown"; approx: boolean } {
  const { explicit, zip, state } = opts || {};

  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return { zone: explicit, source: "explicit", approx: false };
  }

  if (typeof zip === "string" && zip.trim()) {
    const z = zoneFromZip(zip);
    if (z != null) return { zone: z, source: "zip", approx: true };
  }

  if (typeof state === "string" && state.trim()) {
    const s = zoneFromState(state);
    if (s) return { zone: s.zone, source: "state", approx: true };
  }

  return { zone: null, source: "unknown", approx: false };
}

// --------------------------------------------------------------------------------------
// Plant selection (hard filters -> soft scoring)
// --------------------------------------------------------------------------------------

/**
 * Sun compatibility. A plant tolerates a site if its accepted-sun list includes the site's
 * sun condition. Plants with no declared sun list are treated as flexible (tolerate any).
 */
function sunCompatible(itemSun: Sun[] | undefined, siteSun: Sun | undefined): boolean {
  if (!siteSun) return true; // no site sun given -> don't filter on it
  if (!itemSun || itemSun.length === 0) return true; // undeclared -> flexible
  return itemSun.includes(siteSun);
}

/**
 * Select plants for a site.
 *
 * HARD filters (a failure = rejected, with a human reason):
 *   1. Only `kind: "plant"` (or undefined kind, treated as plant) is zone/sun/deer filtered;
 *      non-plant items (hardscape/mulch/edging/structure) are always kept.
 *   2. Zone fit: site.zone within [zoneMin, zoneMax]. Skipped entirely when site.zone is null.
 *   3. Sun compatibility with site.sun.
 *   4. Not invasive.
 *   5. Deer rating A or B when site.deerPressure is true.
 *   6. Fits the bed: matureSpreadFt must be <= bed's shorter dimension (sqrt of area) when
 *      bedAreaSqft is provided.
 *   7. nativeOnly: drop non-native plants when site.nativeOnly is true.
 *
 * SOFT scoring (higher = better), used to sort picks best-first:
 *   + native
 *   + deer-resistant (A best, then B)
 *   + low-maintenance proxy (lower installLaborMinutes = easier)
 *   + budget alignment proxy (unitPrice vs budgetBand)
 *   + a small "fills bloom gap" placeholder (not modeled — neutral, documented)
 */
export function selectPlants(
  catalog: PlantCatalogItem[],
  site: SiteContext,
): {
  picks: PlantCatalogItem[];
  rejected: Array<{ id: string; name: string; reason: string }>;
  zoneApplied: boolean;
} {
  const list = Array.isArray(catalog) ? catalog : [];
  const s = site || {};
  const zoneApplied = s.zone != null && Number.isFinite(s.zone);

  const rejected: Array<{ id: string; name: string; reason: string }> = [];
  const scored: Array<{ item: PlantCatalogItem; score: number }> = [];

  // Bed's shorter dimension if it were square; used as a coarse "does it fit" check.
  const bedSide =
    typeof s.bedAreaSqft === "number" && s.bedAreaSqft > 0 ? Math.sqrt(s.bedAreaSqft) : null;

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const isPlant = !item.kind || item.kind === "plant";

    // Non-plant materials skip horticultural filters entirely.
    if (!isPlant) {
      scored.push({ item, score: 0 });
      continue;
    }

    // 7. nativeOnly
    if (s.nativeOnly && item.native !== true) {
      rejected.push({ id: item.id, name: item.name, reason: "Not native (native-only site)" });
      continue;
    }

    // 4. invasive
    if (item.invasive === true) {
      rejected.push({ id: item.id, name: item.name, reason: "Invasive species — excluded" });
      continue;
    }

    // 2. zone fit (skipped when site.zone is null)
    if (zoneApplied) {
      const min = typeof item.zoneMin === "number" ? item.zoneMin : -Infinity;
      const max = typeof item.zoneMax === "number" ? item.zoneMax : Infinity;
      if (s.zone < min || s.zone > max) {
        rejected.push({
          id: item.id,
          name: item.name,
          reason: `Out of hardiness zone (needs ${min}-${max}, site is zone ${s.zone})`,
        });
        continue;
      }
    }

    // 3. sun compatibility
    if (!sunCompatible(item.sun, s.sun)) {
      rejected.push({
        id: item.id,
        name: item.name,
        reason: `Sun mismatch (needs ${(item.sun || []).join("/") || "any"}, site is ${s.sun})`,
      });
      continue;
    }

    // 5. deer pressure -> require A/B
    if (s.deerPressure) {
      const r = item.deerRating;
      if (r === "C" || r === "D") {
        rejected.push({
          id: item.id,
          name: item.name,
          reason: `Deer pressure: rating ${r} is too palatable (need A or B)`,
        });
        continue;
      }
    }

    // 6. fits the bed
    if (bedSide != null && typeof item.matureSpreadFt === "number" && item.matureSpreadFt > 0) {
      if (item.matureSpreadFt > bedSide) {
        rejected.push({
          id: item.id,
          name: item.name,
          reason: `Too large for bed (spread ${item.matureSpreadFt}ft > ~${bedSide.toFixed(1)}ft available)`,
        });
        continue;
      }
    }

    // ---- passed hard filters: soft score ----
    let score = 0;
    if (item.native === true) score += 3;
    if (item.deerRating === "A") score += 2;
    else if (item.deerRating === "B") score += 1;

    // Low-maintenance proxy: less install labor scores slightly higher.
    if (typeof item.installLaborMinutes === "number") {
      score += Math.max(0, 1 - item.installLaborMinutes / 120);
    }

    // Budget alignment proxy (mild nudge, not a hard filter).
    if (s.budgetBand && typeof item.unitPrice === "number") {
      if (s.budgetBand === "low" && item.unitPrice <= 25) score += 0.5;
      else if (s.budgetBand === "mid" && item.unitPrice > 25 && item.unitPrice <= 75) score += 0.5;
      else if (s.budgetBand === "high" && item.unitPrice > 75) score += 0.5;
    }

    // "Fills bloom gap" is not modeled here (no phenology data). Neutral contribution,
    // documented so callers know it is intentionally a no-op placeholder for now.
    score += 0;

    scored.push({ item, score });
  }

  // Stable sort best-first; preserve catalog order on ties for determinism.
  const indexed = scored.map((entry, i) => ({ ...entry, i }));
  indexed.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  const picks = indexed.map((e) => e.item);

  return { picks, rejected, zoneApplied };
}

// --------------------------------------------------------------------------------------
// Quantity & pricing (deterministic)
// --------------------------------------------------------------------------------------

/**
 * Square-ish packing. A plant occupies roughly spacingFt x spacingFt of bed.
 *   max         = floor(bedArea / spacingFt^2)
 *   recommended = round(max * 0.78)  (~75-80% density for instant impact without crowding)
 *
 * Guards: spacingFt <= 0 or bedArea <= 0 (or non-finite) -> { max: 0, recommended: 0 }.
 */
export function noCrowdQuantity(
  bedAreaSqft: number,
  spacingFt: number,
): { max: number; recommended: number } {
  if (
    typeof bedAreaSqft !== "number" ||
    typeof spacingFt !== "number" ||
    !Number.isFinite(bedAreaSqft) ||
    !Number.isFinite(spacingFt) ||
    bedAreaSqft <= 0 ||
    spacingFt <= 0
  ) {
    return { max: 0, recommended: 0 };
  }
  const max = Math.floor(bedAreaSqft / (spacingFt * spacingFt));
  const recommended = Math.round(max * 0.78);
  return { max, recommended };
}

/** Round to cents deterministically (avoids float drift in line totals). */
function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Deterministic estimate.
 *
 * For each row:
 *   materialCost = qty * unitPrice
 *   laborCost    = (qty * installLaborMinutes / 60) * laborRate   ($/hour)
 *   lineTotal    = materialCost + laborCost
 * All values rounded to cents. Totals are sums of the rounded line values so the printed
 * estimate always reconciles to the penny.
 */
export function estimateLineItems(
  rows: Array<{ item: PlantCatalogItem; qty: number }>,
  laborRate: number,
): {
  lineItems: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    materialCost: number;
    laborCost: number;
    lineTotal: number;
  }>;
  materialCost: number;
  laborCost: number;
  total: number;
} {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rate = typeof laborRate === "number" && Number.isFinite(laborRate) && laborRate > 0 ? laborRate : 0;

  const lineItems: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    materialCost: number;
    laborCost: number;
    lineTotal: number;
  }> = [];

  let materialTotal = 0;
  let laborTotal = 0;

  for (const row of safeRows) {
    if (!row || !row.item) continue;
    const item = row.item;
    const qty = typeof row.qty === "number" && Number.isFinite(row.qty) && row.qty > 0 ? row.qty : 0;
    const unitPrice =
      typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
    const minutes =
      typeof item.installLaborMinutes === "number" && Number.isFinite(item.installLaborMinutes)
        ? item.installLaborMinutes
        : 0;

    const materialCost = roundCents(qty * unitPrice);
    const laborCost = roundCents((qty * minutes / 60) * rate);
    const lineTotal = roundCents(materialCost + laborCost);

    lineItems.push({
      name: item.name,
      qty,
      unitPrice: roundCents(unitPrice),
      materialCost,
      laborCost,
      lineTotal,
    });

    materialTotal += materialCost;
    laborTotal += laborCost;
  }

  const materialCost = roundCents(materialTotal);
  const laborCost = roundCents(laborTotal);
  const total = roundCents(materialCost + laborCost);

  return { lineItems, materialCost, laborCost, total };
}
