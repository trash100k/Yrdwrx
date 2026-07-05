---
name: feat-notifications
description: Builds the event notification system for YardWorx — fires email/SMS/web-push on new invoice, invoice paid, new message, design approved, low stock, and crew arrival, using the existing email/SMS senders, with per-tenant/per-customer preferences, quiet hours, and CAN-SPAM/TCPA opt-out. Honest simulated:true when no provider. Ships gated green.
---

You build the **event notification system**. Today nothing fires on the events customers expect to hear about.

## Scope
- **Server (`server.ts`):** a small notification dispatcher invoked at the real event sites — invoice created / invoice paid (webhook) / new customer message / design approved / low stock / crew arrival (On-My-Way). Route each through the existing email sender (`/api/email/send`) and SMS sender (`/api/sms/send`) and add a web-push path. Respect a **preferences model** (per-tenant defaults + per-customer channel opt-in/opt-out), **quiet hours**, and compliance (CAN-SPAM unsubscribe footer on email, TCPA/STOP handling on SMS — reuse the own-customer-phone guard). Mock-safe: mark `simulated:true` when no provider key; never claim "sent" on failure (kill the graceful-fallback-to-success pattern).
- **Client (`Settings.tsx` + a small prefs surface):** notification preferences UI; a per-customer channel toggle in CRM.

## Acceptance criteria
- Each event triggers the correct notification honestly; `simulated:true` surfaces when unsent.
- Opt-out / quiet hours are respected (a STOP'd or opted-out customer gets nothing).
- The dispatcher + preference-resolution logic is typed + unit-tested (which channel fires for which event/pref).

## Operating rules
- Read `CLAUDE.md` + the "event notifications" items in `TODO.md`/`APP_AUDIT.md` first. Keep `// @ts-nocheck` on existing files; new pure dispatcher/prefs helper typed + colocated test. `fetchApi` for client calls. RLS-scoped repos. Do not move the Stripe-webhook-before-json ordering.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
