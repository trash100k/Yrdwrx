// Pure, dependency-free helpers for the Design Studio ITERATIVE EDIT loop — the
// "have a conversation with the photo" flow: describe a change, apply it, stack the
// next change on top of the result, undo/redo through the history.
//
// Everything here is a pure function (no browser/node APIs, no I/O, no `Date.now()`),
// so it bundles unchanged into BOTH the React client and the Express server and is fully
// unit-testable. The server imports `validateEditInput` + `buildEditInstruction` so the
// exact same validation/prompt logic runs on both sides. This file is intentionally NOT
// `@ts-nocheck`: it is typed and covered by `designEdit.test.ts`.

// ---------------------------------------------------------------------------------------
// Limits (shared by client + server so the UI can pre-check before a round-trip).
// ---------------------------------------------------------------------------------------

// Cap the base64 image payload. A client-compressed 1200px photo is well under 1 MB of
// base64; this ceiling (~9 MB decoded) rejects oversized uploads / decompression bombs
// BEFORE they reach the model — a validation 400, never a 500.
export const MAX_IMAGE_CHARS = 12_000_000;
// The verified image-model contract accepts a small number of reference images per
// prompt; keep the yard + a couple of product/reference photos.
export const MAX_REFERENCE_IMAGES = 2;
// Instruction text is soft-capped (truncated, not rejected) to keep prompts bounded.
export const MAX_INSTRUCTION_CHARS = 2000;
// A single edit turn marks a handful of spots at most; more than this is almost certainly
// abuse or a bug.
export const MAX_REGIONS = 16;

// ---------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------

export interface EditRegion {
  id?: string;
  intent?: "add" | "remove" | "replace";
  shape?: "circle" | "rect";
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // "what goes here" — the catalog/plant label. MUST be a string when present (a
  // model-invented number/object is rejected upstream, never grounded into pricing).
  label?: string;
}

export type EditValidation =
  | { ok: true }
  | { ok: false; status: number; error: string };

// One applied edit in the conversation. `image` is the display frame (may carry the
// visible AI-Visualization badge); `composite` is the pre-badge result that MUST be fed
// back as the base of the next edit so badges never compound and drift stays bounded.
export interface EditTurn {
  id: string;
  instruction: string;
  image: string;
  composite?: string;
  regions?: EditRegion[];
  ts?: number;
}

// The full iterative-edit conversation. `original` is the untouched starting photo (the
// "before" for the slider). `turns` is the applied history; `cursor` is the current HEAD
// (-1 = sitting on the original, before any edit / fully undone).
export interface EditConversation {
  original: string | null;
  turns: EditTurn[];
  cursor: number;
}

// ---------------------------------------------------------------------------------------
// Input validation (server calls this to turn bad input into a 400, never a 500)
// ---------------------------------------------------------------------------------------

// A usable inline image is a non-empty string, either a data: URI or a raw base64 blob.
// We deliberately do NOT accept http(s)/file URLs here (an SSRF/exfil vector) — the client
// always sends inline data.
export function isImageString(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const v = s.trim();
  if (!v) return false;
  if (v.startsWith("data:image/")) return true;
  // Raw base64 (no data: prefix) — accept a plausible base64 body, reject URLs.
  if (/^https?:|^file:|^ftp:/i.test(v)) return false;
  return /^[a-z0-9+/=\s]+$/i.test(v) && v.length > 16;
}

export interface EditInputBody {
  image?: unknown;
  instruction?: unknown;
  regions?: unknown;
  referenceImages?: unknown;
}

