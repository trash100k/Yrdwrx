// Geocoding client helper + pure deterministic-stub core.
//
// This module is CLIENT-ONLY. It is intentionally NOT imported by server.ts: the
// network helpers reach `./api` -> `./supabase` (which reads `import.meta.env`) and
// pulling that into the CJS server bundle would break it. server.ts carries its own
// small MIRROR of `stubCoordForAddress` / `normalizeAddress` (keep the two in sync).
//
// The pure functions (`normalizeAddress`, `stubCoordForAddress`) have no runtime
// dependencies and are unit-tested in geocode.test.ts. The network functions
// (`geocodeAddress`, `backfillCoords`) lazily `import("./api")` so that importing this
// module (e.g. from a test) never eagerly pulls in Supabase.

export interface GeoCoord {
  lat: number;
  lng: number;
}

export interface GeoResult extends GeoCoord {
  /** The formatted address returned by the provider, when available. */
  formatted?: string;
  /** True when these coords are a deterministic dev stub, not a real geocode. */
  stub?: boolean;
}

/** Minimal shape we need from a fetch-like function (real `Response` satisfies it). */
export type Fetcher = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; json: () => Promise<any> }>;

/**
 * Canonicalize an address for cache keying: trim, lowercase, collapse internal
 * whitespace. Two addresses that differ only in spacing/case share a cache entry.
 */
export function normalizeAddress(address?: string | null): string {
  return String(address ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// FNV-1a (32-bit) over the normalized address. Deterministic + well-distributed, and
// `Math.imul` keeps it to 32-bit integer math across every JS engine.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const round5 = (n: number): number => Math.round(n * 1e5) / 1e5;

/**
 * Deterministic STUB coordinate for an address, used when no Maps key is configured so
 * maps/routing still render in dev. The point is clustered in a ~2 degree box around the
 * app's default region (central MS) — plausible on the map, but clearly synthetic and
 * never presented as real precision. Same address in -> same coord out.
 *
 * MIRROR: server.ts `geoStubCoord()` uses the identical algorithm. Keep them in sync so
 * a record's coords don't shift between the server-issued stub and this local fallback.
 */
export function stubCoordForAddress(address?: string | null): GeoCoord {
  const h = fnv1a(normalizeAddress(address));
  const a = (h & 0xffff) / 0xffff; // 0..1
  const b = ((h >>> 16) & 0xffff) / 0xffff; // 0..1
  return {
    lat: round5(31.4 + a * 2.0), // 31.4 .. 33.4
    lng: round5(-89.9 + b * 2.3), // -89.9 .. -87.6
  };
}

// Session-lifetime cache so the same address isn't re-requested on every render/view.
// Keyed by normalized address; value `null` means "resolved to nothing" (don't retry).
const sessionCache = new Map<string, GeoResult | null>();

/** Test hook: reset the in-memory session cache. */
export function clearGeocodeCache(): void {
  sessionCache.clear();
}

async function resolveFetcher(fetcher?: Fetcher): Promise<Fetcher> {
  if (fetcher) return fetcher;
  const mod = await import("./api");
  return mod.fetchApi as unknown as Fetcher;
}

/**
 * Resolve an address to coordinates via the server `/api/geocode` proxy. Best-effort:
 * returns the coords (real or a dev stub), or `null` (blank/unresolvable). Never throws.
 * Results are cached for the session so repeat views don't re-hit the endpoint.
 */
export async function geocodeAddress(
  address?: string | null,
  fetcher?: Fetcher,
): Promise<GeoResult | null> {
  const key = normalizeAddress(address);
  if (!key) return null;
  if (sessionCache.has(key)) return sessionCache.get(key) ?? null;

  try {
    const doFetch = await resolveFetcher(fetcher);
    const res = await doFetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) {
      sessionCache.set(key, null);
      return null;
    }
    const data: any = await res.json();
    if (
      data &&
      typeof data.lat === "number" &&
      typeof data.lng === "number" &&
      Number.isFinite(data.lat) &&
      Number.isFinite(data.lng)
    ) {
      const result: GeoResult = {
        lat: data.lat,
        lng: data.lng,
        formatted: typeof data.formatted === "string" ? data.formatted : undefined,
        stub: !!data.stub,
      };
      sessionCache.set(key, result);
      return result;
    }
    // Configured but no result (e.g. a key set + address not found) — don't fabricate.
    sessionCache.set(key, null);
    return null;
  } catch {
    // Server unreachable (offline dev): fall back to a local deterministic stub so the
    // UI still renders. Not cached, so a real lookup can supersede it once back online.
    const s = stubCoordForAddress(key);
    return { lat: s.lat, lng: s.lng, stub: true };
  }
}

export interface BackfillItem {
  table: "customers" | "jobs";
  id: string;
  address: string;
}

/**
 * Geocode a batch of records AND persist the resolved lat/lng back onto each row
 * server-side (tenant-scoped) so subsequent views read stored coords instead of
 * re-geocoding. Returns a map of record id -> coords for the CURRENT view (rows already
 * having coords should not be passed in). Best-effort: never throws; on transport
 * failure it falls back to local deterministic stubs so the view still renders.
 */
export async function backfillCoords(
  items: BackfillItem[],
  fetcher?: Fetcher,
): Promise<Map<string, GeoResult>> {
  const out = new Map<string, GeoResult>();
  const valid = (items || []).filter((it) => it && it.id && it.address);
  if (valid.length === 0) return out;

  try {
    const doFetch = await resolveFetcher(fetcher);
    const res = await doFetch("/api/geocode/backfill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: valid }),
    });
    if (!res.ok) throw new Error("backfill request failed");
    const data: any = await res.json();
    for (const r of (data?.results as any[]) || []) {
      if (
        r &&
        typeof r.lat === "number" &&
        typeof r.lng === "number" &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng)
      ) {
        out.set(String(r.id), { lat: r.lat, lng: r.lng, stub: !!r.stub });
      }
    }
    return out;
  } catch {
    for (const it of valid) {
      const s = stubCoordForAddress(it.address);
      out.set(String(it.id), { lat: s.lat, lng: s.lng, stub: true });
    }
    return out;
  }
}
