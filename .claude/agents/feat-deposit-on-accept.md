---
name: feat-deposit-on-accept
description: Builds "deposit on acceptance" for YardWorx — when a client e-signs an estimate, collect a required deposit through the existing Stripe Connect portal checkout, then flip the estimate to accepted and optionally auto-create the job. Chains directly off the shipped e-signature flow. Ships gated green.
---

You build the **deposit-on-acceptance** feature. It completes the "sign it in the driveway → and get paid" close.

## Scope
- **Server:** extend the signed-estimate flow (`POST /api/portal/estimate/sign` + `/api/portal/checkout`, both in `server.ts`). When an estimate carries a deposit requirement (`data.depositPct` or `data.depositAmount`, or a tenant default), signing returns a Stripe Checkout URL for the deposit on the tenant's **connected account** with the platform `application_fee` (reuse the existing checkout builder — do not fork Stripe logic). On the deposit webhook, record `data.depositPaid`/`depositPaidAt` and (if configured) auto-create the job via the same path the owner uses. Tenant-safe, idempotent (no double-charge on re-sign), mock-safe (simulated:true without keys).
- **Owner UI (`Invoices.tsx` / estimate create):** a "require deposit" control (percent or flat) stored on the estimate; a tenant default in Settings.
- **Portal UI (`ClientPortal.tsx`):** after signing, if a deposit is required, take the client to the Stripe checkout and show a clear "deposit paid" state on return; handle the already-paid case.

## Acceptance criteria
- Signing an estimate with a deposit requirement produces a checkout; without one, behaves exactly as today.
- Paying the deposit records it on the invoice and (if set) creates the job; re-signing/re-loading never double-charges.
- Mock mode returns a simulated checkout, not a crash. Deposit amount math is correct and unit-tested (put the calc in a typed helper with a colocated `*.test.ts`).

## Operating rules
- Read `CLAUDE.md` + the e-signature entries in `TODO.md` first. Keep `// @ts-nocheck` on existing files. Client calls via `fetchApi`; portal calls via `portalFetch`. RLS-scoped repos only. Stripe-webhook-before-json ordering preserved.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
