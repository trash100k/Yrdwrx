import { describe, it, expect } from 'vitest';
import {
  METERS,
  emptyRollup,
  isMeter,
  applyUsage,
  computeOverage,
  projectBill,
  withinSpendCap,
  type Allotments,
  type Rates,
  type Meter,
} from './usageLedger';

// ---------------------------------------------------------------------------
// Fixtures drawn from PRICING_STRATEGY.md so tests double as a margin-model
// regression check.
// ---------------------------------------------------------------------------

// Pro tier bundle (§2): 1000 AI, 250 SMS, 60 live min, 25 aerial, 500 pdf soft cap.
const PRO_ALLOT: Allotments = {
  seats: 3,
  ai: 1000,
  sms: 250,
  live_min: 60,
  aerial: 25,
  pdf: 500,
};

// Retail overage rates (§4), in cents per unit.
const RATES: Rates = {
  ai: 4, // $0.04
  sms: 3, // $0.03
  live_min: 30, // $0.30
  aerial: 300, // $3.00
  pdf: 10, // $0.10
};

describe('METERS / emptyRollup / isMeter', () => {
  it('METERS lists exactly the five metered resources', () => {
    expect([...METERS]).toEqual(['ai', 'sms', 'live_min', 'aerial', 'pdf']);
  });

  it('emptyRollup returns all-zero tallies', () => {
    expect(emptyRollup()).toEqual({ ai: 0, sms: 0, live_min: 0, aerial: 0, pdf: 0 });
  });

  it('emptyRollup returns a fresh object each call (no shared reference)', () => {
    const a = emptyRollup();
    const b = emptyRollup();
    a.ai = 5;
    expect(b.ai).toBe(0);
    expect(a).not.toBe(b);
  });

  it('isMeter accepts valid keys and rejects everything else', () => {
    for (const m of METERS) expect(isMeter(m)).toBe(true);
    expect(isMeter('seats')).toBe(false);
    expect(isMeter('AI')).toBe(false);
    expect(isMeter('')).toBe(false);
    expect(isMeter(null)).toBe(false);
    expect(isMeter(undefined)).toBe(false);
    expect(isMeter(42)).toBe(false);
    expect(isMeter({})).toBe(false);
  });
});

describe('applyUsage', () => {
  it('adds quantity to the named meter', () => {
    const r = applyUsage(emptyRollup(), 'ai', 5);
    expect(r.ai).toBe(5);
  });

  it('accumulates onto an existing value', () => {
    const r1 = applyUsage(emptyRollup(), 'sms', 10);
    const r2 = applyUsage(r1, 'sms', 7);
    expect(r2.sms).toBe(17);
  });

  it('does not mutate the input rollup (returns a new object)', () => {
    const input = emptyRollup();
    const out = applyUsage(input, 'aerial', 3);
    expect(input.aerial).toBe(0);
    expect(out).not.toBe(input);
    expect(out.aerial).toBe(3);
  });

  it('supports fractional quantities (e.g. live minutes)', () => {
    const r = applyUsage(emptyRollup(), 'live_min', 1.5);
    expect(r.live_min).toBe(1.5);
  });

  it('fills missing meter keys with 0', () => {
    const partial = { ai: 2 } as unknown as Record<Meter, number>;
    const out = applyUsage(partial, 'sms', 1);
    expect(out).toEqual({ ai: 2, sms: 1, live_min: 0, aerial: 0, pdf: 0 });
  });

  it('sanitises pre-existing NaN / negative values in the rollup to 0', () => {
    const dirty = {
      ai: NaN,
      sms: -5,
      live_min: Infinity,
      aerial: 2,
      pdf: 0,
    } as Record<Meter, number>;
    const out = applyUsage(dirty, 'aerial', 1);
    expect(out).toEqual({ ai: 0, sms: 0, live_min: 0, aerial: 3, pdf: 0 });
  });

  it('ignores negative quantities (no change)', () => {
    const out = applyUsage(emptyRollup(), 'ai', -10);
    expect(out.ai).toBe(0);
  });

  it('ignores NaN and Infinity quantities', () => {
    expect(applyUsage(emptyRollup(), 'ai', NaN).ai).toBe(0);
    expect(applyUsage(emptyRollup(), 'ai', Infinity).ai).toBe(0);
    expect(applyUsage(emptyRollup(), 'ai', -Infinity).ai).toBe(0);
  });

  it('ignores non-number quantities', () => {
    expect(applyUsage(emptyRollup(), 'pdf', '5' as unknown as number).pdf).toBe(0);
  });

  it('returns a normalised rollup unchanged for an invalid meter key', () => {
    const out = applyUsage(emptyRollup(), 'seats' as unknown as Meter, 99);
    expect(out).toEqual(emptyRollup());
  });

  it('tolerates null / undefined rollup input', () => {
    const fromNull = applyUsage(null as unknown as Record<Meter, number>, 'ai', 4);
    expect(fromNull).toEqual({ ai: 4, sms: 0, live_min: 0, aerial: 0, pdf: 0 });
  });
});

