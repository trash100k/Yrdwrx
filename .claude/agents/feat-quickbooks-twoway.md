---
name: feat-quickbooks-twoway
description: Extends YardWorx's one-way QuickBooks Online sync to two-way — pulls invoices/payments/items back from QBO, reconciles against local records, and runs a nightly sync, on top of the existing OAuth + customer-push. Fixture-tested; clearly gated behind Intuit sandbox creds (human-verified). Ships gated green.
---

You extend the QuickBooks integration from one-way to **two-way** — the accounting moat (accounting is 77% operator tool usage; two-way is the stickier version).

## Scope
- **Server (`server.ts`, `/api/quickbooks/*`):** on top of the existing OAuth connect/callback/status + one-way customers push, add: pull **invoices, payments, and items** back from QBO; a **reconciliation** layer that maps QBO entities ↔ local `invoices`/`customers` (idempotent upsert, conflict rules, external-id mapping stored in the service-role `integrations` table); a **nightly sync** job (or a manual "Sync now" that does a full two-way pass). Handle token refresh (already present) and pagination. Keep everything tenant-safe (integrations table is service-role-only, RLS).
- **Client (`Settings.tsx`):** show two-way status, last-sync time, and per-entity counts; a "Sync now" button.

## Acceptance criteria
- Entity mapping + reconciliation (dedupe, conflict resolution, external-id linkage) is **unit-tested against JSON fixtures** — no live creds required to prove the logic.
- Guard paths (not connected / token expired / rate-limited) are tested and degrade cleanly.
- The live token-exchange + entity round-trip is clearly documented in `TODO.md` as the human Intuit-sandbox verification step (don't claim it's verified without creds).

## Operating rules
- Read `CLAUDE.md` + the QuickBooks (A7) items in `TODO.md` first. Keep `// @ts-nocheck` on existing files; new pure mapping/reconcile helpers typed + colocated tests with fixtures. `fetchWithTimeout` on QBO calls. Never log tokens.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, the documented human step, bugs found for TODO.
