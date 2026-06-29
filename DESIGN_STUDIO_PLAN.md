# Design Studio — AI Object-Placement Overhaul: Engineering Spec

**Status / how to use this doc.** This is the authoritative, living engineering
spec for the Design Studio "place that specific item exactly there,
photorealistically, with the rest of the scene unchanged" feature. It merges two
research workflows (a definitive deep spec, a verified API-contract verdict, a
completeness critic, and a broad competitive plan) into one source of truth. It is
grounded in a code read of `server.ts`, `MarkupCanvas.tsx`, `DesignStudio.tsx`, and
`BeforeAfterSlider.tsx`, plus a 2026-06-29 verification of the Google image-model
contract. On any technical conflict the deep spec wins; competitor and phasing detail
is drawn from the broad plan. Every load-bearing AI fact below is tagged
**CONFIRMED / CONTESTED / UNVERIFIED** — the UNVERIFIED items gate shipping and must
be validated against a live `GEMINI_API_KEY` on Cloud Run (see §7). Keep this file
updated as phases land; it supersedes scattered notes.

---

## 1. The verified AI contract (2026-06-29)

The flagship promise cannot be delivered by the model alone. No live first-party
Google image model honors a pixel mask. The flow is therefore an **engineering
pipeline wrapped around an instruction-based model**, and a **composite** — not the
prompt, not the model, not any burned-in marker — is what guarantees the background
is unchanged.

| Fact | Status | Consequence |
|---|---|---|
| `gemini-2.5-flash-image` ("Nano Banana") edits via `generateContent`; **no `mask` / `maskImage` / `editMode` / `bbox` field**. Region is described in language only. Same maskless contract on `gemini-3.1-flash-image` / `gemini-3-pro-image`. | **CONFIRMED (HIGH)** | Region enforcement must be done by us (composite), never by the API. |
| Imagen mask-inpaint (`imagen-3.0-capability-001`) was **Vertex-only AND shut down 2026-06-24** (5 days ago). It was never on the Gemini Developer API. Migration maps it → `gemini-3.1-flash-image` (instruction-only, no mask equivalent). | **CONFIRMED (HIGH)** | **There is no first-party Google mask-inpaint path. Ignore every Imagen field name in the research.** Do not build a Vertex/Imagen fallback now. |
| The "rest of scene unchanged" guarantee = an **alpha composite** of the model's full-frame output back over the byte-identical original, through a feathered mask. Outside the feather band, original bytes are copied unchanged. | **CONFIRMED (HIGH)** | Load-bearing engineering step. Requires a compositing primitive; the prompt is soft bias only. |
| Gemini 2.5+ returns **segmentation masks** — `box_2d` (normalized 0–1000) + base64 PNG `mask` — from a text prompt on the same SDK, ~free. | **CONFIRMED (HIGH)** | Surface-snap and auto-mask come from the existing stack, no new dependency. |
| Parts ordering: **reference images FIRST → yard photo LAST → text LAST**, plus `config.imageConfig.aspectRatio = sourceAR`. Google's "last image wins" rule makes output adopt the yard's AR. | **CONFIRMED (HIGH)** | Keeps the before/after slider aligned. Update the existing handler (currently image-then-text) to this order. |
| All outputs carry an invisible **SynthID** watermark. No public dev detection API. | **CONFIRMED (HIGH)** | Provenance via stored metadata + a visible badge, not SynthID alone. Keep the AI region's encoding light. |
| Per-image cost `gemini-2.5-flash-image` ≈ **$0.039** (1290 tokens). | **CONFIRMED (HIGH)** | Budget the judge + retry loop; cap retries. |
| `responseModalities: ["IMAGE","TEXT"]` works — **the live handler already ships it** (`server.ts`). | **CONFIRMED — settled, not "to verify."** | Do not re-list as an open question. |
| Vertex caps `gemini-2.5-flash-image` at **3 images/prompt**; **Developer-API cap unconfirmed.** | **CONTESTED** | Plan `MAX_REFS=2` (yard + 2 refs) until tested (§7). |
| `gemini-2.5-flash-image` **EOL Oct 2 2026**. | **CONFIRMED (date)** | Pin the model now; define `2.5 → 3.1-flash-image` upgrade path; set a calendar reminder. |
| The "burn the region marker into a second image" placement-bias trick. | **UNVERIFIED** | Off by default; the composite enforces bounds. A/B before enabling (does it lift accuracy? does the marker ever render into output?). |

