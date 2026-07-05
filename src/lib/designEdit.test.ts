import { describe, it, expect } from "vitest";
import {
  MAX_IMAGE_CHARS,
  MAX_REGIONS,
  isImageString,
  validateEditInput,
  describeRegion,
  buildEditInstruction,
  convInit,
  convApply,
  convUndo,
  convRedo,
  convCanUndo,
  convCanRedo,
  convHeadImage,
  convHeadBase,
  convBefore,
  convAppliedTurns,
  type EditTurn,
} from "./designEdit";

const dataImg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ";
const turn = (id: string, over?: Partial<EditTurn>): EditTurn => ({
  id,
  instruction: `edit ${id}`,
  image: `img-${id}`,
  composite: `comp-${id}`,
  ...over,
});

describe("designEdit", () => {
  describe("isImageString", () => {
    it("accepts data: URIs and raw base64", () => {
      expect(isImageString(dataImg)).toBe(true);
      expect(isImageString("/9j/4AAQSkZJRgABAQEAYABgAAD/2w==")).toBe(true);
    });
    it("rejects non-strings, empties, and remote URLs (SSRF guard)", () => {
      expect(isImageString(null)).toBe(false);
      expect(isImageString(123)).toBe(false);
      expect(isImageString("")).toBe(false);
      expect(isImageString("   ")).toBe(false);
      expect(isImageString("https://evil.example/x.png")).toBe(false);
      expect(isImageString("file:///etc/passwd")).toBe(false);
    });
  });

  describe("validateEditInput", () => {
    it("400 when image missing/invalid", () => {
      expect(validateEditInput({ instruction: "greener lawn" })).toMatchObject({ ok: false, status: 400 });
      expect(validateEditInput({ image: 42, instruction: "x" } as any)).toMatchObject({ ok: false, status: 400 });
      expect(validateEditInput({ image: "https://x/y.png", instruction: "x" })).toMatchObject({ ok: false, status: 400 });
    });

    it("400 when image is oversized (never a 500)", () => {
      const huge = "data:image/png;base64," + "A".repeat(MAX_IMAGE_CHARS + 1);
      const v = validateEditInput({ image: huge, instruction: "x" });
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.error).toMatch(/too large/i);
    });

    it("400 when neither instruction nor a region is provided", () => {
      expect(validateEditInput({ image: dataImg })).toMatchObject({ ok: false, status: 400 });
      expect(validateEditInput({ image: dataImg, instruction: "   " })).toMatchObject({ ok: false, status: 400 });
    });

    it("400 when instruction is a non-string", () => {
      expect(validateEditInput({ image: dataImg, instruction: { a: 1 } } as any)).toMatchObject({ ok: false, status: 400 });
    });

    it("400 when a region label (catalog type) is a non-string", () => {
      const v = validateEditInput({ image: dataImg, regions: [{ label: 99 }] } as any);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.error).toMatch(/label/i);
    });

    it("400 when a region intent is a non-string", () => {
      expect(validateEditInput({ image: dataImg, regions: [{ intent: 7 }] } as any)).toMatchObject({ ok: false, status: 400 });
    });

    it("400 when regions is not an array or exceeds the cap", () => {
      expect(validateEditInput({ image: dataImg, regions: "nope" } as any)).toMatchObject({ ok: false, status: 400 });
      const many = Array.from({ length: MAX_REGIONS + 1 }, () => ({ label: "shrub" }));
      expect(validateEditInput({ image: dataImg, regions: many })).toMatchObject({ ok: false, status: 400 });
    });

    it("400 when a reference image is invalid or oversized", () => {
      expect(validateEditInput({ image: dataImg, instruction: "x", referenceImages: "no" } as any)).toMatchObject({ ok: false, status: 400 });
      expect(validateEditInput({ image: dataImg, instruction: "x", referenceImages: ["https://x/y.png"] })).toMatchObject({ ok: false, status: 400 });
    });

    it("ok for a valid instruction-only request", () => {
      expect(validateEditInput({ image: dataImg, instruction: "make the lawn greener" })).toEqual({ ok: true });
    });

    it("ok for a valid region-only request with string labels + refs", () => {
      expect(
        validateEditInput({
          image: dataImg,
          regions: [{ label: "Japanese Maple", cx: 0.5, cy: 0.5, intent: "add" }],
          referenceImages: [dataImg],
        }),
      ).toEqual({ ok: true });
    });
  });

  describe("describeRegion", () => {
    it("names quadrants and clamps out-of-range coords", () => {
      expect(describeRegion(0.5, 0.5)).toMatch(/center/);
      expect(describeRegion(0.9, 0.1)).toMatch(/upper-right/);
      expect(describeRegion(0.1, 0.9)).toMatch(/lower-left/);
      // out of range -> clamped, no NaN in the output
      expect(describeRegion(5, -3)).not.toMatch(/NaN/);
    });
  });

  describe("buildEditInstruction", () => {
    it("always includes the scene-preservation clause", () => {
      const p = buildEditInstruction({ instruction: "add a firepit" });
      expect(p).toMatch(/EXACTLY the same/);
      expect(p).toMatch(/add a firepit/);
    });
    it("numbers per-region lines and honors remove/replace intents", () => {
      const p = buildEditInstruction({
        regions: [
          { intent: "add", label: "boxwood", cx: 0.2, cy: 0.2 },
          { intent: "remove", cx: 0.8, cy: 0.8 },
          { intent: "replace", label: "paver patio", cx: 0.5, cy: 0.5 },
        ],
      });
      expect(p).toMatch(/1\. Place boxwood/);
      expect(p).toMatch(/2\. Remove whatever is/);
      expect(p).toMatch(/3\. Replace what is there with paver patio/);
    });
    it("adds a USDA-zone constraint only for a valid zone", () => {
      expect(buildEditInstruction({ instruction: "plants", zone: 6 })).toMatch(/USDA zone 6/);
      expect(buildEditInstruction({ instruction: "plants", zone: 99 })).not.toMatch(/USDA zone/);
      expect(buildEditInstruction({ instruction: "plants", zone: "abc" })).not.toMatch(/USDA zone/);
    });
    it("truncates a very long instruction", () => {
      const long = "x".repeat(5000);
      const p = buildEditInstruction({ instruction: long });
      expect(p.length).toBeLessThan(long.length + 500);
    });
  });

  describe("edit conversation (stack + undo/redo)", () => {
    it("init sits on the original with no turns", () => {
      const c = convInit("orig");
      expect(c).toEqual({ original: "orig", turns: [], cursor: -1 });
      expect(convHeadImage(c)).toBe("orig");
      expect(convHeadBase(c)).toBe("orig");
      expect(convBefore(c)).toBe("orig");
      expect(convCanUndo(c)).toBe(false);
      expect(convCanRedo(c)).toBe(false);
      expect(convAppliedTurns(c)).toEqual([]);
    });

    it("stacks edits — each builds on the previous result", () => {
      let c = convInit("orig");
      c = convApply(c, turn("1"));
      c = convApply(c, turn("2"));
      expect(c.turns).toHaveLength(2);
      expect(c.cursor).toBe(1);
      expect(convHeadImage(c)).toBe("img-2");
      // HEAD base prefers the pre-badge composite (the iteration invariant)
      expect(convHeadBase(c)).toBe("comp-2");
      expect(convAppliedTurns(c).map((t) => t.id)).toEqual(["1", "2"]);
    });

    it("undo/redo walks the cursor and floors at the original", () => {
      let c = convInit("orig");
      c = convApply(c, turn("1"));
      c = convApply(c, turn("2"));
      c = convUndo(c);
      expect(convHeadImage(c)).toBe("img-1");
      expect(convCanRedo(c)).toBe(true);
      c = convUndo(c);
      expect(convHeadImage(c)).toBe("orig"); // back on the original
      expect(convCanUndo(c)).toBe(false);
      c = convUndo(c); // no-op past the floor
      expect(c.cursor).toBe(-1);
      c = convRedo(c);
      expect(convHeadImage(c)).toBe("img-1");
    });

    it("applying after an undo discards the redo tail (branch)", () => {
      let c = convInit("orig");
      c = convApply(c, turn("1"));
      c = convApply(c, turn("2"));
      c = convUndo(c); // back at turn 1
      c = convApply(c, turn("3")); // branches from 1
      expect(c.turns.map((t) => t.id)).toEqual(["1", "3"]);
      expect(convCanRedo(c)).toBe(false);
      expect(convHeadImage(c)).toBe("img-3");
    });

    it("falls back to display image then original when no composite is present", () => {
      let c = convInit("orig");
      c = convApply(c, turn("1", { composite: undefined }));
      expect(convHeadBase(c)).toBe("img-1");
    });
  });
});
