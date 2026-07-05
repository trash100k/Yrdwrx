import { describe, it, expect } from "vitest";
import {
  selectAdapter,
  resolveApiKey,
  regridAdapter,
  manualFallback,
  sanitizeSqft,
  ADAPTERS,
  SQFT_PER_ACRE,
  RESIDENTIAL_LAWN_FRACTION_OF_LOT,
} from "./measureAdapter";

describe("selectAdapter / resolveApiKey", () => {
  it("returns null when no provider key is set", () => {
    expect(selectAdapter({})).toBeNull();
  });

  it("selects Regrid from the generic MEASUREMENT_API_KEY", () => {
    const a = selectAdapter({ MEASUREMENT_API_KEY: "tok" });
    expect(a?.id).toBe("regrid");
  });

  it("prefers REGRID_API_KEY and resolves the key value", () => {
    expect(resolveApiKey(regridAdapter, { REGRID_API_KEY: "  rk  " })).toBe("rk");
    expect(resolveApiKey(regridAdapter, { MEASUREMENT_API_KEY: "mk" })).toBe("mk");
    expect(resolveApiKey(regridAdapter, {})).toBeNull();
    // blank/whitespace-only is not a configured key
    expect(resolveApiKey(regridAdapter, { REGRID_API_KEY: "   " })).toBeNull();
  });

  it("has a stable, non-empty registry", () => {
    expect(ADAPTERS.length).toBeGreaterThanOrEqual(1);
    expect(ADAPTERS.map((a) => a.id)).toContain("regrid");
  });
});

describe("regridAdapter.buildRequestUrl", () => {
  it("builds a public https parcel URL from coords + key", () => {
    const url = regridAdapter.buildRequestUrl({ lat: 30.27, lng: -97.74, address: "x", apiKey: "tok" });
    expect(url).toContain("https://app.regrid.com/api/v2/parcels/point");
    expect(url).toContain("lat=30.27");
    expect(url).toContain("lon=-97.74");
    expect(url).toContain("token=tok");
  });

  it("returns null on missing key or non-finite coords (caller falls through, no fetch)", () => {
    expect(regridAdapter.buildRequestUrl({ lat: 1, lng: 2, address: "x", apiKey: "" })).toBeNull();
    expect(regridAdapter.buildRequestUrl({ lat: NaN, lng: 2, address: "x", apiKey: "t" })).toBeNull();
    expect(regridAdapter.buildRequestUrl({ lat: 1, lng: Infinity, address: "x", apiKey: "t" })).toBeNull();
  });
});

describe("regridAdapter.parse", () => {
  const feature = (fields: any) => ({
    parcels: { type: "FeatureCollection", features: [{ properties: { fields } }] },
  });

  it("derives lot sqft from GIS acreage and a labeled ~60% lawn estimate", () => {
    const acres = 0.25;
    const r = regridAdapter.parse(feature({ ll_gisacre: acres }))!;
    const expectedLot = Math.round(acres * SQFT_PER_ACRE);
    expect(r.source).toBe("provider");
    expect(r.provider).toBe("regrid");
    expect(r.lotSqft).toBe(expectedLot);
    expect(r.lawnSqft).toBe(Math.round(expectedLot * RESIDENTIAL_LAWN_FRACTION_OF_LOT));
    expect(r.confidence).toBe("medium"); // lot measured, turf split derived
    expect(r.note).toMatch(/estimated/i);
    expect(r.bedSqft).toBeNull();
  });

  it("prefers an explicit sqft field over acreage", () => {
    const r = regridAdapter.parse(feature({ ll_gissqft: 8000, ll_gisacre: 99 }))!;
    expect(r.lotSqft).toBe(8000);
  });

  it("uses lot-minus-building when a building footprint is present", () => {
    const r = regridAdapter.parse(feature({ ll_gissqft: 10000, ll_bldg_footprint_sqft: 2200 }))!;
    expect(r.lotSqft).toBe(10000);
    expect(r.lawnSqft).toBe(7800);
    expect(r.note).toMatch(/building footprint/i);
  });

  it("returns null when there is no usable measurement (caller falls through, never 500)", () => {
    expect(regridAdapter.parse({})).toBeNull();
    expect(regridAdapter.parse({ parcels: { features: [] } })).toBeNull();
    expect(regridAdapter.parse(feature({ ll_gisacre: 0 }))).toBeNull();
    expect(regridAdapter.parse(null)).toBeNull();
  });
});

describe("manualFallback (honest no-provider result)", () => {
  it("labels source manual with all areas null and no fabricated numbers", () => {
    const r = manualFallback();
    expect(r.source).toBe("manual");
    expect(r.lawnSqft).toBeNull();
    expect(r.bedSqft).toBeNull();
    expect(r.hardscapeSqft).toBeNull();
    expect(r.lotSqft).toBeNull();
    expect(r.confidence).toBe("low");
    expect(r.note).toBeTruthy();
  });
});

describe("sanitizeSqft", () => {
  it("keeps positive finite values (rounded) and nulls everything else", () => {
    expect(sanitizeSqft(1234.6)).toBe(1235);
    expect(sanitizeSqft("500")).toBe(500);
    expect(sanitizeSqft(0)).toBeNull();
    expect(sanitizeSqft(-5)).toBeNull();
    expect(sanitizeSqft(NaN)).toBeNull();
    expect(sanitizeSqft(Infinity)).toBeNull();
    expect(sanitizeSqft(null)).toBeNull();
    expect(sanitizeSqft(undefined)).toBeNull();
  });
});
