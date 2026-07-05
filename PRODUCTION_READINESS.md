# YardWorx — Production-Readiness & Testing Reference

_The single "get-this-app-ready-online" list. Grounds the OWASP API Security Top 10 (2023),
OWASP ASVS, Google SRE production-readiness, and load/abuse/chaos testing methodology against
**what YardWorx actually does today** (with `file:line` evidence from three independent code
audits), answers the three stress scenarios, and tracks the fix status of each item.
Companion to `TEST_GAPS.md` (test-type gaps), `TEST_MATRIX.md` (fuzz vectors), `security_spec.md`
(RLS "Dirty Dozen"). Last updated: 2026-07-05._

> **How to read this:** each item is `P0/P1/P2` + *what to verify* + *how to test*. The three
> **Scenario** sections answer the headline questions ("1000 tenants × 1000 emails", "5000 people
> ask the same question", "attacker with Postman + F12") with the **current-state** (file:line)
> and the **fix status**. The **Fix Ledger** at the bottom is the authoritative done/open list.

---

## Threat-model framing

Assume **every client-side control is advisory**. The real perimeter is the server. Model an
authenticated attacker holding **one valid tenant token + F12 + Postman** (Scenario C). Production
**refuses to boot** unless `REQUIRE_AUTH=true` (`server.ts:1490`, boot check ~1476), so every
`if (!REQUIRE_AUTH) return next()` demo bypass is dev-only and not reachable in prod.

**Architecture reality (corrects stale `CLAUDE.md`):** the live data layer is **Supabase/Postgres
with RLS**, not Firebase. Most ordinary CRUD (customers/jobs/invoices/leads) happens **client→
Supabase directly, gated by Postgres RLS** (`supabase/migrations/0002_rls.sql`; the server says so
at `server.ts:6354`). The Express API surface is mostly **AI + billing + portal + admin**, so the
server-side IDOR surface is narrow and the true cross-tenant blast radius for bulk data is the RLS
policy set (verified 12/12 against the Dirty Dozen; a CI gate is still open).

---

## The three scenarios — current state + fix status

### (A) 1,000 tenants each blasting 1,000 emails/SMS (1M sends)
This is a **cost + deliverability + reputation + compliance** event, not just load.

**Current state (audited):**
- The metering ledger (`gateUsage`, `server.ts:1849`) caps **dollars** (durable, Supabase
  `tenant_usage`-backed) but **not rate**. Free tier hard-402s past allotment; **paid tiers only
  cap if a spend cap is set** — `effectiveSpendCap` returns `null` (unlimited) unless
  `tenants.spend_cap_cents`/`DEFAULT_SPEND_CAP_CENTS` is configured.
- Shared sender identity — one Resend from-address (`server.ts:7955`) and one Twilio number for the
  whole platform → one bad tenant tanks shared deliverability / A2P standing for all.

**FIXED (commit `ea10539`):** a **per-tenant outbound rate limit** (`src/lib/outboundLimiter.ts`,
memory-safe fixed-window, per-minute + per-day) now gates `/api/email/send`, `/api/sms/send`, and
`/api/notifications/dispatch` → **429 + Retry-After** once a tenant exceeds its cap. Bounds the
blast regardless of recipient. Env-tunable (`OUTBOUND_PER_MINUTE`=60, `OUTBOUND_PER_DAY`=5000).
Locked by 9 unit + 3 end-to-end tests.

**Still open (P1/P2):** `DEFAULT_SPEND_CAP_CENTS` for paid-tier bill-shock ceiling; per-tenant
**sender isolation** (dedicated Resend subdomain / Twilio subaccount per tenant); a real **queue
with controlled drain** (the throttle is the guard in front of it); route `dispatchNotification`
SMS/email through the spend meter (a metering bypass exists at `server.ts:8087`); CAN-SPAM/TCPA
send-time enforcement (§10).
**How to test:** k6/Artillery across N simulated tenants → assert per-tenant 429, flat egress,
suppressed/unsubscribed recipients dropped; soak for queue-memory growth.

### (B) 5,000 users asking the same AI question at once
The **cache-stampede / thundering-herd + denial-of-wallet** case.

**Current state (audited):** `generateContent` had a SHA-256 response cache (`server.ts:~717`)
bounded at `GEMINI_CACHE_MAX`, but **no request coalescing** — 5,000 identical prompts arriving
before the first write all **MISS a cold key → 5,000 paid model calls** (full stampede). The
per-user `aiLimiter` (100/day) is per-worker; the durable cost cap (`gateUsage("ai")`) **fails
open** on Supabase error; there was **no global concurrency cap**.

**FIXED (commit `c9df08f`):** **single-flight coalescing** (`src/lib/singleFlight.ts`) — concurrent
identical in-flight prompts now collapse to **one** upstream call; everyone else drains from the
warm cache (5,000 → 1). Self-cleaning on settle (bounded memory), observable via
`getGeminiCoalescedHits()`. 6 unit tests including the 5,000-caller collapse.

**Also FIXED (commit (this commit)):** a **global concurrency semaphore** (`src/lib/semaphore.ts`)
now bounds concurrent upstream `generateContent` calls (distinct-prompt flood), load-shedding past
the cap with a clean 503 `AI_BUSY` instead of unbounded fan-out. Coalescing dedupes *identical*
prompts; the semaphore bounds *distinct* ones. 6 unit tests.

**Still open (P1):** make the durable AI cost cap **fail closed**; map Gemini 429 → client
**429 + Retry-After** instead of 500; durable/fleet-wide AI counters.
**How to test:** k6 spike of 5,000 concurrent identical prompts (mock mode + a rate-limited real
key) → assert **exactly one** upstream call (log coalesced count), p95 bounded, overflow 429, token
budget halts runaway spend. Repeat with a cold key to prove the stampede is coalesced.

### (C) Attacker with a valid tenant token + Postman + F12
The core API-hardening threat model — client controls are advisory; the server is the perimeter.

**Current state (audited — two independent sweeps agree):**
- **BOLA/IDOR:** 17 sampled endpoints enforce ownership (all `/api/portal/*` via `verifyPortalToken`
  + `customer_id` checks; `/api/sms/send`, `/api/notifications/dispatch`, `/api/proposals/send`,
  `/api/stripe/recurring/checkout`, `/api/team/*`, `/api/admin/*` via `requirePlatformAdmin`,
  `/api/usage/spend-cap`, `/api/tenants/provision`, `/api/geocode/backfill`) — **SAFE**. **One
  confirmed cross-tenant BOLA:** `/api/stripe/checkout` read the invoice by body `invoiceId` with
  no caller-tenant check → foreign-invoice amount disclosure + could flip another tenant's invoice
  to paid via the webhook.
- **Mass assignment (BOPLA):** **none** — grep for `.insert({...req.body})`/`.update(req.body)` →
  zero matches; every write whitelists fields; `tier` is force-set to `free`, `is_platform_admin`
  derives from `PLATFORM_OWNER_EMAIL`, not the body.
- **Per-UID rate limiting:** only `aiLimiter` is per-UID; `globalLimiter`/`strictLimiter` key on IP
  (proxy-shared behind Cloud Run, per-worker, IP-rotatable). Non-AI writes have no per-UID cap.
- **CORS:** no CORS middleware — the API emits no `Access-Control-Allow-Origin`, so browsers block
  cross-origin by default (safe), **but irrelevant to Postman/curl** which ignore CORS.

**FIXED (commit `c9df08f`):** the `/api/stripe/checkout` BOLA — now derives the caller's tenant from
the verified token (`resolveTenant`) and **403s a mismatch**. Locked by a hermetic supertest suite
(403 foreign / 400 owner / 404 ghost / 401 no-token).

**Still open (P1/P2):** per-UID/per-tenant rate limits on non-AI writes (esp. `/api/team/invite`
email fan-out, `/api/notifications/dispatch`) + a **shared (Redis) limiter store** for fleet-wide
caps; a dedicated **RLS-policy review** (the true blast radius for the anon-key+token attacker is
PostgREST, not `server.ts`); `/api/public/lead-intake` spam hardening.
**How to test:** a Postman/Newman collection holding one tenant-A token attempts every attack
(BOLA on tenant-B ids, BFLA on admin routes, mass-assignment shadow fields, SSRF URLs) — all must
fail closed. Automate a route-inventory test so any new endpoint that forgets authz fails CI.

### (D) Dependency down / timeout (resilience)
**Current state (audited):**
- **Gemini:** 60s SDK timeout (`server.ts:226-237`); failures → honest 500/503 (`handleAiError`
  `:99-107`); mock mode only on a *missing key*, never fabricates data on a real error. **Good.**
- **Stripe:** checkout fails closed (500); webhook returns 500 so **Stripe retries** on
  store-unreachable/apply-throw; bad signature → 400. **Good.**
- **Supabase:** **had no client-level timeout** — the hot `auth.getUser` + every `sb.from()` could
  hang on a *slow* Supabase and pin an Express worker under Cloud Run concurrency 80. Auth already
  fails **closed** (401 prod / 503 unconfigured); a 45s success cache softens blips.
- **No app-side Postgres pool** (all Supabase REST/HTTP) → no `max_connections` exhaustion risk.
- **WS `/api/live`:** per-worker `LIVE_CAP=50`, **no `maxPayload`** (100 MiB default), auth after
  upgrade (fails closed), but the pre-auth `getUser` is un-throttled → Supabase auth-call
  amplification under a bogus-token flood; no per-IP/per-tenant connection cap.
- **No circuit breaker / no backoff**; process guards log-only (no crash), cluster respawns workers;
  graceful shutdown present.

**FIXED (commit `c9df08f`):** **client-level Supabase timeout** — an 8s `AbortSignal` fetch wrapper
(`SUPABASE_TIMEOUT_MS`) is now `global.fetch` on both the auth and service clients, so a slow
Supabase can no longer pin workers; timeouts fail closed.

**Still open (P2):** WS `maxPayload` + per-IP/per-tenant connection cap + pre-upgrade throttle;
circuit breaker + backoff-with-jitter on external deps.
**How to test:** chaos — block/slow each upstream (mock 503 / inject latency) and assert typed
error + degraded response, no worker pin; SIGTERM under load → in-flight drains.

---

## The categorized checklist (P0/P1/P2 · verify · how-to-test)

Condensed from the OWASP-grounded research pass. Items already fixed are marked ✅ with the commit.

### 1. Functional / Unit
- **P0** Money math exact (integer cents, no float drift) — Vitest tables + fast-check property tests. ✅ (`moneyProperties.test.ts`, deposit `+Infinity` guard fixed)
- **P0** `parseGeminiJson()` survives fenced/malformed/truncated output — unit fuzz. ✅
- **P0** Mock-mode AI deterministic per route (no `GEMINI_API_KEY`) — `npm run test` key-unset. ✅
- **P0** Validators reject over-length / null-byte / Unicode-abuse — `TEST_MATRIX.md` vectors. ✅ partial (`fuzzMatrix`, `inputFuzzing`)
- **P1** Role/permission matrix; date/TZ/DST logic; CSV/geocode utils — parametrized unit. ✅ partial

### 2. Integration / Contract
- **P0** Every `/api/*` enforces auth except the documented exceptions — **route-inventory test** hitting each handler token-less. ✅ (`routeAuth.test.ts` static; live enumeration OPEN)
- **P0** Stripe webhook before `express.json()`, verifies raw-body signature — signed+tampered posts. ✅ (`stripe.webhook.api.test.ts`, idempotency-replay)
- **P0** Tenant isolation at the data layer (Dirty Dozen) — two-tenant contract test. ⚠️ manual SQL sim 12/12; **CI gate OPEN**
- **P1** Gemini cache identical-input/TTL; third-party adapters handle upstream 4xx/5xx/timeout; idempotent mutations. ✅ partial

### 3. End-to-End
- **P1** Money path browser→DB (estimate→e-sign→deposit→invoice→paid) + field path — Playwright/Cypress on a seeded tenant. ⚠️ **OPEN** (smoke E2E exists; full money round-trip needs a test DB)
- **P1** Role-portal routing against *restored* real auth; public routes render; offline queue drains once; PDF render valid. ⚠️ partial

### 4. Load / Performance / Soak
- **P0** Cache-stampede coalescing on hot AI keys — k6 synchronized-expiry → 1 upstream. ✅ (single-flight)
- **P1** Baseline capacity / spike / soak / stress (autoscale + load-shed 429 not 500) — k6 profiles. ⚠️ harness exists (`tests/load/concurrency.mjs`); full k6 OPEN
- **P1** Puppeteer render concurrency cap (no OOM) — burst on render route. ✅ (`PDF_MAX_CONCURRENT`, semaphore)

### 5. Abuse / Rate-limit / Quota / Cost-control
- **P0** Global/AI/strict limiters fire (429 + Retry-After); limiter key server-derived not spoofable. ✅ partial (per-worker; shared store OPEN)
- **P0** AI cost ceiling **token-based + per-tenant** (tokens/min, tokens/day, concurrency) — large-context prompts. ⚠️ request-count + credit cap exist; token-based OPEN
- **P0** Bulk email/SMS per-tenant rate + quota + quiet-hours — per-tenant load. ✅ rate (`ea10539`); quiet-hours/quota OPEN
- **P0** Hard spend cap / kill-switch on Gemini/Twilio/Stripe (denial-of-wallet) — abusive loop trips a $ ceiling. ⚠️ **OPEN** (`DEFAULT_SPEND_CAP_CENTS`)
- **P1** Quota keys off server-stored tier not client-claimed; pagination/result-size caps. ✅ tier; page-caps partial

### 6. Security / API-hardening (OWASP API Top 10 2023 + ASVS L2)
- **P0** API1 BOLA/IDOR — every `/:id` verifies ownership. ✅ (`/api/stripe/checkout` fixed `c9df08f`; 17 others SAFE)
- **P0** API2 Broken Auth — tokens verified server-side, expiry enforced, portal-JWT/OAuth-state/webhook-sig unforgeable; mock-admin bypass off in prod. ✅
- **P0** API3 Mass Assignment — server whitelists writable fields. ✅ (zero raw-body sinks)
- **P0** API5 BFLA — function-level authz (low-priv token can't call admin routes). ✅ (`requirePlatformAdmin`)
- **P0** API7 SSRF — Puppeteer/URL-fetch/image-import blocked from metadata/internal/`file://`/DNS-rebind. ✅ (`fetchSafeExternal` + `pinnedPublicLookup`, `server.ts:252-290`)
- **P0** API8 Misconfig — Helmet CSP/HSTS present; no verbose stack traces; generic 500 body. ✅
- **P0** Injection — SQL/prompt/XSS/CSV-formula neutralized (parameterized; CSV escapes `= + - @`). ✅ partial
- **P0** Secrets — no keys in bundle/history/logs; QBO tokens encrypted at rest. ✅ (`secretCrypto.ts`; `gh run_secret_scanning` in CI OPEN)
- **P1** API4/API6 resource + business-flow throttle; per-UID limits on non-AI writes. ⚠️ **OPEN** (shared store + per-UID)
- **P1** API10 unsafe consumption — validate/sanitize Gemini/Twilio/QBO output before render. ✅ partial

### 7. Resilience / Chaos
- **P1** Timeouts on **every** outbound call. ✅ Supabase (`c9df08f`), Gemini, Stripe, `fetchWithTimeout`; **circuit breaker + backoff-with-jitter OPEN**
- **P0** Idempotency on money + messaging (retried charge/invoice executes once). ✅ (`stripe_events` durable table)
- **P1** Graceful shutdown / SIGTERM drain; worker-crash isolation. ✅
- **P2** Dependency-outage degradation; connection-pool/poison-message handling. ⚠️ partial

### 8. Data Integrity
- **P0** Tenant scoping server-derived (never client `tenantId`); server-authoritative timestamps. ✅
- **P0** Financial invariants (total = Σ line items ± tax/deposit; no negative; payments ≤ balance). ✅ (property tests)
- **P1** Migrations reversible & tested; RLS ships with its schema; CSV upsert-not-duplicate; concurrent-write safety. ⚠️ partial

### 9. Observability
- **P1** Golden signals per route (structured logs to stdout, request/trace/tenant id, redacted). ✅ (`logger.ts`, `/healthz`, `/readyz`)
- **P0** Per-tenant cost/usage telemetry, alertable (feeds §5 caps); `TELEMETRY_EXPORT_KEY` guard. ✅ ledger; alerting OPEN
- **P2** Distributed tracing (OpenTelemetry); bounded threat-log. ⚠️ threat-log bounded; tracing OPEN

### 10. Compliance
- **P0** SMS/TCPA + A2P 10DLC (brand+campaign registered; consent stored; STOP immediate; quiet hours; no SHAFT). ⚠️ STOP/inbound handled; registration + quiet-hours enforcement OPEN
- **P0** Email/CAN-SPAM (working unsubscribe ≤10 days; physical address; accurate headers; suppression checked per-send). ⚠️ **OPEN**
- **P0** PCI via Stripe (card data never touches the server; Elements/Checkout only; SAQ-A). ✅
- **P1** Email deliverability (SPF/DKIM/DMARC; warmed domain; bounce/complaint suppression; per-tenant reputation isolation). ⚠️ **OPEN**
- **P1** Privacy — export/delete per tenant/customer; public `/privacy` `/terms` `/data-map` `/ai-usage` accurate; AI + voice consent. ✅ pages; export/delete flow partial

---

## Fix Ledger (authoritative done/open)

### ✅ Done this pass
| Fix | OWASP / Scenario | Commit | Test lock |
|-----|------------------|--------|-----------|
| `/api/stripe/checkout` cross-tenant BOLA | API1 / C | `c9df08f` | `tests/stripe.checkout.bola.api.test.ts` |
| AI single-flight / request coalescing | §4.5 / B | `c9df08f` | `src/lib/singleFlight.test.ts` (6) |
| Supabase client-level timeout | §7 / D | `c9df08f` | (bundle + boot; behavioral) |
| Per-tenant outbound rate limit (email/SMS/notify) | §5 / A | `ea10539` | `outboundLimiter.test.ts` (9) + `outbound.limit.api.test.ts` (3) |
| Gemini global concurrency semaphore (distinct-prompt flood → 503) | §4/§5 / B | (this commit) | `src/lib/semaphore.test.ts` (6) |

### ⬜ Open — prioritized backlog (mirrored into `TODO.md`)
**P0/P1 (before scale):**
1. `DEFAULT_SPEND_CAP_CENTS` — paid-tier bill-shock ceiling / denial-of-wallet kill-switch.
2. Gemini **fail-closed cost cap** (currently fails open on Supabase error) + Gemini-429 → client-429/Retry-After. _(global concurrency semaphore: DONE.)_
3. **Shared (Redis) limiter store** + **per-UID/per-tenant limits on non-AI writes** (team/invite, notifications/dispatch, stripe/*, portal/*).
4. Route `dispatchNotification` sends through the spend meter (close the metering bypass); fix SMS-meter TOCTOU (atomic increment via Postgres RPC).
5. **Dirty-Dozen RLS as a CI gate**; live route-inventory auth test; coverage + `npm audit`/secret-scan in CI.
6. Full **money-path E2E** round-trip against a seeded test DB; **k6** spike/soak load run.

**P2 (hardening/maturity):**
7. WS `/api/live`: `maxPayload` + per-IP/per-tenant connection cap + pre-upgrade throttle.
8. Per-tenant **sender isolation** (Resend subdomain / Twilio subaccount) + outbound **queue with controlled drain**.
9. **Circuit breaker + backoff-with-jitter** on external deps.
10. **CAN-SPAM/TCPA** send-time enforcement (suppression list, unsubscribe, quiet hours, A2P registration) + SPF/DKIM/DMARC + bounce/complaint suppression.
11. Dedicated **RLS-policy review** (PostgREST is the real anon-key+token blast radius).
12. Visual regression, chaos/failure-injection, device/browser matrix (see `TEST_GAPS.md`).

---

## Sources
OWASP API Security Top 10 (2023); OWASP ASVS 4.0.3 (V2/V5/V6/V7); Google SRE Production Readiness
Review + 12-Factor; Grafana k6 spike/soak/stampede + cache-stampede/thundering-herd patterns;
Stripe idempotency + retry backoff-with-jitter; LLM token-based rate limiting / denial-of-wallet;
TCPA / A2P 10DLC / CAN-SPAM. Internal: `CLAUDE.md`, `security_spec.md`, `TEST_MATRIX.md`,
`TEST_GAPS.md`, and the three code audits (abuse/scale, IDOR/BOLA sweep, resilience) that produced
the `file:line` evidence above.
