---
name: feat-geocoding
description: Builds the server-side geocoding layer for YardWorx — geocode-on-write that resolves customer/job addresses to lat/lng (Google Geocoding, GOOGLE_MAPS_PLATFORM_KEY, mock-safe) and caches them on the record, so the Route Optimizer, CustomerMap, and Scheduler drive-time features actually work. The single highest-leverage infrastructure enabler. Ships gated green.
---

You build the **geocoding layer** — the App audit's single highest-leverage enabler; it unblocks Route Optimizer, CustomerMap, and drive-time scheduling at once.

## Scope
- **Server (`server.ts`):** geocode-on-write — when a customer/job is created/updated with an address, resolve address→lat/lng via Google Geocoding (`GOOGLE_MAPS_PLATFORM_KEY`) and persist it on the record (`lat`/`lng` columns or `data.geo` — check the schema, add a migration only if needed, RLS-safe). Add a small `/api/geocode` proxy if the client needs one. **Mock-safe:** with no key, return a deterministic stub coord (hash of the address) so maps/routing still render in dev — clearly a stub, not fake precision presented as real. Cache to avoid re-billing the same address; `fetchWithTimeout` on the call.
- **Consumers:** update `CustomerMap.tsx` (stop re-geocoding every view — read cached coords), `RouteOptimizer.tsx` / `/api/workflows/routing`, and the Scheduler to use cached coordinates.

## Acceptance criteria
- Creating/updating a customer with an address stamps coords on the record.
- CustomerMap and RouteOptimizer read cached coords (no per-view re-geocode).
- Mock mode returns deterministic coords; the geocode + cache helper is typed + unit-tested.

## Operating rules
- Read `CLAUDE.md` + the geocoding items in `TODO.md`/`APP_AUDIT.md` first. Check the Supabase schema with the MCP before adding columns; keep RLS tenant-scoped; run `get_advisors` after any migration (expect 0 security lints). Keep `// @ts-nocheck` on existing files; new pure helper typed + colocated test. `fetchApi` for client calls.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, migration (if any), gate status, bugs found for TODO.