// Validate the /api/design/edit request body. Returns a discriminated result so the
// caller can `return res.status(v.status).json({ error: v.error })`.
export function validateEditInput(body: EditInputBody | null | undefined): EditValidation {
  const b = body || {};

  if (!isImageString(b.image)) {
    return { ok: false, status: 400, error: "Missing or invalid 'image' (inline base64 photo required)." };
  }
  if ((b.image as string).length > MAX_IMAGE_CHARS) {
    return { ok: false, status: 400, error: "Image is too large — use a photo under ~9 MB." };
  }

  const hasInstruction = typeof b.instruction === "string" && (b.instruction as string).trim().length > 0;
  if (b.instruction != null && typeof b.instruction !== "string") {
    return { ok: false, status: 400, error: "'instruction' must be a string." };
  }

  let regionCount = 0;
  if (b.regions != null) {
    if (!Array.isArray(b.regions)) {
      return { ok: false, status: 400, error: "'regions' must be an array." };
    }
    if (b.regions.length > MAX_REGIONS) {
      return { ok: false, status: 400, error: `Too many regions (max ${MAX_REGIONS}).` };
    }
    for (const r of b.regions as any[]) {
      if (r == null || typeof r !== "object") {
        return { ok: false, status: 400, error: "Each region must be an object." };
      }
      // The catalog/plant label is the one field that flows toward pricing/prompts —
      // a non-string here is a 400, never coerced.
      if (r.label != null && typeof r.label !== "string") {
        return { ok: false, status: 400, error: "Region 'label' must be a string." };
      }
      if (r.intent != null && typeof r.intent !== "string") {
        return { ok: false, status: 400, error: "Region 'intent' must be a string." };
      }
    }
    regionCount = (b.regions as any[]).length;
  }

  if (!hasInstruction && regionCount === 0) {
    return { ok: false, status: 400, error: "Provide an instruction or at least one marked region." };
  }

  if (b.referenceImages != null) {
    if (!Array.isArray(b.referenceImages)) {
      return { ok: false, status: 400, error: "'referenceImages' must be an array." };
    }
    for (const ref of b.referenceImages as any[]) {
      if (!isImageString(ref)) {
        return { ok: false, status: 400, error: "Each reference image must be an inline base64 photo." };
      }
      if ((ref as string).length > MAX_IMAGE_CHARS) {
        return { ok: false, status: 400, error: "A reference image is too large — use a photo under ~9 MB." };
      }
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------------------
// Prompt building (shared so client copy + server prompt never drift)
// ---------------------------------------------------------------------------------------

// Human/spatial description of a normalized region center (0..1) — aims the edit INSIDE
// the region; the client-side feathered composite, not these words, is the hard boundary.
export function describeRegion(cx: number, cy: number): string {
  const x = clamp01(cx);
  const y = clamp01(cy);
  const col = x < 0.34 ? "left" : x > 0.66 ? "right" : "center";
  const vert = y < 0.34 ? "upper" : y > 0.66 ? "lower" : "center";
  const where =
    col === "center" && vert === "center"
      ? "the center"
      : `the ${vert}${col === "center" ? "" : "-" + col}`;
  return `in ${where} of the image (about ${Math.round(x * 100)}% from the left, ${Math.round(
    y * 100,
  )}% from the top)`;
}

export interface BuildEditOptions {
  instruction?: string | null;
  regions?: EditRegion[] | null;
  zone?: number | string | null;
}

// Assemble the full edit instruction sent to the image model. Per-region lines first,
// then the overall intent, an optional USDA-zone constraint, and finally the load-bearing
// "keep everything else EXACTLY the same" clause (the model-side soft bias; the composite
// is the real guarantee).
export function buildEditInstruction(opts: BuildEditOptions): string {
  const regions = Array.isArray(opts.regions) ? opts.regions : [];
  const instruction = typeof opts.instruction === "string" ? opts.instruction.trim() : "";

  const regionLines = regions.map((rg, i) => {
    const cx = num(rg?.cx, 0.5);
    const cy = num(rg?.cy, 0.5);
    const where = describeRegion(cx, cy);
    if (rg?.intent === "remove") {
      return `${i + 1}. Remove whatever is ${where}, and fill the space naturally with the surrounding ground and landscape.`;
    }
    const what = clip(
      (typeof rg?.label === "string" && rg.label.trim()) ||
        instruction ||
        "an appropriate landscaping element",
      160,
    );
    const verb = rg?.intent === "replace" ? "Replace what is there with" : "Place";
    return (
      `${i + 1}. ${verb} ${what} ${where}. Size it correctly for the scene's perspective; ` +
      `the base must sit on the ground (no floating), with a realistic contact shadow matching the existing sunlight.`
    );
  });

  const zoneNum = Number(opts.zone);
  const zonePhrase =
    zoneNum >= 1 && zoneNum <= 13
      ? `Only use plants that are appropriate and hardy for USDA zone ${zoneNum}. `
      : "";

  return [
    "Edit this photo of a yard with photorealistic results.",
    regionLines.join(" "),
    instruction ? `Overall change requested: ${clip(instruction, MAX_INSTRUCTION_CHARS)}.` : "",
    zonePhrase,
    "Keep everything else in the image EXACTLY the same — preserve the house, hardscape, sky, " +
      "composition, lighting, and the input aspect ratio. Add nothing else; no extra objects, people, or text.",
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------------------
// Conversation model: stack edits, undo/redo (all pure — undo/redo is just cursor math)
// ---------------------------------------------------------------------------------------

export function convInit(original?: string | null): EditConversation {
  return { original: original ?? null, turns: [], cursor: -1 };
}

// Apply a new edit turn at the current HEAD. Any redo tail (turns after the cursor) is
// discarded — the conversation branches from wherever the user currently is. The cursor
// advances to the new turn.
export function convApply(conv: EditConversation, turn: EditTurn): EditConversation {
  const kept = conv.turns.slice(0, conv.cursor + 1);
  const turns = kept.concat([turn]);
  return { original: conv.original, turns, cursor: turns.length - 1 };
}

export function convUndo(conv: EditConversation): EditConversation {
  // Cursor floors at -1 (the original, pre-edit state).
  return { ...conv, cursor: Math.max(-1, conv.cursor - 1) };
}

export function convRedo(conv: EditConversation): EditConversation {
  return { ...conv, cursor: Math.min(conv.turns.length - 1, conv.cursor + 1) };
}

export function convCanUndo(conv: EditConversation): boolean {
  return conv.cursor >= 0;
}

export function convCanRedo(conv: EditConversation): boolean {
  return conv.cursor < conv.turns.length - 1;
}

// The turn currently at HEAD, or null when sitting on the original (cursor === -1).
export function convHeadTurn(conv: EditConversation): EditTurn | null {
  if (conv.cursor < 0 || conv.cursor >= conv.turns.length) return null;
  return conv.turns[conv.cursor];
}

// The display image at HEAD (badged) — falls back to the original when no edit is applied.
export function convHeadImage(conv: EditConversation): string | null {
  const head = convHeadTurn(conv);
  return head ? head.image : conv.original;
}

// The image to feed as the BASE of the next edit: the pre-badge composite at HEAD (so
// badges never compound), falling back to the display image, then the original. This is
// the iteration invariant — the next edit builds on the current composited result.
export function convHeadBase(conv: EditConversation): string | null {
  const head = convHeadTurn(conv);
  if (head) return head.composite || head.image;
  return conv.original;
}

// The "before" for the before/after slider — always the untouched original.
export function convBefore(conv: EditConversation): string | null {
  return conv.original;
}

// The applied conversation up to HEAD (for rendering the edit timeline). Excludes any
// undone/redo-tail turns.
export function convAppliedTurns(conv: EditConversation): EditTurn[] {
  if (conv.cursor < 0) return [];
  return conv.turns.slice(0, conv.cursor + 1);
}

// ---------------------------------------------------------------------------------------
// Small internal utilities
// ---------------------------------------------------------------------------------------

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clip(s: string, max: number): string {
  const v = String(s ?? "");
  return v.length > max ? v.slice(0, max) : v;
}