**Primary technique (the only one compatible with our stack — `GEMINI_API_KEY` +
`@google/genai`, no Vertex/service account):** instruction edit through
`generateContent` on the shared `ai` client, region enforced by composite. Request
shape:

```js
const resp = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",               // pin; EOL Oct 2 2026
  contents: [{ role: "user", parts: [
    ...referenceImageParts,                       // catalog item refs FIRST (0..MAX_REFS)
    { inlineData: { mimeType, data: ORIGINAL_OR_HEAD_BASE64 } },  // yard LAST (AR wins)
    { text: PROMPT },                             // text LAST
  ]}],
  config: { responseModalities: ["IMAGE","TEXT"], imageConfig: { aspectRatio: srcAR } },
});
// output: resp.candidates[0].content.parts[].inlineData.data (base64)
```

**Fallback ladder (no first-party mask path exists):** (1) crop-region-and-paste-back
(pure engineering — our v2 default, less drift, cheaper); (2) higher-fidelity model
`gemini-3-pro-image`, still instruction + composite (escalation on judge-fail);
(3) third-party SD-inpaint only if a true pixel-mask becomes a hard requirement;
(4) Vertex Gemini-image edit — legacy/transition only, needs an auth change AND
re-verifying surviving field names; **do not build now.**

---

## 2. The flawless process, step by step

Each step: **inputs → outputs → technique → failure handling.** The canonical
interaction "draw a circle to place a tree" runs through all of them.

**1. Capture / intake normalization.**
Inputs: raw photo (Capacitor iOS → often HEIC, EXIF-oriented). Outputs: one canonical
working image — baseline-oriented, transcoded to JPEG/PNG, longest edge **1568px**,
EXIF stripped — plus `imageMeta {naturalWidth, naturalHeight, originalSha256}`.
Technique: server-side re-encode once (apply EXIF rotation, decode HEIC→JPEG,
downscale). This single image is the canonical base for the mask, the model call, AND
the composite — all three must see identical pixels/orientation (the #1 alignment
bug). Failure: unsupported MIME → 415; oversized / decompression-bomb → reject
pre-decode; HEIC decode failure → ask user to re-upload JPEG.

**2. Region select (with surface snap) — "draw a circle to place a tree."**
Inputs: working image shown `object-contain`; user gesture (Smart Select hover-click /
drawn circle / rect / lasso). Outputs: `region {id, shape, geom 0..1, action}` + a
binary mask PNG at working-res (white=edit, black=keep). Technique: user rough-draws a
circle (stroke color is cosmetic — **nothing is burned into pixels**); fabric
`getBoundingRect` → canvas-px bbox → normalized via the contain-math fn (§4); optional
Gemini-native segmentation at `(cx,cy)` snaps to the real surface; rasterize the mask
at working-res with feather ≈ **1% of longest edge** (~16px @1568px); draw it
generously around the object **plus its cast-shadow + canopy footprint** or the
composite clips it. Failure: segmentation empty/wrong → silently fall back to the
drawn mask; stroke spilling into letterbox → clamp to [0,1]; lasso → fabric path →
SVG → mask.

**3. Pick item from grounded catalog.**
Inputs: site context (USDA zone from customer address, sun, prefs); a region needing an
item. Outputs: `region.item {catalogId, label, scientificName, refImageUrls[],
hortNotes, pricing, spacingOnCenterFt, matureHeightFt}`. Technique: per-pin dropdown
driven by the rules engine (§4.5) — zone-fit + sun-compat + not-invasive hard filters,
then ranked — binding the item to **that** region (the per-region binding that fixes
the "all pins share one item" weakness). Failure: no clean isolated reference image →
instruction-only with rich text from metadata (cluttered product shots bleed
pots/price-tags into the render); empty catalog (v1) → free-text "described item."

