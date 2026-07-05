---
name: feat-aerial-takeoff
description: Builds aerial/satellite property takeoff for YardWorx — a provider-pluggable measurement adapter (Nearmap/Regrid/Google Solar) behind the existing /api/property/measure hook, returning lawn/bed/hardscape square footage with a source + confidence, and feeding the instant-estimate flow. Degrades honestly to AI/manual when no provider key. Ships gated green.
---

You build **aerial/satellite property takeoff** — neutralizes the incumbents' remote-measurement advantage.

## Scope
- **Server (`server.ts`, the existing `/api/property/measure` / measure scaffold):** define a clean provider-adapter interface and wire at least one real adapter (Google Solar API building/roof + lot, or Regrid parcel, keyed by env) — implement the request/response mapping fully even if the live key is human-supplied later. Return structured `{ lawnSqft, bedSqft, hardscapeSqft, lotSqft, source, confidence }`. **No fabricated precision:** with no provider key, return a clearly-labeled estimated/manual result (AI-grounded guess or a "measure manually" path), never fake exactness. Cache by address (reuse the geocoding coords if present).
- **Client (`EstimateStudio.tsx` / instant-estimate + Design Studio):** consume the measurement to prefill quantities (sqft → mulch yards, sod, etc.); show the source + confidence honestly; let the user override.

## Acceptance criteria
- With no key: returns a labeled estimate/manual result, clearly not provider-measured.
- With a (mocked) adapter: returns provider sqft with source+confidence; mapping is unit-tested against a fixture.
- Instant estimate prefills quantities from the measurement; the unit-math helper is typed + tested.

## Operating rules
- Read `CLAUDE.md` + the property-measurement items in `TODO.md`/`APP_AUDIT.md` first. Keep `// @ts-nocheck` on existing files; new pure adapter/math typed + colocated test. `fetchApi` for calls. `validateSafeUrl`/`fetchWithTimeout` on any outbound provider call. Document the human "add provider key" step in `.env.example` + TODO.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
