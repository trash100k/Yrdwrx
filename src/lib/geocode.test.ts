import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizeAddress,
  stubCoordForAddress,
  geocodeAddress,
  backfillCoords,
  clearGeocodeCache,
  type Fetcher,
} from "./geocode";

// Continental-US-ish box the stub clusters within (see stubCoordForAddress).
const LAT_MIN = 31.4;
const LAT_MAX = 33.4;
const LNG_MIN = -89.9;
const LNG_MAX = -87.6;

describe("normalizeAddress", () => {
  it("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeAddress("  12   Poplar Springs  Dr  ")).toBe("12 poplar springs dr");
  });

  it("treats case/spacing variants as the same key", () => {
    expect(normalizeAddress("442 PINE grove   rd")).toBe(normalizeAddress("442 pine grove rd"));
  });

  it("handles null/undefined/empty without throwing", () => {
    expect(normalizeAddress(undefined)).toBe("");
    expect(normalizeAddress(null)).toBe("");
    expect(normalizeAddress("   ")).toBe("");
  });
});

describe("stubCoordForAddress", () => {
  it("is deterministic: same address -> identical coords", () => {
    const a = stubCoordForAddress("12 Poplar Springs Dr");
    const b = stubCoordForAddress("12 Poplar Springs Dr");
    expect(a).toEqual(b);
  });

  it("is stable across case/whitespace variants", () => {
    expect(stubCoordForAddress("12 Poplar Springs Dr")).toEqual(
      stubCoordForAddress("  12  poplar SPRINGS dr "),
    );
  });

  it("returns finite coords inside the expected bounding box", () => {
    for (const addr of ["1 Main St", "442 Pine Grove Rd", "Cedar Ridge Community", ""]) {
      const { lat, lng } = stubCoordForAddress(addr);
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lng)).toBe(true);
      expect(lat).toBeGreaterThanOrEqual(LAT_MIN);
      expect(lat).toBeLessThanOrEqual(LAT_MAX);
      expect(lng).toBeGreaterThanOrEqual(LNG_MIN);
      expect(lng).toBeLessThanOrEqual(LNG_MAX);
    }
  });

  it("spreads distinct addresses to distinct coords", () => {
    const seen = new Set(
      ["a st", "b st", "c st", "d ave", "e blvd"].map((a) => {
        const { lat, lng } = stubCoordForAddress(a);
        return `${lat},${lng}`;
      }),
    );
    expect(seen.size).toBe(5);
  });
});

describe("geocodeAddress", () => {
  beforeEach(() => clearGeocodeCache());

  const okFetcher = (body: any): Fetcher =>
    vi.fn(async () => ({ ok: true, json: async () => body })) as unknown as Fetcher;

  it("returns null for a blank address without hitting the network", async () => {
    const f = okFetcher({ lat: 1, lng: 2 });
    expect(await geocodeAddress("   ", f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("returns real coords and tags stub:false", async () => {
    const f = okFetcher({ configured: true, lat: 32.1, lng: -88.2, formatted: "X", stub: false });
    const r = await geocodeAddress("100 Real St", f);
    expect(r).toMatchObject({ lat: 32.1, lng: -88.2, formatted: "X", stub: false });
  });

  it("accepts stub coords from mock mode (configured:false, numeric coords)", async () => {
    const f = okFetcher({ configured: false, lat: 32.5, lng: -88.5, stub: true });
    const r = await geocodeAddress("mock addr", f);
    expect(r).toMatchObject({ lat: 32.5, lng: -88.5, stub: true });
  });

  it("caches within the session — same address is fetched only once", async () => {
    const f = okFetcher({ lat: 32.0, lng: -88.0 });
    await geocodeAddress("55 Cache Ln", f);
    await geocodeAddress("  55  CACHE  ln ", f); // normalizes to the same key
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns null (and does not throw) when the server responds not-ok", async () => {
    const f = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as Fetcher;
    expect(await geocodeAddress("500 Err St", f)).toBeNull();
  });

  it("falls back to a local deterministic stub when the fetcher throws", async () => {
    const f = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as Fetcher;
    const r = await geocodeAddress("77 Offline Rd", f);
    expect(r).not.toBeNull();
    expect(r).toMatchObject({ ...stubCoordForAddress("77 Offline Rd"), stub: true });
  });
});

describe("backfillCoords", () => {
  it("maps ids to coords from the server results", async () => {
    const f = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          { id: "a", lat: 32.1, lng: -88.1, stub: true, persisted: false },
          { id: "b", lat: null, lng: null },
        ],
      }),
    })) as unknown as Fetcher;
    const out = await backfillCoords(
      [
        { table: "customers", id: "a", address: "1 A St" },
        { table: "customers", id: "b", address: "2 B St" },
      ],
      f,
    );
    expect(out.get("a")).toMatchObject({ lat: 32.1, lng: -88.1, stub: true });
    expect(out.has("b")).toBe(false); // null coords are dropped, not fabricated
  });

  it("returns an empty map for no valid items without calling the network", async () => {
    const f = vi.fn() as unknown as Fetcher;
    const out = await backfillCoords([{ table: "jobs", id: "", address: "" }], f);
    expect(out.size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it("falls back to local stubs when the fetcher throws", async () => {
    const f = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as Fetcher;
    const out = await backfillCoords([{ table: "jobs", id: "j1", address: "9 Down St" }], f);
    expect(out.get("j1")).toMatchObject({ ...stubCoordForAddress("9 Down St"), stub: true });
  });
});