**4. Build clean request (no burned-in marks).**
Inputs: working image (or composited HEAD on iteration), `regions[].item`,
`globalPrompt`. Outputs: a `generateContent` request (§1 shape). Technique: send the
**clean** image + each item's reference part(s) (cap `MAX_REFS=2`) + a numbered,
per-region prompt (§5 of deep spec / templates below). Spatial language aims **inside**
the mask ("center-right, on the bed, ~72% from left, 18% up"); the mask, not the words,
defines the boundary. Sanitize/delimit user free-text + `hortNotes` (prompt-injection
guard) and cap length. Failure: >cap refs → truncate; empty description + `remove` →
empty prompt (model context-fills).

**5. Generate.**
Inputs: the request; cache key `sha256(model + normalizedPrompt + workingImgHash +
maskHash + params)`. Outputs: raw full-frame model image (base64), or cache hit.
Technique: check a Firestore/Storage-backed image cache first (the on-disk
`.gemini_cache.json` won't survive Cloud Run churn); on miss call with `AbortController`
timeout 60–90s; treat as an **async job** (return job id, push result via
WebSocket/WorkspaceOutbox) — don't block a 60s mobile fetch. v1 = full-frame-in;
v2 = crop-and-paste-back. Failure: retry only 429/5xx, exponential backoff + full
jitter, max 3–4, honor `Retry-After`; distinguish spend-429 ("capacity") from
rate-429; per-tenant image budget atop the UID-keyed `aiLimiter`; mock mode → echo the
working image unchanged.

**6. Auto-verify (VLM judge + deterministic SCENE_PRESERVED).**
Inputs: original + edited image, instruction, region, ref image. Outputs:
`verdict {PASS|RETRY|REJECT, scores, fix_hint}`. Technique — two gates: (a) a
**deterministic SCENE_PRESERVED check** — pixel-diff of the composited result vs the
original *outside the feathered mask* must be ≈0 (cheap, no VLM; catches composite bugs
for free); (b) a **VLM judge** (`gemini-2.5-pro` / `3.x-pro`) scores OBJECT_PRESENT /
CORRECT_REGION / BELIEVABLE_SCALE / PERSPECTIVE_GROUNDING / NO_HALLUCINATIONS /
REMOVAL_HONORED in forced JSON. PASS = all gates. Failure: RETRY (cap 2) folds
`fix_hint` into the prompt; persistent fail escalates `2.5-flash-image → 3-pro-image`;
exhausted → return best-effort with `needs_human_review: true` (never silently ship a
failed edit); mock judge → PASS.

**7. Mask-composite (the guarantee).**
Inputs: original working image, raw model output, feathered mask. Outputs: final
composited PNG, `compositedSha256`. Technique:
`final = original × (1 − α) + modelOutput × α`, α = feathered mask. Outside the feather
α=0 → original bytes copied byte-identical. Encode final as PNG (no JPEG recompression
of the stable region); color-managed compositing; resize model output to original W×H
only if AR matches. Failure: model returned a different AR/size → reject and regenerate
with an AR hint (never stretch); SCENE_PRESERVED diff > tolerance → composite bug, fail
loud.

**8. Iterate (multi-edit consistency).**
Inputs: current composited HEAD + new region/item. Outputs: appended `PlacementLayer`,
new HEAD. Invariant: **each new turn's input image = the previous *composited* HEAD,
never the raw model output and never the original.** This confines drift to the latest
small mask and prevents it compounding across the frame. Undo/redo = move a cursor over
stored snapshots (free, no regen). Failure: drift in a repeatedly-edited spot → replay
the stored prompt list onto a fresh base.

**9. Good / better / best + auto cost.**
Inputs: bound `regions[].item` + region areas. Outputs: 3 variations (N=3 generate);
priced line items. Technique: the **same selection object** drives both the prompt
fragment and the quantity math — `qty = ceil(area / (spacing² × 0.866))` (triangular
packing); `lineItemCents = qty × (unitPrice + installLabor)`; materials by area/volume
(mulch yd³ = area × depth / 27). The **estimate is authoritative**; the render is
captioned illustrative (the model can't count) and the prompt is constrained to the
computed count/spacing to minimize disagreement. Route through the existing
`isRestrictedRole` cost-stripping. Failure: depth/coverage not in a 2D region →
per-material default with override.

**10. Deliver.**
Inputs: final composited image + provenance record. Outputs: client-facing before/after
with badge, PDF proposal (Puppeteer), provenance doc. Technique: burn a visible
**"AI Visualization"** badge onto the delivered image (survives screenshots); full
disclaimer in ClientPortal + signed estimate; persist provenance (model+version,
prompt, sourceHash, judge verdict, tenant, timestamp, `synthid:true`) tenant-scoped in
Firestore/Storage. Failure: disclaimer needs per-jurisdiction legal review (human
blocker).

---

## 3. Architecture & data contracts

### 3.1 `POST /api/design/place-objects` request / response

```jsonc
{
  "sessionId": "design_abc",
  "headSnapshotRef": ".../L4/composited.png",   // or the original on turn 1
  "imageMeta": { "naturalWidth": 1568, "naturalHeight": 1176, "originalSha256": "..." },
  "mode": "instruction",                          // instruction (v1) | crop (v2)
  "regions": [{
    "id": "r1",
    "shape": "circle",                            // circle | rect | polygon
    "geom": { "cx": 0.72, "cy": 0.82, "r": 0.06 },// NORMALIZED 0..1
    "maskRef": ".../r1-mask.png",                 // working-res, white=edit
    "featherPx": 16,
    "action": "add",                              // add | remove | replace
    "item": {
      "catalogId": "shrub_jp_maple_6ft",
      "label": "Japanese Maple, 6 ft (#5)",
      "scientificName": ["Acer palmatum"],
      "refImageUrls": [".../acer.jpg"],
      "hortNotes": "USDA 6-9, part shade, mounding",
      "spacingOnCenterFt": 8, "matureHeightFt": { "max": 20 }
    }
  }],
  "globalPrompt": "Photorealistic, same camera angle; keep house, fence, sky, lighting unchanged",
  "region_locale": "USDA zone 6"
}
// Response:
// { layerId, compositedRef, sha256, judge: {...}, variations: [ref,ref,ref], needs_human_review }
```

The existing `/api/design/generate-mockup` is kept as an instruction-only,
whole-image fallback. The new endpoint mirrors its `aiLimiter`, extraction loop, and
mock guard.

### 3.2 Coordinate math (fabric `object-contain` → normalized → full-res)

Pure, unit-tested function (`src/lib/canvasGeometry.ts`):

```
scale   = min(elemW/natW, elemH/natH)             // contain uses the smaller ratio
dispW = natW*scale; dispH = natH*scale
offsetX = (elemW-dispW)/2; offsetY = (elemH-dispH)/2
nx = clamp((bbox.left-offsetX)/dispW, 0, 1); ny = clamp((bbox.top-offsetY)/dispH, 0, 1)
nw = clamp(bbox.width/dispW, 0, 1-nx);       nh = clamp(bbox.height/dispH, 0, 1-ny)
// circle: cx = nx+nw/2; cy = ny+nh/2; r = min(nw,nh)/2
```

Pitfalls (each a Vitest fixture): read `naturalWidth/Height` not displayed size; use
CSS client sizes not backing-store px; handle retina DPR via fabric APIs; EXIF is
already normalized at intake. Fixtures: letterbox top/bottom, left/right, DPR 2/3,
EXIF-rotated source, clamp behavior.

### 3.3 Feathered-mask composite recipe

**Phase 0 = CLIENT-SIDE composite** (zero new deps, gate-verifiable). In a
`<canvas>`: draw the original; draw the model output clipped through the mask with a
feathered edge (`ctx.filter = "blur(Npx)"` on the mask, or a radial-gradient alpha
ramp), `globalCompositeOperation` blend; outside the feather band α=0 → original pixels
survive. Read back, assert SCENE_PRESERVED (diff outside mask ≈0), export PNG.

**Recommended hardening = SERVER-SIDE `sharp`** (deep spec §4.3):

```js
async function maskComposite(originalBuf, generatedBuf, maskBuf, featherPx) {
  const { width, height } = await sharp(originalBuf).metadata();
  const gen  = await sharp(generatedBuf).resize(width, height, { fit:"fill" }).toBuffer(); // only if AR matches
  const mask = await sharp(maskBuf).toColourspace("b-w").blur(featherPx).toBuffer();       // soft α ramp
  const genA = await sharp(gen).ensureAlpha().joinChannel(mask).toBuffer();                // mask → alpha
  return sharp(originalBuf).composite([{ input: genA, blend: "over" }]).png().toBuffer();  // outside α=0 → original bytes
}
```

Mask format: 8-bit L, **same W×H as the working image** (assert in code). See §6 for
the client-vs-server decision and the Cloud Run risk.

### 3.4 Type sketches (add to `src/types.ts`)

```ts
type Kind = 'plant'|'hardscape'|'mulch'|'edging'|'structure';
type Sun  = 'full_sun'|'part_sun'|'part_shade'|'full_shade';

interface CatalogItem {
  id: string; tenantId: string; kind: Kind;
  commonName: string; botanicalName?: string; cultivar?: string;
  imageRefs: string[];                               // isolated catalog photos → ref images
  hardiness: { zoneMin: number; zoneMax: number };   // 1–13
  sun: Sun[]; water: 'low'|'moderate'|'high'; droughtTolerant?: boolean;
  native?: { isNative: boolean; regions?: string[] };
  deerRating?: 'A'|'B'|'C'|'D'; invasive?: boolean; toxicToPets?: boolean;
  mature: { heightFtMax: number; spreadFtMax: number };
  spacingOnCenterFt: number;                          // center-to-center at maturity
  unit: 'each'|'sqft'|'cuyd'|'linft';
  unitCost: number; unitPrice: number; installLaborMinutes?: number;
  sku?: string; active: boolean;                      // sku links to inventory
}

interface Region {
  id: string; shape: 'circle'|'rect'|'polygon';
  geom: { cx: number; cy: number; r?: number; w?: number; h?: number; points?: number[] }; // 0..1
  maskRef?: string; featherPx: number;
  action: 'add'|'remove'|'replace';
  item?: Pick<CatalogItem,'id'|'commonName'|'botanicalName'|'imageRefs'|'spacingOnCenterFt'|'mature'>;
}

interface PlacementLayer {                            // append-only
  id: string; sessionId: string; baseSnapshotRef: string; // = prior composited HEAD
  regions: Region[]; prompt: string; resultRef: string; sha256: string;
  judge?: { verdict: 'PASS'|'RETRY'|'REJECT'; scores: Record<string,number> };
  createdAt: number;
}

interface DesignSession {
  id: string; tenantId: string; customerId?: string;
  imageMeta: { naturalWidth: number; naturalHeight: number; originalSha256: string };
  layers: string[];                                   // ordered PlacementLayer ids (snapshots in Storage)
  cursor: number;                                     // undo/redo position
  siteContext?: { usdaZone?: string; sun?: Sun; deerPressure?: boolean };
}
```

`PlacementLayer` snapshots live in Storage (not Firestore — 1 MiB doc cap),
content-addressed by sha256. Add `designSessions` to `firestore.rules` with
`tenantId == request.auth.token.tenantId` per `security_spec.md`.

---

## 4. Implementation status & phased plan

### Already done this session (shipped)

- **Reliability guards + toasts** across Design Studio actions.
- **Image-cache bypass for IMAGE responses** — the text-only `generateContent` cache
  wrapper no longer blanks image routes (commit `e4aaa2f`).
- **Customer picker** in the studio.
- **Send-to-client email** of the design/proposal.
- **Catalog inline edit.**
- **`BeforeAfterSlider` aspect/a11y fix** — `object-contain` on both layers (no
  stretch), accessible labels.

### Phase 0 — placement engine — ✅ SHIPPED

- **Semantic `regions[]` from `MarkupCanvas`** (clean photo, not a flattened JPEG).
- **`src/lib/canvasGeometry.ts`** contain→normalized pure fns **+14 Vitest cases**.
- **`POST /api/design/place-objects`** — clean image + numbered per-region prompt;
  parts order refs→yard→text + `imageConfig.aspectRatio`; mock-mode parity.
- **CLIENT-SIDE feathered composite** — the guarantee (§3.3, §6).
- **Per-region item binding** ("what goes in each spot") + Refine/iterate-on-render.
- **Money path:** zone-aware plants, AI-viz badge, branded proposal PDF, `plantIntelligence`.

### Phase 1 — snap, verify, iterate — ✅ SHIPPED (buildable parts)

- **Gemini-native segmentation surface-snap** — `POST /api/design/segment` + the
  "Smart Snap" toggle (mock/no-box → keep drawn region).
- **VLM-judge + retry** — `POST /api/design/judge` + a bounded retry loop folding the
  judge's `fixHint` into the prompt (mock judge → PASS, never blocks).
- **Undo/redo** via `src/lib/designSession.ts` (+13 tests), iteration invariant =
  feed the **composited HEAD**. _Session-local; Storage-backed `DesignSession`
  persistence + `designSessions` firestore.rules + per-tenant image budget remain
  follow-ups (need Firestore wiring)._

### Phase 2 — grounding & economics — ✅ SHIPPED (no-key parts)

- **Catalog seed** `src/lib/plantCatalogSeed.ts` (36 zone/sun/size/spacing/priced
  entries, invasives excluded) + `selectPlants` rules engine + `resolveZone`.
- **`SuggestedPalette`** — zone → priced zone-fit palette → Apply (fills spots +
  merges deterministic line items into the estimate).
- **Delivery** — AI-viz badge + disclaimer in the proposal PDF; **provenance**
  persisted with saved visions (`buildProvenance`). _Perenual/USDA-PLANTS commercial
  catalog import remains a `[key]` follow-up; the seed covers common species now._

### Phase 3 — max realism — ◑ PARTIAL

- ✅ **Crop-and-paste-back v2** — the "Precise" toggle (`cropPlaceRender`): single-region
  crop → place → region-composite within the crop → paste back (less drift, lower cost).
- ⛔ **Depth Anything V2** (occlusion/scale priors) and **shadow/intrinsic harmonization**
  — PROVIDER-GATED (need a self-hosted depth model / GPU); not built. Documented only.

**Acceptance gates (Definition of Done):** placement accuracy (CORRECT_REGION PASS
rate), seam-invisibility pass rate, SCENE_PRESERVED diff ≈0, drift bounded over N
iterations, judge-PASS rate, p95 latency, cost/edit.

---

## 5. Decisive defaults

Chosen here, not left open (deep spec §"Decisive defaults"):

- **Compositing primitive:** `sharp` (lightest for Cloud Run) — not Puppeteer-canvas,
  not a heavy CV lib. **But Phase 0 ships the composite CLIENT-SIDE** (see §6).
- **v1 generation:** full-frame-in + composite-out. Crop-and-paste-back is v2.
- **Parts order:** references → yard → text.
- **Feather:** ≈1% of the longest edge.
- **Working resolution:** longest edge 1568px.
- **`MAX_REFS`:** 2 (yard + 2 refs) until the Developer-API cap is tested.
- **Authoritative count:** the *estimate*, not the render (the model can't count).
- **Marker trick:** OFF until A/B tested.
- **Iteration:** always feed the *composited* HEAD.

**Composite location — Phase 0 is CLIENT-SIDE.** We chose a `<canvas>` feathered
composite for Phase 0 because it adds **zero new dependencies** and is fully
**gate-verifiable** in CI (the SCENE_PRESERVED assertion runs in jsdom/Vitest without a
network or native binary). The **recommended hardening upgrade** is a SERVER-SIDE
`sharp` composite with a server-enforced SCENE_PRESERVED assertion (color-managed,
byte-stable, not bypassable by a tampered client). That upgrade is
**flagged-blocking**: it depends on `sharp` building against the correct linux binary
inside the slim/Chromium Docker image on Cloud Run — a build-pipeline change that
**needs human verification** before it can be trusted (see §7 risk #1).

---

## 6. Client-side vs server-side composite (the Phase-0 trade-off)

| | Phase 0: CLIENT-SIDE `<canvas>` | Hardening: SERVER-SIDE `sharp` |
|---|---|---|
| New deps | None | `sharp` + Dockerfile binary |
| CI-verifiable | Yes (jsdom + Vitest) | Needs in-container test |
| Tamper-resistant | No (trust client) | Yes |
| Color-management / byte-stable | Best-effort | Strong |
| Cloud Run risk | None | **Blocking — binary must build in the slim image** |

Ship client-side now to unblock the flagship loop with no infra change; promote to
server-side once the Docker `sharp` build is verified in-container (§7 #1).

---

## 7. Open risks / must-test-first

These need a **live `GEMINI_API_KEY` + Cloud Run** to validate. **The sandbox here
blocks Gemini egress, so all real-model behavior below is UNVERIFIED** — none of it can
be confirmed from inside this environment.

| # | Unverified assumption | How to validate (fast) |
|---|---|---|
| 1 | **`sharp` builds on Cloud Run** (linux binary in the slim/Chromium image) | Build the Docker image; run `maskComposite` on a real yard photo in-container. **Blocking — the server-side guarantee depends on it.** |
| 2 | **Seam is invisible** with feather on real photos | A/B feather widths on 10 real yards; SCENE_PRESERVED diff + human eyeball. **Blocking gate.** |
| 3 | **Developer-API max images/prompt** (assume 3) | One `generateContent` with yard + 3 refs; observe accept/reject. Sets `MAX_REFS`. |
| 4 | **Region-marked-image placement-bias trick** — accuracy lift vs marker artifact | A/B 20 placements with/without; measure CORRECT_REGION lift + artifact rate. Default OFF; gate inclusion on result. |
| 5 | **Gemini-native segmentation quality** on yard surfaces | Run on 15 yards; measure snap usefulness; confirm graceful fallback to the drawn mask. |
| 6 | **`gemini-2.5-flash-image` returns image inlineData** in our env (already shipping; re-confirm) + **EOL Oct 2 2026** | Live call; calendar reminder; define `2.5 → 3.1-flash-image` upgrade path. |
| 7 | **Judge reliability** (VLMs lenient on scale/perspective) | 50–100 hand-labeled edits; require ≥0.8 agreement before trusting; consider a 2-judge ensemble for client-facing. |
| 8 | **Model AR adherence** (may ignore `aspectRatio`) | Generate at several source ARs; if ignored, enforce reject+retry (never stretch). |
| 9 | **Perenual data vintage / commercial terms**; native/deer/invasive not single booleans | Confirm paid-tier commercial use + zone-data vintage before snapshot; plan USDA join + curated overlay. |
| 10 | **SynthID degradation** by composite re-encode | Keep AI-region encoding light; rely on stored provenance + visible badge, not SynthID alone. No public dev detect API — don't promise in-app verification. |

---

_Relevant files to change/add:_ `server.ts` (add `/api/design/place-objects` +
segment/judge/composite alongside `/api/design/generate-mockup`),
`src/components/MarkupCanvas.tsx`, `src/pages/DesignStudio.tsx`, `src/types.ts`,
`src/lib/canvasGeometry.ts` (+ `.test.ts`), `src/lib/repos.ts`, `firestore.rules`,
`Dockerfile` (sharp binary — hardening only), `package.json`.

_Last updated: 2026-06-29._