describe('computeOverage', () => {
  it('reports zero overage when usage is within allotment', () => {
    const usage = { ai: 400, sms: 80, live_min: 20, aerial: 8, pdf: 100 };
    const res = computeOverage(usage, PRO_ALLOT, RATES);
    expect(res.overageCents).toBe(0);
    for (const m of METERS) {
      expect(res.perMeter[m].over).toBe(0);
      expect(res.perMeter[m].cents).toBe(0);
    }
  });

  it('charges cents = over * rate per meter and sums them (Persona A heavy, §5)', () => {
    // usage: 2500 cr · 600 SMS · 120 Live · 40 aerial, PDF within cap
    const usage = { ai: 2500, sms: 600, live_min: 120, aerial: 40, pdf: 50 };
    const res = computeOverage(usage, PRO_ALLOT, RATES);

    expect(res.perMeter.ai).toEqual({ over: 1500, cents: 6000 }); // 1500 * $0.04
    expect(res.perMeter.sms).toEqual({ over: 350, cents: 1050 }); // 350 * $0.03
    expect(res.perMeter.live_min).toEqual({ over: 60, cents: 1800 }); // 60 * $0.30
    expect(res.perMeter.aerial).toEqual({ over: 15, cents: 4500 }); // 15 * $3.00
    expect(res.perMeter.pdf).toEqual({ over: 0, cents: 0 });

    // Doc total: $133.50
    expect(res.overageCents).toBe(13350);
  });

  it('treats usage exactly at the allotment as zero overage (boundary)', () => {
    const usage = { ai: 1000, sms: 250, live_min: 60, aerial: 25, pdf: 500 };
    const res = computeOverage(usage, PRO_ALLOT, RATES);
    expect(res.overageCents).toBe(0);
  });

  it('rounds fractional cents to the nearest integer', () => {
    // 0.5 live minutes over at 30c/min = 15c exactly
    const exact = computeOverage(
      { ai: 0, sms: 0, live_min: 60.5, aerial: 0, pdf: 0 },
      PRO_ALLOT,
      RATES,
    );
    expect(exact.perMeter.live_min).toEqual({ over: 0.5, cents: 15 });

    // Force a non-integer product: 0.1 units over at rate 3 => 0.3c => rounds to 0
    const roundsDown = computeOverage(
      { ai: 0, sms: 250.1, live_min: 0, aerial: 0, pdf: 0 },
      PRO_ALLOT,
      RATES,
    );
    expect(roundsDown.perMeter.sms.cents).toBe(0);

    // 0.2 units over at rate 3 => 0.6c => rounds to 1
    const roundsUp = computeOverage(
      { ai: 0, sms: 250.2, live_min: 0, aerial: 0, pdf: 0 },
      PRO_ALLOT,
      RATES,
    );
    expect(roundsUp.perMeter.sms.cents).toBe(1);
  });

  it('sanitises negative and NaN usage to zero (no negative overage/credit)', () => {
    const usage = {
      ai: -100,
      sms: NaN,
      live_min: -5,
      aerial: 0,
      pdf: 0,
    } as Record<Meter, number>;
    const res = computeOverage(usage, PRO_ALLOT, RATES);
    expect(res.overageCents).toBe(0);
    expect(res.perMeter.ai.over).toBe(0);
    expect(res.perMeter.sms.over).toBe(0);
  });

  it('treats a missing allotment as 0 (all usage becomes overage)', () => {
    const allot = { seats: 1, ai: 100 } as unknown as Allotments; // sms/live/aerial/pdf missing
    const usage = { ai: 100, sms: 10, live_min: 0, aerial: 0, pdf: 0 };
    const res = computeOverage(usage, allot, RATES);
    expect(res.perMeter.ai.over).toBe(0); // within the given ai allotment
    expect(res.perMeter.sms).toEqual({ over: 10, cents: 30 }); // 10 * $0.03
  });

  it('treats NaN / missing rates as 0 cents while still reporting units over', () => {
    const rates = { ai: NaN } as unknown as Rates;
    const usage = { ai: 1500, sms: 300, live_min: 0, aerial: 0, pdf: 0 };
    const res = computeOverage(usage, PRO_ALLOT, rates);
    expect(res.perMeter.ai.over).toBe(500);
    expect(res.perMeter.ai.cents).toBe(0);
    expect(res.perMeter.sms.over).toBe(50);
    expect(res.perMeter.sms.cents).toBe(0);
    expect(res.overageCents).toBe(0);
  });

  it('always returns an entry for every meter', () => {
    const res = computeOverage(emptyRollup(), PRO_ALLOT, RATES);
    expect(Object.keys(res.perMeter).sort()).toEqual([...METERS].sort());
  });

  it('tolerates null usage / allotments / rates without throwing', () => {
    const res = computeOverage(
      null as unknown as Record<Meter, number>,
      null as unknown as Allotments,
      null as unknown as Rates,
    );
    expect(res.overageCents).toBe(0);
  });
});

