import { describe, it, expect } from "vitest";
import {
  sqftToQuantities,
  estimateLineItems,
  type Measurement,
  type MaterialQuantities,
} from "./takeoff";

describe("sqftToQuantities", () => {
  it("computes every quantity for a typical property (happy path)", () => {
    const m: Measurement = { lawnSqft: 5000, bedSqft: 500, hardscapeSqft: 300, lotSqft: 8000 };
    expect(sqftToQuantities(m)).toEqual<MaterialQuantities>({
      // 500 sqft × (2/12 ft) ÷ 27 = 3.086… → 3.1 cu yd
      mulchCubicYards: 3.1,
      // 5000 × 1.05 waste = 5250 sqft
      sodSqft: 5250,
      // 5000/1000 × 4 lb = 20 lb
      seedLbs: 20,
      // 5000/1000 × 5 lb = 25 lb
      fertilizerLbs: 25,
      // 4 × √500 = 89.4… → 89 ft
      edgingLinearFtEstimate: 89,
    });
  });

  it("honors a custom mulch depth", () => {
    // 3" is the new-bed depth: 500 × (3/12) ÷ 27 = 4.629… → 4.6
    expect(sqftToQuantities({ bedSqft: 500 }, { mulchDepthInches: 3 }).mulchCubicYards).toBe(4.6);
    // Deeper layer ⇒ more mulch: 500 × (4/12) ÷ 27 = 6.17… → 6.2 (> the 3" case)
    expect(sqftToQuantities({ bedSqft: 500 }, { mulchDepthInches: 4 }).mulchCubicYards).toBe(6.2);
  });

  it("falls back to the 2\" default when depth is missing or invalid", () => {
    const expected = sqftToQuantities({ bedSqft: 1000 }).mulchCubicYards; // 6.2
    expect(sqftToQuantities({ bedSqft: 1000 }, {}).mulchCubicYards).toBe(expected);
    expect(sqftToQuantities({ bedSqft: 1000 }, { mulchDepthInches: 0 }).mulchCubicYards).toBe(expected);
    expect(sqftToQuantities({ bedSqft: 1000 }, { mulchDepthInches: -3 }).mulchCubicYards).toBe(expected);
    expect(sqftToQuantities({ bedSqft: 1000 }, { mulchDepthInches: NaN }).mulchCubicYards).toBe(expected);
    expect(
      sqftToQuantities({ bedSqft: 1000 }, { mulchDepthInches: Infinity }).mulchCubicYards,
    ).toBe(expected);
  });

  it("uses only the relevant area for each material (lawn vs bed are independent)", () => {
    // Only lawn provided: no mulch, no edging, but seed/fertilizer/sod present
    const lawnOnly = sqftToQuantities({ lawnSqft: 2000 });
    expect(lawnOnly.mulchCubicYards).toBe(0);
    expect(lawnOnly.edgingLinearFtEstimate).toBe(0);
    expect(lawnOnly.sodSqft).toBe(2100);
    expect(lawnOnly.seedLbs).toBe(8);
    expect(lawnOnly.fertilizerLbs).toBe(10);

    // Only beds provided: mulch + edging present, turf quantities zero
    const bedOnly = sqftToQuantities({ bedSqft: 400 });
    expect(bedOnly.edgingLinearFtEstimate).toBe(80); // 4 × √400
    expect(bedOnly.sodSqft).toBe(0);
    expect(bedOnly.seedLbs).toBe(0);
    expect(bedOnly.fertilizerLbs).toBe(0);
    expect(bedOnly.mulchCubicYards).toBeGreaterThan(0);
  });

  it("rounds seed/fertilizer to 0.1 lb", () => {
    // 100/1000 × 4 = 0.4 lb ; 100/1000 × 5 = 0.5 lb
    const q = sqftToQuantities({ lawnSqft: 100 });
    expect(q.seedLbs).toBe(0.4);
    expect(q.fertilizerLbs).toBe(0.5);
  });

  it("returns all zeros for an empty measurement", () => {
    expect(sqftToQuantities({})).toEqual<MaterialQuantities>({
      mulchCubicYards: 0,
      sodSqft: 0,
      seedLbs: 0,
      fertilizerLbs: 0,
      edgingLinearFtEstimate: 0,
    });
  });

  it("guards against negative, NaN, Infinity, null and undefined inputs (never NaN out)", () => {
    const bad = sqftToQuantities({
      lawnSqft: -5000,
      bedSqft: NaN,
      hardscapeSqft: Infinity,
    } as Measurement);
    expect(bad).toEqual<MaterialQuantities>({
      mulchCubicYards: 0,
      sodSqft: 0,
      seedLbs: 0,
      fertilizerLbs: 0,
      edgingLinearFtEstimate: 0,
    });

    // null measurement passed at runtime must not throw
    const nulled = sqftToQuantities(null as unknown as Measurement);
    expect(Number.isNaN(nulled.mulchCubicYards)).toBe(false);
    expect(nulled.sodSqft).toBe(0);

    // undefined fields behave like missing
    const partial = sqftToQuantities({ lawnSqft: undefined, bedSqft: undefined });
    expect(partial.seedLbs).toBe(0);
  });

  it("never emits NaN for any field across fuzzed inputs", () => {
    const inputs: Measurement[] = [
      { lawnSqft: 0, bedSqft: 0 },
      { lawnSqft: 1, bedSqft: 1 },
      { lawnSqft: 999999, bedSqft: 250000 },
      { lawnSqft: -1, bedSqft: -1 },
      { lawnSqft: NaN, bedSqft: NaN },
    ];
    for (const m of inputs) {
      const q = sqftToQuantities(m);
      for (const v of Object.values(q)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("estimateLineItems", () => {
  const m: Measurement = { lawnSqft: 5000, bedSqft: 500 };

  it("builds priced lines for every rate provided (happy path)", () => {
    const lines = estimateLineItems(m, { mowPerSqft: 0.02, mulchPerYard: 45, sodPerSqft: 1.5 });
    expect(lines).toEqual([
      { description: "Lawn mowing", quantity: 5000, rate: 0.02, amount: 100 },
      { description: "Mulch installation", quantity: 3.1, rate: 45, amount: 139.5 },
      { description: "Sod installation", quantity: 5250, rate: 1.5, amount: 7875 },
    ]);
  });

  it("quantities agree with sqftToQuantities", () => {
    const q = sqftToQuantities(m);
    const lines = estimateLineItems(m, { mulchPerYard: 40, sodPerSqft: 2 });
    const mulch = lines.find((l) => l.description === "Mulch installation");
    const sod = lines.find((l) => l.description === "Sod installation");
    expect(mulch?.quantity).toBe(q.mulchCubicYards);
    expect(sod?.quantity).toBe(q.sodSqft);
  });

  it("omits a line when the rate is missing", () => {
    const lines = estimateLineItems(m, { mowPerSqft: 0.02 });
    expect(lines.map((l) => l.description)).toEqual(["Lawn mowing"]);
  });

  it("omits a line when the quantity is zero even if a rate is given", () => {
    // No beds ⇒ no mulch line despite a mulch rate
    const lines = estimateLineItems({ lawnSqft: 3000 }, { mulchPerYard: 50, sodPerSqft: 1 });
    expect(lines.map((l) => l.description)).toEqual(["Sod installation"]);
  });

  it("returns an empty array when no rates are provided", () => {
    expect(estimateLineItems(m, {})).toEqual([]);
  });

  it("returns an empty array when the measurement is empty", () => {
    expect(estimateLineItems({}, { mowPerSqft: 0.02, mulchPerYard: 45, sodPerSqft: 1.5 })).toEqual([]);
  });

  it("drops lines with negative, zero, or NaN rates", () => {
    const lines = estimateLineItems(m, {
      mowPerSqft: -0.05,
      mulchPerYard: 0,
      sodPerSqft: NaN,
    });
    expect(lines).toEqual([]);
  });

  it("rounds amounts to cents without float drift", () => {
    // 333 sqft × $0.10 = 33.300000000000004 in float; must land on 33.3
    const lines = estimateLineItems({ lawnSqft: 333 }, { mowPerSqft: 0.1 });
    expect(lines[0].amount).toBe(33.3);
  });

  it("guards against a null measurement and garbage rates without throwing", () => {
    expect(estimateLineItems(null as unknown as Measurement, { mowPerSqft: 0.02 })).toEqual([]);
    const lines = estimateLineItems(m, {
      mowPerSqft: Infinity,
      mulchPerYard: "45" as unknown as number, // numeric string coerces to 45
    });
    // Infinity mow rate is rejected; coerced mulch rate is accepted
    expect(lines.map((l) => l.description)).toEqual(["Mulch installation"]);
    expect(lines[0].rate).toBe(45);
  });
});
