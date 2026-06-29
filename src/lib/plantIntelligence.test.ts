// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  zoneFromState,
  zoneFromZip,
  resolveZone,
  selectPlants,
  noCrowdQuantity,
  estimateLineItems,
} from './plantIntelligence';
import type { PlantCatalogItem, SiteContext } from './plantIntelligence';

describe('plantIntelligence', () => {
  describe('zoneFromState', () => {
    it('returns a plausible warm range for Florida (~9-11)', () => {
      const fl = zoneFromState('FL');
      expect(fl).not.toBeNull();
      expect(fl!.zoneMin).toBeGreaterThanOrEqual(8);
      expect(fl!.zoneMax).toBeLessThanOrEqual(11);
      expect(fl!.zoneMax).toBeGreaterThanOrEqual(10);
      expect(fl!.zone).toBeGreaterThanOrEqual(fl!.zoneMin);
      expect(fl!.zone).toBeLessThanOrEqual(fl!.zoneMax);
    });

    it('returns a plausible cold range for Minnesota (~3-4)', () => {
      const mn = zoneFromState('MN');
      expect(mn).not.toBeNull();
      expect(mn!.zoneMin).toBeGreaterThanOrEqual(2);
      expect(mn!.zoneMin).toBeLessThanOrEqual(3);
      expect(mn!.zoneMax).toBeLessThanOrEqual(5);
    });

    it('accepts full state names case-insensitively', () => {
      const fl = zoneFromState('florida');
      expect(fl).not.toBeNull();
      expect(fl!.zoneMax).toBeGreaterThanOrEqual(10);
    });

    it('returns null for junk / unknown input', () => {
      expect(zoneFromState('ZZ')).toBeNull();
      expect(zoneFromState('not a state')).toBeNull();
      expect(zoneFromState('')).toBeNull();
      expect(zoneFromState('   ')).toBeNull();
    });
  });

  describe('zoneFromZip', () => {
    it('resolves a sampled ZIP3 prefix', () => {
      expect(zoneFromZip('33101')).toBe(10); // Miami
      expect(zoneFromZip('55401')).toBe(4); // Minneapolis
    });

    it('returns null honestly for an unsampled / junk ZIP', () => {
      expect(zoneFromZip('99999')).toBeNull();
      expect(zoneFromZip('ab')).toBeNull();
      expect(zoneFromZip('')).toBeNull();
    });
  });

  describe('resolveZone', () => {
    it('prefers explicit over zip and state', () => {
      const r = resolveZone({ explicit: 6, zip: '33101', state: 'FL' });
      expect(r.zone).toBe(6);
      expect(r.source).toBe('explicit');
      expect(r.approx).toBe(false);
    });

    it('falls back to zip when no explicit value', () => {
      const r = resolveZone({ zip: '33101', state: 'MN' });
      expect(r.zone).toBe(10);
      expect(r.source).toBe('zip');
      expect(r.approx).toBe(true);
    });

    it('falls back to state when no explicit or sampled zip', () => {
      const r = resolveZone({ zip: '99999', state: 'MN' });
      expect(r.source).toBe('state');
      expect(r.approx).toBe(true);
      expect(r.zone).toBeGreaterThanOrEqual(3);
      expect(r.zone).toBeLessThanOrEqual(4);
    });

    it('reports unknown when nothing resolves', () => {
      const r = resolveZone({});
      expect(r.zone).toBeNull();
      expect(r.source).toBe('unknown');
      expect(r.approx).toBe(false);
    });
  });

  describe('selectPlants', () => {
    const warmPlant: PlantCatalogItem = {
      id: 'palm',
      name: 'Sago Palm',
      zoneMin: 9,
      zoneMax: 11,
      sun: ['full_sun', 'part_sun'],
      matureSpreadFt: 4,
      native: false,
    };
    const shadePlant: PlantCatalogItem = {
      id: 'fern',
      name: 'Ostrich Fern',
      zoneMin: 3,
      zoneMax: 7,
      sun: ['full_shade', 'part_shade'],
      matureSpreadFt: 3,
      native: true,
      deerRating: 'B',
    };
    const goodPlant: PlantCatalogItem = {
      id: 'cone',
      name: 'Purple Coneflower',
      zoneMin: 3,
      zoneMax: 8,
      sun: ['full_sun', 'part_sun'],
      matureSpreadFt: 2,
      native: true,
      deerRating: 'A',
      installLaborMinutes: 15,
    };

    it('rejects an out-of-zone plant and an incompatible-sun plant, keeps a compatible one', () => {
      const site: SiteContext = { zone: 5, sun: 'full_sun' };
      const res = selectPlants([warmPlant, shadePlant, goodPlant], site);

      const pickIds = res.picks.map((p) => p.id);
      expect(pickIds).toContain('cone');
      expect(pickIds).not.toContain('palm'); // zone 9-11 at site zone 5
      expect(pickIds).not.toContain('fern'); // shade-only at full_sun

      const rejectedIds = res.rejected.map((r) => r.id);
      expect(rejectedIds).toContain('palm');
      expect(rejectedIds).toContain('fern');

      const palmReject = res.rejected.find((r) => r.id === 'palm');
      expect(palmReject!.reason).toMatch(/zone/i);
      const fernReject = res.rejected.find((r) => r.id === 'fern');
      expect(fernReject!.reason).toMatch(/sun/i);

      expect(res.zoneApplied).toBe(true);
    });

    it('does NOT reject everything when site.zone is null (zone filter skipped)', () => {
      const site: SiteContext = { zone: null, sun: 'full_sun' };
      const res = selectPlants([warmPlant, goodPlant], site);

      expect(res.zoneApplied).toBe(false);
      const pickIds = res.picks.map((p) => p.id);
      // warmPlant is out-of-zone for zone 5, but with null zone it must NOT be rejected on zone.
      expect(pickIds).toContain('palm');
      expect(pickIds).toContain('cone');
      // No zone-based rejections should appear.
      expect(res.rejected.some((r) => /zone/i.test(r.reason))).toBe(false);
    });

    it('rejects palatable plants under deer pressure (C/D), keeps A/B', () => {
      const tasty: PlantCatalogItem = {
        id: 'hosta',
        name: 'Hosta',
        zoneMin: 3,
        zoneMax: 9,
        sun: ['part_shade', 'full_shade'],
        matureSpreadFt: 2,
        deerRating: 'D',
      };
      const site: SiteContext = { zone: 6, sun: 'part_shade', deerPressure: true };
      const res = selectPlants([tasty, shadePlant], site);
      const pickIds = res.picks.map((p) => p.id);
      expect(pickIds).toContain('fern'); // deer rating B -> kept
      expect(pickIds).not.toContain('hosta'); // deer rating D -> rejected
      expect(res.rejected.find((r) => r.id === 'hosta')!.reason).toMatch(/deer/i);
    });

    it('excludes invasive species', () => {
      const invasive: PlantCatalogItem = {
        id: 'barberry',
        name: 'Japanese Barberry',
        zoneMin: 4,
        zoneMax: 8,
        invasive: true,
      };
      const res = selectPlants([invasive, goodPlant], { zone: 6 });
      expect(res.picks.map((p) => p.id)).not.toContain('barberry');
      expect(res.rejected.find((r) => r.id === 'barberry')!.reason).toMatch(/invasive/i);
    });

    it('always keeps non-plant materials (mulch, hardscape)', () => {
      const mulch: PlantCatalogItem = { id: 'mulch', name: 'Hardwood Mulch', kind: 'mulch' };
      const res = selectPlants([mulch], { zone: 5, sun: 'full_sun', deerPressure: true });
      expect(res.picks.map((p) => p.id)).toContain('mulch');
    });
  });

  describe('noCrowdQuantity', () => {
    it('computes max and recommended for a 100 sqft bed at 5ft spacing', () => {
      const q = noCrowdQuantity(100, 5);
      expect(q.max).toBe(4); // floor(100 / 25)
      expect(q.recommended).toBe(3); // round(4 * 0.78) = round(3.12)
    });

    it('guards against non-positive inputs', () => {
      expect(noCrowdQuantity(0, 5)).toEqual({ max: 0, recommended: 0 });
      expect(noCrowdQuantity(100, 0)).toEqual({ max: 0, recommended: 0 });
      expect(noCrowdQuantity(-10, 5)).toEqual({ max: 0, recommended: 0 });
      expect(noCrowdQuantity(100, -2)).toEqual({ max: 0, recommended: 0 });
    });
  });

  describe('estimateLineItems', () => {
    it('sums material + labor correctly with a known labor rate', () => {
      const shrub: PlantCatalogItem = {
        id: 'shrub',
        name: 'Boxwood',
        unitPrice: 30,
        installLaborMinutes: 20,
      };
      const tree: PlantCatalogItem = {
        id: 'tree',
        name: 'Red Maple',
        unitPrice: 120,
        installLaborMinutes: 60,
      };
      const laborRate = 60; // $/hour -> $1/minute

      const res = estimateLineItems(
        [
          { item: shrub, qty: 5 }, // material 150, labor (5*20/60)*60 = 100
          { item: tree, qty: 2 }, // material 240, labor (2*60/60)*60 = 120
        ],
        laborRate,
      );

      expect(res.lineItems).toHaveLength(2);

      expect(res.lineItems[0].materialCost).toBeCloseTo(150, 2);
      expect(res.lineItems[0].laborCost).toBeCloseTo(100, 2);
      expect(res.lineItems[0].lineTotal).toBeCloseTo(250, 2);

      expect(res.lineItems[1].materialCost).toBeCloseTo(240, 2);
      expect(res.lineItems[1].laborCost).toBeCloseTo(120, 2);
      expect(res.lineItems[1].lineTotal).toBeCloseTo(360, 2);

      expect(res.materialCost).toBeCloseTo(390, 2);
      expect(res.laborCost).toBeCloseTo(220, 2);
      expect(res.total).toBeCloseTo(610, 2);
    });

    it('is deterministic (same inputs -> same output)', () => {
      const item: PlantCatalogItem = { id: 'x', name: 'X', unitPrice: 12.5, installLaborMinutes: 10 };
      const a = estimateLineItems([{ item, qty: 3 }], 45);
      const b = estimateLineItems([{ item, qty: 3 }], 45);
      expect(a).toEqual(b);
      expect(a.total).toBeCloseTo(a.materialCost + a.laborCost, 2);
    });

    it('handles empty / missing rows safely', () => {
      const res = estimateLineItems([], 50);
      expect(res.lineItems).toHaveLength(0);
      expect(res.total).toBeCloseTo(0, 2);
    });
  });
});
