// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  containLayout,
  normalizeBBox,
  regionFromBBox,
  describeRegion,
} from './canvasGeometry';

describe('canvasGeometry', () => {
  describe('containLayout', () => {
    it('square image in square element: scale 1, no offset', () => {
      const layout = containLayout(100, 100, 100, 100);
      expect(layout.scale).toBeCloseTo(1);
      expect(layout.dispW).toBeCloseTo(100);
      expect(layout.dispH).toBeCloseTo(100);
      expect(layout.offsetX).toBeCloseTo(0);
      expect(layout.offsetY).toBeCloseTo(0);
    });

    it('landscape image in a TALL element produces vertical letterbox (offsetY > 0)', () => {
      // 200x100 natural, element 200x200 -> scale limited by width (1), dispH=100, bars top/bottom.
      const layout = containLayout(200, 100, 200, 200);
      expect(layout.scale).toBeCloseTo(1);
      expect(layout.dispW).toBeCloseTo(200);
      expect(layout.dispH).toBeCloseTo(100);
      expect(layout.offsetX).toBeCloseTo(0);
      expect(layout.offsetY).toBeCloseTo(50); // (200 - 100) / 2
      expect(layout.offsetY).toBeGreaterThan(0);
    });

    it('portrait image in a WIDE element produces horizontal letterbox (offsetX > 0)', () => {
      // 100x200 natural, element 200x200 -> scale limited by height (1), dispW=100, bars left/right.
      const layout = containLayout(100, 200, 200, 200);
      expect(layout.scale).toBeCloseTo(1);
      expect(layout.dispW).toBeCloseTo(100);
      expect(layout.dispH).toBeCloseTo(200);
      expect(layout.offsetX).toBeCloseTo(50); // (200 - 100) / 2
      expect(layout.offsetY).toBeCloseTo(0);
      expect(layout.offsetX).toBeGreaterThan(0);
    });

    it('guards divide-by-zero with non-positive dimensions', () => {
      expect(containLayout(0, 100, 100, 100)).toEqual({
        scale: 0,
        dispW: 0,
        dispH: 0,
        offsetX: 0,
        offsetY: 0,
      });
      expect(containLayout(100, 100, 100, -5)).toEqual({
        scale: 0,
        dispW: 0,
        dispH: 0,
        offsetX: 0,
        offsetY: 0,
      });
    });
  });

  describe('normalizeBBox', () => {
    it('square image in square element maps 1:1', () => {
      const n = normalizeBBox({ left: 25, top: 50, width: 50, height: 25 }, 100, 100, 100, 100);
      expect(n.nx).toBeCloseTo(0.25);
      expect(n.ny).toBeCloseTo(0.5);
      expect(n.nw).toBeCloseTo(0.5);
      expect(n.nh).toBeCloseTo(0.25);
    });

    it('landscape image in tall element: centered bbox maps to ~0.5/0.5', () => {
      // 200x100 natural in 200x200 element. dispH=100, offsetY=50 (vertical letterbox).
      // A 20x10 bbox centered on the displayed content sits at element (90, 95).
      const n = normalizeBBox({ left: 90, top: 95, width: 20, height: 10 }, 200, 100, 200, 200);
      // center x = (90 + 10) / 200 = 0.5 ; center y maps through dispH/offsetY
      const centerX = n.nx + n.nw / 2;
      const centerY = n.ny + n.nh / 2;
      expect(centerX).toBeCloseTo(0.5);
      expect(centerY).toBeCloseTo(0.5);
    });

    it('portrait image in wide element: centered bbox maps to ~0.5/0.5', () => {
      // 100x200 natural in 200x200 element. dispW=100, offsetX=50 (horizontal letterbox).
      const n = normalizeBBox({ left: 95, top: 90, width: 10, height: 20 }, 100, 200, 200, 200);
      const centerX = n.nx + n.nw / 2;
      const centerY = n.ny + n.nh / 2;
      expect(centerX).toBeCloseTo(0.5);
      expect(centerY).toBeCloseTo(0.5);
    });

    it('clamps when a bbox spills into the letterbox (coords stay within [0,1])', () => {
      // Landscape 200x100 in 200x200 element. Displayed content is y in [50,150].
      // A bbox starting at top=0 (in the top letterbox) and spilling huge should clamp.
      const n = normalizeBBox({ left: -40, top: 0, width: 9999, height: 9999 }, 200, 100, 200, 200);
      expect(n.nx).toBeGreaterThanOrEqual(0);
      expect(n.nx).toBeLessThanOrEqual(1);
      expect(n.ny).toBeGreaterThanOrEqual(0);
      expect(n.ny).toBeLessThanOrEqual(1);
      // nw must not exceed 1 - nx ; nh must not exceed 1 - ny.
      expect(n.nw).toBeLessThanOrEqual(1 - n.nx + 1e-9);
      expect(n.nh).toBeLessThanOrEqual(1 - n.ny + 1e-9);
      expect(n.nx + n.nw).toBeLessThanOrEqual(1 + 1e-9);
      expect(n.ny + n.nh).toBeLessThanOrEqual(1 + 1e-9);
      // top=0 is above the displayed content top (offsetY=50), so ny clamps to 0.
      expect(n.ny).toBeCloseTo(0);
      // left=-40 is left of content (offsetX=0), so nx clamps to 0.
      expect(n.nx).toBeCloseTo(0);
    });

    it('returns zeros when the layout collapses', () => {
      const n = normalizeBBox({ left: 10, top: 10, width: 10, height: 10 }, 0, 100, 100, 100);
      expect(n).toEqual({ nx: 0, ny: 0, nw: 0, nh: 0 });
    });
  });

  describe('regionFromBBox', () => {
    it('circle: radius = min(nw, nh) / 2 and center is correct', () => {
      // Square 100x100, element 100x100 -> 1:1. bbox 40x20 at (20,30).
      const region = regionFromBBox(
        'circle',
        { left: 20, top: 30, width: 40, height: 20 },
        100,
        100,
        100,
        100,
      );
      // nx=0.2, ny=0.3, nw=0.4, nh=0.2
      expect(region.shape).toBe('circle');
      expect(region.cx).toBeCloseTo(0.2 + 0.4 / 2); // 0.4
      expect(region.cy).toBeCloseTo(0.3 + 0.2 / 2); // 0.4
      expect(region.r).toBeCloseTo(Math.min(0.4, 0.2) / 2); // 0.1
      expect(region.x).toBeUndefined();
    });

    it('rect: sets x/y/w/h plus center cx/cy', () => {
      const region = regionFromBBox(
        'rect',
        { left: 10, top: 10, width: 30, height: 50 },
        100,
        100,
        100,
        100,
      );
      // nx=0.1, ny=0.1, nw=0.3, nh=0.5
      expect(region.shape).toBe('rect');
      expect(region.x).toBeCloseTo(0.1);
      expect(region.y).toBeCloseTo(0.1);
      expect(region.w).toBeCloseTo(0.3);
      expect(region.h).toBeCloseTo(0.5);
      expect(region.cx).toBeCloseTo(0.1 + 0.3 / 2); // 0.25
      expect(region.cy).toBeCloseTo(0.1 + 0.5 / 2); // 0.35
      expect(region.r).toBeUndefined();
    });
  });

  describe('describeRegion', () => {
    it('returns "lower-right" wording with percentages for cx=0.8, cy=0.85', () => {
      const phrase = describeRegion(0.8, 0.85);
      expect(phrase).toContain('lower-right');
      expect(phrase).toContain('80%');
      expect(phrase).toContain('85%');
      expect(phrase).toContain('from the left');
      expect(phrase).toContain('from the top');
    });

    it('returns "upper-left" wording with percentages for cx=0.1, cy=0.1', () => {
      const phrase = describeRegion(0.1, 0.1);
      expect(phrase).toContain('upper-left');
      expect(phrase).toContain('10%');
    });

    it('describes the dead center as "center"', () => {
      const phrase = describeRegion(0.5, 0.5);
      expect(phrase).toContain('center');
      expect(phrase).toContain('50%');
    });
  });
});
