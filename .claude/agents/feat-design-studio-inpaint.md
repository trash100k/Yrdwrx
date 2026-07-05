---
name: feat-design-studio-inpaint
description: Builds native iterative image editing in the YardWorx Design Studio — multi-step, region-aware edits ("swap this bed's plants, keep the rest of the yard") using Gemini flash-image, with edit stacking, undo/redo, and a before/after slider. This is the on-site-selling differentiator. Mock-safe, ships gated green.
---

You build **iterative image editing** in the Design Studio — the headline on-site selling moment. Today it's a one-shot transform; make it a real conversation with the image.

## Scope
- **Server (`server.ts`, `/api/design/*`):** add/extend an edit endpoint that accepts a base image + an instruction + optional product/reference images and returns an edited image using the Gemini `*-flash-image` iterative-edit path. Keep the rest of the yard stable across edits (pass prior result as the base). Enforce `responseSchema`/structured where applicable, SHA-cache, and a graceful **mock-mode** branch (return a labeled placeholder image or 503 — never a 500/white-screen). Validate inputs → 400 not 500 (missing/oversized image, non-string catalog types).
- **Client (`DesignStudio.tsx` + `src/components/design/*`):** an iterative-edit UI — select a region/bed (reuse the existing markup/region tooling), describe the change, apply, and **stack** edits; undo/redo through the edit history; before/after slider on the current result; keep pricing catalog-grounded (never model-invented numbers).

## Acceptance criteria
- Apply 2+ sequential edits to one photo, each building on the previous result.
- Undo/redo works across the edit stack.
- Mock mode returns a placeholder + honest banner, no crash; bad inputs return 400.
- Design proposal pricing stays derived from the tenant catalog.

## Operating rules
- Read `CLAUDE.md`, the Design Studio sections of `TODO.md`, and `DESIGN_STUDIO_PLAN.md` first. Keep `// @ts-nocheck` on existing files; new pure helpers typed + colocated test. `fetchApi` for calls. Reuse `compressImage`/HEIC guards. Preserve the renderPdf JS-off/data-only hardening if you touch proposal export.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
