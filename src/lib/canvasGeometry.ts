// @ts-nocheck
//
// canvasGeometry.ts
//
// Pure, dependency-free coordinate math for mapping fabric.js shapes drawn over an
// `object-contain` <img> into normalized [0..1] image coordinates.
//
// An <img> with CSS `object-fit: contain` scales its natural pixels by the SMALLER of the
// two element/natural ratios so the whole image fits, then centers the result inside the
// element — leaving "letterbox" bars on the two opposing sides. A fabric.js canvas laid on
// top of that element draws shapes in *element/canvas pixel* space, which includes those
// letterbox bars. To talk to an instruction-only image model about "where" something is, we
// must convert those canvas-pixel coordinates into coordinates relative to the DISPLAYED
// IMAGE CONTENT (not the element, not the letterbox), normalized to [0..1].

export interface ContainLayout {
  scale: number;
  dispW: number;
  dispH: number;
  offsetX: number;
  offsetY: number;
}

/**
 * object-contain math: the image is scaled by the SMALLER ratio and centered (letterboxed)
 * inside the element.
 *
 *   scale   = min(elemW/natW, elemH/natH)
 *   dispW   = natW * scale
 *   dispH   = natH * scale
 *   offsetX = (elemW - dispW) / 2
 *   offsetY = (elemH - dispH) / 2
 *
 * Returns all zeros if any dimension is <= 0 (divide-by-zero guard).
 */
export function containLayout(
  natW: number,
  natH: number,
  elemW: number,
  elemH: number,
): ContainLayout {
  if (natW <= 0 || natH <= 0 || elemW <= 0 || elemH <= 0) {
    return { scale: 0, dispW: 0, dispH: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(elemW / natW, elemH / natH);
  const dispW = natW * scale;
  const dispH = natH * scale;
  const offsetX = (elemW - dispW) / 2;
  const offsetY = (elemH - dispH) / 2;
  return { scale, dispW, dispH, offsetX, offsetY };
}

export interface NormBBox {
  nx: number;
  ny: number;
  nw: number;
  nh: number;
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Map a canvas-pixel bounding box (left/top/width/height, in element/canvas px) to normalized
 * 0..1 coords RELATIVE TO THE DISPLAYED IMAGE CONTENT (not the letterbox). Clamp all outputs
 * to valid ranges: nx,ny in [0,1]; nw in [0, 1-nx]; nh in [0, 1-ny].
 *
 *   nx = clamp((left - offsetX) / dispW, 0, 1)
 *   ny = clamp((top  - offsetY) / dispH, 0, 1)
 *   nw = clamp(width  / dispW, 0, 1 - nx)
 *   nh = clamp(height / dispH, 0, 1 - ny)
 *
 * Returns all zeros if the layout collapses (any dimension <= 0).
 */
export function normalizeBBox(
  bbox: { left: number; top: number; width: number; height: number },
  natW: number,
  natH: number,
  elemW: number,
  elemH: number,
): NormBBox {
  const { dispW, dispH, offsetX, offsetY } = containLayout(natW, natH, elemW, elemH);
  if (dispW <= 0 || dispH <= 0) {
    return { nx: 0, ny: 0, nw: 0, nh: 0 };
  }
  const nx = clamp((bbox.left - offsetX) / dispW, 0, 1);
  const ny = clamp((bbox.top - offsetY) / dispH, 0, 1);
  const nw = clamp(bbox.width / dispW, 0, 1 - nx);
  const nh = clamp(bbox.height / dispH, 0, 1 - ny);
  return { nx, ny, nw, nh };
}

export type RegionShape = "circle" | "rect";

export interface NormRegion {
  shape: RegionShape;
  cx: number;
  cy: number;
  r?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

/**
 * Build a normalized region from a canvas-px bbox.
 *
 * For "circle": cx = nx + nw/2, cy = ny + nh/2, r = min(nw, nh) / 2.
 * For "rect":   x = nx, y = ny, w = nw, h = nh, and also set cx = nx + nw/2, cy = ny + nh/2
 *               (center, handy for describeRegion).
 */
export function regionFromBBox(
  shape: RegionShape,
  bbox: { left: number; top: number; width: number; height: number },
  natW: number,
  natH: number,
  elemW: number,
  elemH: number,
): NormRegion {
  const { nx, ny, nw, nh } = normalizeBBox(bbox, natW, natH, elemW, elemH);
  const cx = nx + nw / 2;
  const cy = ny + nh / 2;
  if (shape === "circle") {
    return { shape: "circle", cx, cy, r: Math.min(nw, nh) / 2 };
  }
  return { shape: "rect", cx, cy, x: nx, y: ny, w: nw, h: nh };
}

/**
 * Human spatial phrase from a normalized center point, for prompting an instruction-only
 * image model. Uses a 3x3 grid (top/upper/center/lower/bottom × left/center/right) PLUS exact
 * percentages, e.g.
 *   "in the lower-right of the image (about 72% from the left, 82% from the top)".
 */
export function describeRegion(cx: number, cy: number): string {
  const x = clamp(cx, 0, 1);
  const y = clamp(cy, 0, 1);

  // Vertical band: top / upper / center / lower / bottom. "top"/"bottom" are reserved for the
  // extreme edges; the broad upper/lower thirds carry most points (so e.g. y=0.85 -> "lower").
  let vert: string;
  if (y < 0.1) vert = "top";
  else if (y < 0.4) vert = "upper";
  else if (y < 0.6) vert = "center";
  else if (y < 0.9) vert = "lower";
  else vert = "bottom";

  // Horizontal band: left / center / right.
  let horiz: string;
  if (x < 0.34) horiz = "left";
  else if (x < 0.67) horiz = "center";
  else horiz = "right";

  // Compose the grid label. Avoid the awkward "center-center"; collapse pure-center to "center".
  let label: string;
  if (vert === "center" && horiz === "center") {
    label = "center";
  } else if (vert === "center") {
    label = horiz; // e.g. "left" / "right" (vertically centered)
  } else if (horiz === "center") {
    label = vert; // e.g. "top" / "bottom" (horizontally centered)
  } else {
    label = `${vert}-${horiz}`; // e.g. "lower-right", "upper-left"
  }

  const pctX = Math.round(x * 100);
  const pctY = Math.round(y * 100);
  return `in the ${label} of the image (about ${pctX}% from the left, ${pctY}% from the top)`;
}