describe('projectBill', () => {
  it('sums base + seat add-ons + overage', () => {
    // Persona B (§5): Pro base $249.00, 5 seats, 3 included, $29/seat, no overage
    const bill = projectBill(24900, 5, 3, 2900, 0);
    expect(bill.seatsCents).toBe(5800); // 2 extra * $29
    expect(bill.totalCents).toBe(30700); // $307.00
  });

  it('adds overage on top of base and seats (Persona B heavy)', () => {
    const bill = projectBill(24900, 5, 3, 2900, 28050); // $280.50 overage
    expect(bill.seatsCents).toBe(5800);
    expect(bill.totalCents).toBe(58750); // $587.50
  });

  it('reproduces the Enterprise base-with-seats figure ($949, §5 Persona C)', () => {
    // Enterprise base $649, 20 seats, 8 included, $25/seat
    const bill = projectBill(64900, 20, 8, 2500, 0);
    expect(bill.seatsCents).toBe(30000); // 12 extra * $25
    expect(bill.totalCents).toBe(94900); // $949.00
  });

  it('charges no seat cost when seats <= included', () => {
    expect(projectBill(24900, 3, 3, 2900, 0).seatsCents).toBe(0);
    expect(projectBill(24900, 1, 3, 2900, 0).seatsCents).toBe(0); // fewer than included
  });

  it('floors fractional seat counts to whole seats', () => {
    const bill = projectBill(24900, 5.9, 3, 2900, 0);
    expect(bill.seatsCents).toBe(5800); // floor(5.9)=5 -> 2 extra
  });

  it('clamps negative / NaN money and seat inputs to 0', () => {
    expect(projectBill(-100, 5, 3, 2900, 0).totalCents).toBe(5800); // base clamped to 0
    expect(projectBill(24900, NaN, 3, 2900, 0).seatsCents).toBe(0); // seats -> 0
    expect(projectBill(24900, 5, 3, NaN, 0).seatsCents).toBe(0); // seatCents -> 0
    expect(projectBill(24900, 5, 3, 2900, NaN).totalCents).toBe(30700); // overage -> 0
    expect(projectBill(24900, 5, 3, 2900, -500).totalCents).toBe(30700); // neg overage -> 0
  });

  it('rounds fractional cent inputs to integer cents', () => {
    const bill = projectBill(24900.4, 3, 3, 0, 99.6);
    expect(bill.totalCents).toBe(25000); // 24900 + 0 + 100
  });

  it('handles a bare base with no seats and no overage', () => {
    const bill = projectBill(24900, 0, 0, 0, 0);
    expect(bill).toEqual({ seatsCents: 0, totalCents: 24900 });
  });
});

describe('withinSpendCap', () => {
  it('allows any add when the cap is null (no cap configured)', () => {
    expect(withinSpendCap(999999, 500000, null)).toBe(true);
  });

  it('allows an add that lands under the cap', () => {
    expect(withinSpendCap(1000, 500, 2000)).toBe(true);
  });

  it('allows an add that lands exactly on the cap (inclusive)', () => {
    expect(withinSpendCap(1500, 500, 2000)).toBe(true);
  });

  it('rejects an add that would exceed the cap', () => {
    expect(withinSpendCap(1500, 501, 2000)).toBe(false);
  });

  it('sanitises negative / NaN current and add to 0', () => {
    expect(withinSpendCap(-100, 500, 2000)).toBe(true); // current -> 0
    expect(withinSpendCap(1000, -50, 2000)).toBe(true); // add -> 0
    expect(withinSpendCap(NaN, NaN, 2000)).toBe(true); // both -> 0
    expect(withinSpendCap(1000, NaN, 500)).toBe(false); // current 1000 > cap 500
  });

  it('fails closed on a zero cap (only a zero-cost add passes)', () => {
    expect(withinSpendCap(0, 0, 0)).toBe(true);
    expect(withinSpendCap(0, 1, 0)).toBe(false);
  });

  it('treats a negative cap as 0 (fail closed)', () => {
    expect(withinSpendCap(0, 100, -5000)).toBe(false);
    expect(withinSpendCap(0, 0, -5000)).toBe(true);
  });

  it('treats a non-finite (NaN/Infinity) cap as 0 — use null for unlimited', () => {
    expect(withinSpendCap(0, 100, NaN)).toBe(false);
    expect(withinSpendCap(0, 100, Infinity)).toBe(false);
    expect(withinSpendCap(0, 0, Infinity)).toBe(true);
  });

  it('treats undefined cap like null (defensive)', () => {
    expect(withinSpendCap(9_999_999, 1, undefined as unknown as number | null)).toBe(true);
  });
});
