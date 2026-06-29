// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  historyInit,
  historyPush,
  historyUndo,
  historyRedo,
  historyCurrent,
  canUndo,
  canRedo,
  buildProvenance,
} from './designSession';

const snap = (image: string) => ({ image });

describe('designSession', () => {
  describe('historyInit', () => {
    it('empty init -> { stack: [], index: -1 }', () => {
      expect(historyInit()).toEqual({ stack: [], index: -1 });
      expect(historyInit(null)).toEqual({ stack: [], index: -1 });
    });

    it('init with an initial snapshot seeds the stack at index 0', () => {
      const h = historyInit(snap('a'));
      expect(h.stack).toHaveLength(1);
      expect(h.index).toBe(0);
      expect(historyCurrent(h)).toEqual(snap('a'));
    });

    it('empty history cannot undo or redo and has no current', () => {
      const h = historyInit();
      expect(canUndo(h)).toBe(false);
      expect(canRedo(h)).toBe(false);
      expect(historyCurrent(h)).toBeNull();
    });
  });

  describe('historyPush', () => {
    it('appends, sets index to the end, and enables undo', () => {
      let h = historyInit(snap('a'));
      h = historyPush(h, snap('b'));
      expect(h.stack).toHaveLength(2);
      expect(h.index).toBe(1);
      expect(historyCurrent(h)).toEqual(snap('b'));
      expect(canUndo(h)).toBe(true);
      expect(canRedo(h)).toBe(false);
    });

    it('pushing onto an empty history works (index 0)', () => {
      let h = historyInit();
      h = historyPush(h, snap('a'));
      expect(h.stack).toHaveLength(1);
      expect(h.index).toBe(0);
      expect(historyCurrent(h)).toEqual(snap('a'));
    });

    it('does not mutate the input history', () => {
      const h0 = historyInit(snap('a'));
      const before = JSON.parse(JSON.stringify(h0));
      historyPush(h0, snap('b'));
      expect(h0).toEqual(before);
    });
  });

  describe('undo / redo', () => {
    it('undo then push truncates the redo tail', () => {
      let h = historyInit(snap('a'));
      h = historyPush(h, snap('b'));
      h = historyPush(h, snap('c'));
      // index now at 'c' (2). Undo back to 'b' (1).
      h = historyUndo(h);
      expect(h.index).toBe(1);
      expect(historyCurrent(h)).toEqual(snap('b'));
      expect(canRedo(h)).toBe(true);
      // Pushing a new snapshot drops the 'c' redo tail.
      h = historyPush(h, snap('d'));
      expect(h.stack.map((s) => s.image)).toEqual(['a', 'b', 'd']);
      expect(h.index).toBe(2);
      expect(canRedo(h)).toBe(false);
    });

    it('undo clamps at 0 and is a no-op on empty history', () => {
      let h = historyInit(snap('a'));
      h = historyPush(h, snap('b'));
      h = historyUndo(h); // -> 0
      h = historyUndo(h); // clamp at 0
      expect(h.index).toBe(0);
      expect(canUndo(h)).toBe(false);

      const empty = historyUndo(historyInit());
      expect(empty).toEqual({ stack: [], index: -1 });
    });

    it('redo clamps at the newest snapshot', () => {
      let h = historyInit(snap('a'));
      h = historyPush(h, snap('b'));
      h = historyUndo(h); // -> index 0
      h = historyRedo(h); // -> index 1
      h = historyRedo(h); // clamp at 1
      expect(h.index).toBe(1);
      expect(historyCurrent(h)).toEqual(snap('b'));
    });

    it('canUndo / canRedo report boundaries correctly', () => {
      let h = historyInit(snap('a'));
      h = historyPush(h, snap('b'));
      h = historyPush(h, snap('c'));
      // At the newest: can undo, cannot redo.
      expect(canUndo(h)).toBe(true);
      expect(canRedo(h)).toBe(false);
      // In the middle: can do both.
      h = historyUndo(h);
      expect(canUndo(h)).toBe(true);
      expect(canRedo(h)).toBe(true);
      // At the oldest: cannot undo, can redo.
      h = historyUndo(h);
      expect(canUndo(h)).toBe(false);
      expect(canRedo(h)).toBe(true);
    });
  });

  describe('cap at 20', () => {
    it('pushing 25 snapshots keeps length at 20 with the newest at HEAD', () => {
      let h = historyInit();
      for (let i = 0; i < 25; i++) {
        h = historyPush(h, snap('img-' + i));
      }
      expect(h.stack).toHaveLength(20);
      expect(h.index).toBe(19);
      // Oldest 5 (img-0..img-4) dropped; window is img-5..img-24.
      expect(h.stack[0].image).toBe('img-5');
      expect(historyCurrent(h)).toEqual(snap('img-24'));
    });
  });

  describe('buildProvenance', () => {
    it('sets synthId true and derives an ISO createdAt from a fixed ts', () => {
      const ts = Date.UTC(2026, 0, 15, 12, 30, 0); // fixed, deterministic
      const prov = buildProvenance({
        model: 'gemini-2.5-flash-image',
        prompt: 'modern xeriscape',
        sourceHash: 'abc123',
        zone: 7,
        regionCount: 3,
        ts,
      });
      expect(prov.synthId).toBe(true);
      expect(prov.createdAt).toBe('2026-01-15T12:30:00.000Z');
      expect(prov.createdAt).toBe(new Date(ts).toISOString());
      expect(prov.model).toBe('gemini-2.5-flash-image');
      expect(prov.prompt).toBe('modern xeriscape');
      expect(prov.sourceHash).toBe('abc123');
      expect(prov.zone).toBe(7);
      expect(prov.regionCount).toBe(3);
    });

    it('passes through optional fields as undefined / null when omitted', () => {
      const prov = buildProvenance({ model: 'mock', ts: 0 });
      expect(prov.model).toBe('mock');
      expect(prov.prompt).toBeUndefined();
      expect(prov.sourceHash).toBeUndefined();
      expect(prov.zone).toBeUndefined();
      expect(prov.regionCount).toBeUndefined();
      expect(prov.synthId).toBe(true);
      expect(prov.createdAt).toBe('1970-01-01T00:00:00.000Z');
    });
  });
});
