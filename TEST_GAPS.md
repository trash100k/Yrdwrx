# YardWorx — Test Coverage Gap Analysis

_What kinds of tests exist, and — more importantly — which test **types** have **not** been done.
Companion to `TEST_MATRIX.md` (required fuzz/edge cases) and `security_spec.md` (the RLS "Dirty
Dozen"). Last updated: 2026-07-05._

> **Honest summary:** unit coverage of **pure logic** is strong (886 tests). The gap is the harder,
> higher-value stuff — does the whole thing work **end-to-end**, **under load**, **securely over
> time**, **offline**, and **across devices**? Almost none of that is automated yet. The green gate
> (`tsc` + `vitest` + `build`) proves the pieces compile and the pure functions are correct; it does
> **not** prove the product works.

---

## ✅ What IS tested today (the baseline)

| Kind | State | Notes |
|---|---|---|
| **Unit tests (pure logic)** | Strong | 48 files / 886 tests: money math (deposit/payroll/usageLedger/recurring), csv, geocode, qboMapping, docExtract, takeoff, proposal, receptionist, notificationRules, secretCrypto, designEdit, dashboardMetrics, timeclock, securityUtils, logger, … |
| **HTTP integration (supertest)** | Partial | Only ~6 endpoints: `auth.api`, `design.api`, `publicIntake`, `quickbooks`, `smsInbound`, `recurring`. The other ~75 `/api/*` routes have **no** request→response test. |
| **Input fuzzing** | Partial | `inputFuzzing.test.ts` exists; not the full `TEST_MATRIX.md` matrix (Unicode/XSS/overflow/injection across every input). |
| **RLS coverage (static)** | Partial | `rlsCoverage.test.ts` checks policy presence; the **live cross-tenant Dirty-Dozen** ran manually as a rolled-back SQL sim (12/12) but is **not** codified as a CI gate. |
| **Route crawl (manual QA)** | One-off | Headless Chromium loaded 41/41 routes + clicked buttons (0 crashes) — a manual smoke pass, not a committed, repeatable test. |
| **Pentest** | One-off | Adversarial manual pass (SEC-1..7 found+fixed). Not an automated security regression suite. |
| **Type + build gate** | In CI | `tsc --noEmit`, `vitest run`, `npm run build` on every push. |

---

## ❌ Test TYPES not done (the gaps), prioritized

### P0 — do before real paying customers

- [ ] **End-to-end user journeys (E2E).** *None.* Cypress + Playwright are installed with **zero specs**.
  No test drives a full flow: sign up → onboard → add customer → build estimate → **e-sign → deposit →
  invoice → get paid**, or the field flow (clock-in → job → closeout → review). This is the #1 gap — it's
  the only thing that proves the product actually works, not just that the units compile.
  → *Start:* 3–5 Playwright specs for the money path + the field path against a seeded test tenant.
- [ ] **Broad HTTP integration.** ~6 of ~80 endpoints have a supertest. The money-critical ones are
  **untested at the request level**: `/api/portal/estimate/sign`, `/api/portal/checkout`,
  `/api/stripe/webhook` (the durable idempotency table!), `/api/proposals/*`, `/api/usage/*`,
  `/api/documents/parse`, `/api/notifications/dispatch`.
  → *Start:* a supertest suite per money/portal endpoint (valid + 400 + 401/403 + mock-mode).
- [ ] **Cross-tenant RLS as a CI gate.** The Dirty-Dozen is a manual SQL sim. Codify it (the exact
  rolled-back two-tenant simulation) into a test that runs against a Supabase test branch on every PR, so
  an RLS regression fails the build instead of surviving to a pentest.
- [ ] **Payment integration (Stripe test-mode / `stripe-mock`).** Only unit fixtures today. No test
  actually drives a checkout, a **webhook replay** (proving `stripe_events` blocks the double-credit),
  a deposit, a subscription, or metered-usage reporting against Stripe test mode.
- [ ] **Regression locks for the fixed P0s.** No dedicated test pins: the **CSP-includes-Supabase** fix,
  the **LiveEar mic-stop**, the **Stripe double-billing** guard, the **tenant-tier self-grant** block, the
  **profiles escalation** block. Each should have a red-if-it-regresses test.

### P1 — do before scaling past the first handful of tenants

- [ ] **Load / performance / concurrency.** *None.* The "100 concurrent customers" claim is **unverified
  under actual load.** No k6/artillery run for: request throughput, connection-pool exhaustion (Postgres),
  rate-limiter behavior under burst, cluster-worker saturation, PDF-render (Puppeteer) memory under
  concurrency, or WebSocket connection limits on `/api/live`.
  → *Start:* a k6 script hitting the read paths + a Puppeteer/PDF soak test.
- [ ] **WebSocket / Live Ear lifecycle.** *None.* No automated test of the `/api/live` bridge: auth gate,
  quota enforcement, heartbeat, abnormal-close cleanup, per-tenant metering, mic/camera teardown.
- [ ] **Offline / PWA / sync (real).** `syncService` has a unit test, but no E2E of: go offline → queue
  mutations → reconnect → flush → **conflict resolution** → workbox cache correctness.
- [ ] **Automated accessibility.** *None.* `@axe-core/react` runs in dev and the smoke pass **found**
  WCAG-AA violations, but nothing asserts them in CI. Add `jest-axe`/axe on the key screens with a
  no-new-violations gate.
- [ ] **Notification / SMS delivery.** No test against Twilio test creds / a mail sink for the
  notification dispatcher, the **receptionist** SMS, or **TCPA STOP/START** handling.
- [ ] **Migration integrity.** No test that `0001→0018` applies cleanly on a **fresh** DB, is idempotent
  (re-runnable), and yields the expected schema — nor that live-only objects (`handle_new_user` trigger)
  are captured in-repo. A "migrate from scratch → assert schema + advisors=0" CI job.
- [ ] **CI depth.** CI runs only lint/test/build. Missing: **coverage** measurement + threshold,
  **dependency/secret scanning** (`npm audit`, gitleaks), and the E2E/a11y/RLS gates above.

### P2 — maturity / long-tail

- [ ] **Visual regression.** *None.* No screenshot diffing of the Dashboard, **Design Studio** renders,
  or the generated **PDF** invoices/proposals (Puppeteer output correctness + XSS-safety).
- [ ] **Device / browser matrix.** Only headless Chromium. No Firefox/Safari/Edge, no real iOS/Android
  **Capacitor** shell testing, no responsive/touch/safe-area verification across viewports.
- [ ] **Chaos / failure-injection.** *None.* No test of behavior when Supabase is down, Gemini times out,
  Stripe is unreachable, or a worker is `SIGKILL`ed mid-request (graceful shutdown was verified manually,
  not automated).
- [ ] **Property-based + mutation testing.** *None.* No `fast-check` on the money/date/overage math (where
  edge cases hide), no mutation testing (`stryker`) to measure whether the 886 tests actually *catch* bugs.
- [ ] **Full fuzz matrix.** Execute all of `TEST_MATRIX.md` (Unicode, XSS, overflow, injection) across
  every input + endpoint, automated — today only `inputFuzzing.test.ts` covers a slice.
- [ ] **Auth flow E2E (real Supabase Auth).** Auth is bypassed in demo; no automated signup/login/session-
  refresh/logout/magic-link/portal-token-expiry/role-routing test against real Supabase Auth.
- [ ] **Third-party live round-trips.** QBO two-way (fixture-tested; live sandbox is a documented human
  step), Google Geocoding/Solar, Maps — no contract tests against the real (sandbox) APIs.
- [ ] **i18n / localization.** N/A until the bilingual (EN/ES) feature lands; add pseudo-locale + key-
  coverage tests then.

---

## Recommended build order (biggest confidence-per-hour first)

1. **Playwright E2E of the money path** (sign → deposit → invoice → pay) + the **field path** — proves the product works at all.
2. **supertest coverage of the money/portal endpoints** + **Stripe test-mode webhook-replay** test (locks the double-billing guard).
3. **Codify the Dirty-Dozen RLS sim as a CI gate** + **regression locks** for the fixed P0s.
4. **k6 load test** of read paths + **Puppeteer PDF soak** — validate the concurrency claim before you make it to a customer.
5. **jest-axe a11y gate** + **coverage + `npm audit` in CI**.
6. Then P2 depth (visual, chaos, property-based, device matrix) as the product matures.

> **Bottom line:** we've proven the *bricks* are sound (unit) and the *walls* stand (build + route
> crawl). We have **not** proven the *house* works when you live in it (E2E), holds up in a *storm*
> (load/chaos), or stays *locked over time* (automated security/RLS regression). Those are the tests
> to build next.
