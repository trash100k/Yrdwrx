# YardWorx — Ship-Ready Launch Checklist

The single, comprehensive roadmap to take YardWorx from "feature-rich demo" to a **multi-tenant
SaaS sold to multiple landscaping companies** on Google Cloud Run + Firebase + Gemini.

Grounded in real investigation of this codebase (a live Design Studio pentest, a deploy-readiness
sweep, and full inventories of **75 API endpoints**, **23 pages + ~80 components**, and the
multi-tenant data model). Every task names the file/endpoint it touches so work **reuses what
already exists** — see the [appendices](#appendix-a--feature-inventory) for the full maps.

> **This is a living document** — the standing backlog of record. Any agent or human picking up
> work should: (1) read it first, (2) check items off as they land and add newly-discovered work
> in the right Part, (3) keep file/line refs accurate, (4) bump `_Last updated_`. It's linked from
> `CLAUDE.md` so it's discoverable. **Don't start a parallel list.**
>
> _Last updated: 2026-06-27 — expanded into the full ship-ready launch checklist (multi-tenant,
> billing, security/endpoint-gating, Design Studio grounding, tests, market-fit) from four
> investigations incl. a live pentest._

## How to use this file

- **Launch model:** lean **MVP to first paying client (Part A)**, then **fast-follow (Part B)**,
  then **scale/hardening (Part C)**. **Part A is the gate** — nothing ships until it's done.
- **Audience:** broad, **tier-gated** (free / pro / enterprise). Build features once, gate by tier.
- **Billing:** **both** — landscapers pay YardWorx a subscription *and* use Stripe Connect to bill
  their own customers.
- Priority legend: 🔴 **blocker** (can't launch) · 🟠 **risky** (breaks/degrades in real prod or at
  scale) · 🟢 **feature/polish** (value-add & de-uglify).

---

## Launch-readiness snapshot

| Area | Status | ~Ready | Headline gap |
|------|:------:|:------:|--------------|
| Build / deploy | 🔴 | 0% | `npm run build` never bundles `server.ts` → `dist/server.cjs`; Cloud Run crash-loops |
| Auth | 🔴 | 0% | **Every `/api/*` route is unauthenticated** (proven live — mount-path bug) |
| Multi-tenancy | 🔴 | ~10% | Rules are solid, but client hardcodes `demo-tenant-1`; onboarding collides all clients on `genesis-1` |
| Billing | 🟠 | ~40% | Stripe Connect + checkout wired; no tier/quota enforcement; webhook not tenant-safe |
| Design Studio | 🔴 | ~30% | Crashes in mock mode; mockup 500s; pricing AI-invented, not catalog-grounded |
| Live Ear (flagship) | 🟢 | ~60% | Streaming works; Live tools are stubs; no vision builder yet |
| Security / firewalls | 🟠 | ~60% | Helmet + limiters + SSRF guard present, but 6 open `/api/playground/*`, open threat log, `frameAncestors:['*']` |
| Core features | 🟢 | ~75% | CRM/Scheduler/Inventory/Invoices/Compliance real; Contracts/RouteOptimizer/Agent partial |
| Tests | 🔴 | ~5% | 2 trivial tests; "Dirty Dozen" + `TEST_MATRIX.md` unimplemented; no CI |
| Docs / README | 🔴 | ~5% | README is 5-line AI-Studio boilerplate vs a ~75%-complete product |

---

## Part A — MVP launch blockers 🔴
*Everything here must land before the first paying client.*

### A1 — Build & deploy (get it running on Cloud Run)
> Today `cloudbuild.yaml` builds & deploys, then the container crash-loops: `npm start` runs
> `node dist/server.cjs`, but `npm run build` only builds the frontend.

- [ ] **Bundle the server.** `esbuild server.ts → dist/server.cjs` (esbuild is in devDeps, never
  invoked). Add `"build:server": "esbuild server.ts --bundle --platform=node --format=cjs --outfile=dist/server.cjs --external:puppeteer --external:firebase-admin"`; wire `"build": "vite build && npm run build:server"`. Verify `Dockerfile:19,46`. Refs: `package.json:8-9`.
- [ ] **Complete the Firebase client config.** `src/lib/firebase.ts:14` has only `projectId` → Auth
  can't init. Add `apiKey`/`authDomain`/`storageBucket`/`messagingSenderId`/`appId` via
  `import.meta.env.VITE_FIREBASE_*` (mirror in `vite.config.ts`). No hardcoded secrets.
- [ ] **`.env.example` + startup validation.** Document every required var (see
  [Appendix C](#appendix-c--secrets--env-vars)); warn loudly in `server.ts` on missing critical vars.
- [ ] **Real `JWT_SECRET`.** Remove the hardcoded dev fallback (`server.ts:3333`); require the env var in prod.
- [ ] **Cloud Run IAM.** `firebase-admin` uses ADC + `projectId` only (`server.ts:435-444`); the
  service account needs Firestore + Auth Admin roles or token verification/DB writes fail silently.
- [ ] **Fix the ephemeral cache.** `.gemini_cache.json` writes to `process.cwd()` (`server.ts:210-228`)
  — move to `/tmp` or gate behind a flag (Cloud Run FS is ephemeral/RO).
- [ ] **Container smoke test.** `npm ci` → `npm run build` → build image → run → `/` serves SPA and an `/api/*` route responds.

### A2 — Auth + real multi-tenant isolation
> The biggest risk. The server-side fix is ~1 line; the client side couples to onboarding/tenant.

- [ ] **🔴 Fix the global auth bypass.** `app.use("/api/", verifyFirebaseToken)` (`server.ts:454`)
  checks the **mount-stripped** `req.path` (`/design/process`), so `!req.path.startsWith('/api/')`
  is always true → token never checked. _Proven: no-token & garbage-token → `200`._ Fix: branch on
  `req.originalUrl` (or invert to default-deny + an excluded-routes allowlist).
- [ ] **Restore real auth.** Re-enable `onAuthStateChanged` in `src/App.tsx:101-124` (mock admin
  injected today); keep a clearly-flagged demo toggle, not the default.
- [ ] **Make `useRole` real.** `src/hooks/useRole.ts:4-8` hard-returns `owner`/`hasPermission:()=>true`
  — read role from the Firebase user + Firestore `users` doc.
- [ ] **Make `TenantContext` real.** `src/contexts/TenantContext.tsx:64-91` hardcodes `demo-tenant-1`
  / tier `enterprise` — resolve the real tenant + tier from Firestore per authed user; support `switchTenant`.
- [ ] **Fix new-client provisioning.** `src/components/Onboarding.tsx:132` writes every company to
  `genesis-1` → tenants collide. Mint a **unique tenantId**, create the `tenants/{id}` doc, and seed
  against it (`src/lib/seedDatabase.ts` — make the empty-check tenant-scoped).
- [ ] **Verify isolation.** Re-check `firestore.rules` against `security_spec.md` "Dirty Dozen";
  confirm the `demo-tenant-1` anonymous safe-hatch (`firestore.rules:40-44`) is gated for prod.
- [ ] **De-hardcode the SaaS-admin gate.** `src/components/auth/SaaSOwnerGate.tsx` embeds an owner
  email in source — move to a Firebase custom claim.

### A3 — Endpoint gating & firewalls
> Hardening is partly present (Helmet, limiters, SSRF guard on the one user-URL route). These are
> the holes that matter for a public, multi-tenant deployment.

- [ ] **Gate the 6 unauthenticated `/api/playground/*` routes** (`server.ts:3180-3270`). They bypass
  auth (excluded list + `/api/playground/*`) and call **real, non-mocked** Gemini chat/image/video/
  music models → open AI-cost abuse. Require auth+tier, or remove for prod.
- [ ] **Admin-only the threat log.** `GET /api/security/threats` (`server.ts:370`) returns the log to
  any caller — restrict to owner/admin.
- [ ] **Derive `role` from the token, not the body.** `/api/design/*` (and any route gating financial
  visibility) trusts `req.body.role` (`server.ts:2232`) → privilege escalation. Use `req.user`.
- [ ] **Tenant-scope the AI cache key.** `.gemini_cache.json` and `cacheApiResponse` key on content
  only → cross-tenant cache sharing (PII risk). Include `tenantId`.
- [ ] **Tighten CSP.** `frameAncestors: ['*']` (`server.ts:517`) allows clickjacking — restrict to self/your domains.
- [ ] **Sanitize prompt-injection inputs.** Delimit user text (`prompt`, `customInstallRules`,
  `designCatalog` names) and instruct the model to treat it as data; don't rely on prose "air gap".
- [ ] **Harden secondary guards.** Rotate/strengthen the `TELEMETRY_EXPORT_KEY` single-header check
  (`server.ts:1961`); fix `aiLimiter` `ERR_ERL_KEY_GEN_IPV6` (use the `ipKeyGenerator` helper, `server.ts:473`).

### A4 — Design Studio: working, reliable & grounded in their data
> **Huge priority.** From a live pentest. Goal: cohesive, repeatable designs with **trustworthy
> pricing derived from the tenant's own catalog + live inventory**, not AI-invented numbers.

- [ ] **Stop the mock-mode white-screen.** `/api/design/process` & `/tiers` return `{}` in mock mode
  (prompt falls through to the generic `{}` branch `server.ts:202-204`); the UI then maps
  `result.identifiedAreas` (`DesignStudio.tsx:579`) / `result.tiers[activeTier]` (`:736`) on
  `undefined`. Add a realistic design mock branch in `getMockText` **and** guard the render.
- [ ] **Fix the mockup / "Reveal Slider."** `/api/design/generate-mockup` → `500` (`ai.interactions.create`,
  `server.ts:2343`, is unmocked + experimental API + speculative `gemini-3.1-flash-image`). Validate
  the real API against a live key or switch to a supported image path; add a dev placeholder fallback.
- [ ] **Validate inputs (400 not 500).** Missing `image` → `500 "...reading 'includes'"`
  (`server.ts:2317,2339`); `designCatalog[].type.toUpperCase()` crashes on non-string. Return 400s.
- [ ] **Ground the design in tenant data.** Feed `serviceCatalog` (pricing, `src/lib/constants.ts:1-54`
  / `TenantContext`), the tenant `design_catalog` (approved plants/materials, `DesignDatabasePanel.tsx`),
  and the **live `inventory` collection** into `/api/design/process`. **Compute line-item prices from
  the catalog**, not from the model. This is the core of "cohesive, reliable designs."
- [ ] **Enforce the financial air-gap server-side.** Employee/foreman must not receive costs — gate by
  token role, not the prose guardrail / client checks (`DesignStudio.tsx:754,617`).
- [ ] **Cleanup:** unbounded non-tenant cache eviction (`server.ts:254-299`); governance-scanner false
  positives on legit design text (`../`,`1=1`,`.env` → 403, `server.ts:375-422`); dead `markup` param +
  non-existent `data.estimatedCost` (`DesignStudio.tsx:237`).

### A5 — Billing (subscription + Connect), made tenant-safe
- [ ] **Enforce subscription tiers.** Sync tier from the Firestore `tenants` doc; make
  `SubscriptionGuard.tsx` gate by real tier. Add an **AI-quota middleware** that decrements
  `tenant.quotas` per AI call and returns 429 when exhausted (free/pro/enterprise limits). Today
  nothing decrements (`TenantContext` quotas unused).
- [ ] **Tenant-safe Stripe Connect.** `/api/stripe/connect` (`server.ts:1198`) trusts `req.body.tenantId`
  — verify `req.user` owns the tenant. Add `tenantId` to checkout metadata (`/api/stripe/checkout`).
- [ ] **Tenant-safe webhook.** `/api/stripe/webhook` (`server.ts:307`) updates invoices without
  confirming tenant ownership — validate before mutating. (Signature verification is already correct.)

### A6 — Minimum tests + docs
- [ ] **Security tests.** Implement the `security_spec.md` "Dirty Dozen" against `firestore.rules`
  (emulator) + a **cross-tenant isolation** test (Tenant A cannot read/write Tenant B).
- [ ] **Smoke tests.** A Design-Studio happy-path test and an auth-enforcement test (no token → 401).
- [ ] **CI.** A GitHub Actions workflow running `npm run lint` (`tsc --noEmit`) + `npm run test` on PRs
  (none exists today).
- [ ] **Rewrite the README.** Replace the boilerplate with real features, architecture, env vars, the
  role matrix, and deploy steps (see [Appendix A](#appendix-a--feature-inventory)).

---

## Part A★ — Flagship: Live Ear live design vision 🟢
*The market differentiator — land it right after the core MVP (A1–A6) is stable. Live Ear already
streams mic + camera to `/api/live` → `ai.live.connect`; this extends it (not a rewrite).*

- [ ] **Make Live Ear dev-safe.** `ai.live.connect` (`server.ts:3369`) isn't mocked → the WS hard-fails
  with no key (`server.ts:3622-3625`). Degrade gracefully / emit a mock transcript.
- [ ] **Execute Live tools for real.** Replace the `"Action queued…"` stubs (`server.ts:3387-3407`):
  `load_client_data` → query `customers` by name **and phone** (extend `CRM.tsx:559-569`) and feed the
  contact + `serviceCatalog` + `design_catalog` into the session; wire `schedule_job`/`create_invoice`/
  `create_lead`/`add_client_note` to real writes.
- [ ] **Add a `build_design_vision` Live tool** (+ `LiveEar.tsx` handler): yard photo (reuse
  `compressImage`) → `/api/design/process` → `/api/design/tiers` → **live line-item proposal w/ running
  total** (+ AI before/after via the A4-fixed mockup).
- [ ] **Vision panel UI** — customer-facing, updates as the rep talks: proposal + total on one side,
  `BeforeAfterSlider` on the other. Match the forest/zinc aesthetic.
- [ ] **Persist & share.** Save to a `customer_design_visions` collection keyed by `customer.id`; "send
  to client" via the portal/magic-link flow (`/portal/:clientId`, `/api/auth/magic-link/*`).
- [ ] **Firebase Storage upload.** `storage` is exported but unused (`src/lib/firebase.ts:36`) — store
  yard photos as durable URLs, not inline base64.

---

## Part B — Fast-follow 🟠
*Right after the first client; finishes the PARTIAL/STUB surface and the operability gaps.*

- [ ] **Finish PARTIAL features:** Contracts persistence (`Contracts.tsx` — UI only, no Firestore);
  RouteOptimizer optimize path (`/api/workflows/routing` — validate end-to-end); Agent workflow
  execution + AgentLabs (Deep Research / Video) — UI present, orchestration mocked; InventoryForecast
  model (`InventoryForecast.tsx` — charts only); NotificationsCenter event plumbing; ClientPortal
  stubbed tabs.
- [ ] **SaaS-admin tenant management UI** (`SaaSAdminDashboard.tsx` — currently threat-log only):
  create/list/suspend tenants, assign Stripe accounts, set tiers/quotas.
- [ ] **Distributed rate limiting + persistent threat log** (Redis/Firestore) — in-memory today
  (`server.ts:456-503,355-372`), per-instance only on Cloud Run.
- [ ] **Graceful AI fallbacks** for the ~20 non-mocked routes (`ai.interactions.*`, `generateVideos/
  Images`, `.models.get()`, `ai.live`) so a missing/limited key degrades instead of 500-ing.
- [ ] **Broader E2E** (Playwright) from `TEST_MATRIX.md` (fuzzing, device matrix, offline).
- [ ] **De-uglify pass:** auth screen (`AuthPage`), Design Studio flow, dense dashboards, mobile/PWA
  safe-areas & tap targets.

---

## Part C — Scale & hardening 🟢
- [ ] **WebSocket pooling / sticky sessions** — native `ws` won't survive multi-instance voice load
  (FIXME `server.ts:3361`).
- [ ] **Secrets manager** (GCP Secret Manager) instead of `.env` on the instance.
- [ ] **Offline sync robustness** — conflict resolution + DELETE queue + backoff (`src/services/syncService.ts`).
- [ ] **Pay down type debt** — `@ts-nocheck` on ~57 files; surface real errors, start with `src/types.ts`.
- [ ] **Observability** — structured logs, error tracking, AI-cost dashboards.

---

## Part D — Market-fit / form-fit for landscapers
*Why a landscaper buys this over Jobber / LMN / Service Autopilot / Yardbook, and what to sharpen.*

- **The wedge — sell on the spot.** The killer loop is **photo → AI design vision → tiered quote →
  e-sign → invoice → Stripe payment**, narrated live by Live Ear while standing in the customer's
  yard. No incumbent closes a *designed, priced* job at the doorstep. This is the demo that sells.
- **Trust through grounded pricing.** Quotes must come from the contractor's **own catalog + live
  inventory** (A4), not AI guesses — landscapers won't trust (or send) hallucinated numbers.
- **Field-first & offline.** Crews work in trucks with bad signal: the PWA + `syncService` offline
  queue and mobile field mode are real differentiators — keep them first-class.
- **Recurring seasonal revenue.** Mowing/maintenance is contract-based and seasonal — make Contracts
  real (Part B) and add **seasonal recurring billing** (below); this is core to landscaper economics.
- **Compliance as a moat.** EPA chemical-application logging with weather/safety checks + signatures
  (`Compliance.tsx`, real today) is a genuine differentiator for chemical-applying companies.
- **Tier the value.** free = single crew + core CRM/scheduling/invoicing; pro = Design Studio + Live
  Ear + routing; enterprise = compliance, multi-crew, advanced reporting. Enforce via A5.

**Named form-fit gaps to add as backlog (not in the code yet):**
- [ ] **QuickBooks / accounting export** — the #1 integration ask for this segment; none exists.
- [ ] **Seasonal recurring billing & contract auto-renew** (Stripe subscriptions per *their* customers).
- [ ] **Crew time-tracking → payroll** — `/api/workflows/payroll` drafts an audit but there's no
  timeclock; field crews need clock-in/out tied to jobs.
- [ ] **Customer-facing booking / instant-quote request** beyond the magic-link portal.

---

## Appendix A — Feature inventory
*Status of every page (REAL = Firestore-backed & working · PARTIAL = UI + some backend · STUB = UI only).*

**Admin/owner pages:** Dashboard **REAL** · CRM **REAL** (pipeline, tasks, jobs, custom fields, map,
lead verification, CSV import) · Scheduler **REAL** · CrewSuite **REAL** (live location/ETA) · Inventory
**REAL** (barcode, forecasting charts) · Invoices **REAL** (PDF print, OCR expenses) · Compliance **REAL**
(EPA log + audit trail + signature) · FormBuilder **REAL** · Settings **REAL** (feature flags, pricing
catalog, Stripe, team) · Portfolio **REAL** · Reports **PARTIAL** (some mock data) · RouteOptimizer
**PARTIAL** (maps UI; optimize unproven) · Agent **PARTIAL** (workflows mocked) · SaaSAdminDashboard
**PARTIAL** (threat log only; no tenant mgmt) · Contracts **STUB** (no persistence) · AiPlayground **STUB** ·
AiUsage **STUB**.
**Employee/foreman:** Dashboard / DesignStudio / Scheduler / CrewSuite / Inventory / RouteOptimizer — role-gated, **REAL**.
**Client:** ClientPortal **PARTIAL** (auth works; some tabs stubbed) · Portfolio **REAL**.
**Public:** PrivacyPolicy / TermsOfService / DataMap / MagicLinkAuth — **REAL**.
**Notable components:** LiveEar, HandsFreeDictator, MarkupCanvas, BeforeAfterSlider, DesignDatabasePanel,
ServicePricingCatalog, TeamManagement, AuditTrail, CRM* panels, widgets/* — **REAL**. AgenticOutreachDrawer,
AgentLabs, InventoryForecast, StripeConnectSection, NotificationsCenter, SubscriptionGuard, IntegrationSettings,
WorkspaceOutboxPanel, CommandPalette — **PARTIAL/STUB**. BiometricGuard, WalkthroughOverlay, MagicSetupNode — **STUB**.
**Feature flags** live in `TenantContext` `settings.features` (crewTracking, inventoryManagement, designStudio,
contracts, routeOptimization, crm, scheduler, reports, invoices, compliance, aiOmnilingual) + `subFeatures`
(geofencing, exifVerification, aiExpenseOcr, aiProposals, automatedFollowUps, liveEarAlwaysOn, visionAnalysis,
aiSafetyCheck, requireSignature, autoTranslateChat, voiceMemoDubbing, semanticStyleLearning, …). Tiers: free/pro/enterprise.

## Appendix B — Endpoint inventory & gating
*~75 routes in `server.ts`. ✓ = behind `verifyFirebaseToken` (once A2 fixes the bypass). Mock = covered by
mock mode (`ai.models.generateContent` only).*

- **Unauthenticated (excluded) — gate before prod:** `/api/playground/*` ×6 (`:3180-3270`, real Gemini,
  **open cost abuse**); `/api/auth/magic-link/generate|validate` (`:3328,3344`, JWT); `/api/stripe/webhook`
  (`:307`, signature-verified — OK); `/api/security/threats` (`:370`, **leaks threat log — restrict**).
- **AI routes NOT covered by mock** (fail without a key — need fallbacks): `/api/design/generate-mockup`,
  `/api/research/start|status`, `/api/marketing/generate-video|video-status|video-download`,
  `/api/agent/tts|hands-free-dictation|onboarding-magic|onboarding-vision`, `/api/job/snapshot-check`,
  `/api/outbound/draft-personalized-campaign`, `/api/live` (WS), all `/api/playground/*`.
- **Mocked AI routes (~32):** `/api/workflows/{proposal,invoice-chaser,seasonal,payroll}`,
  `/api/crm/{analyze-property,draft-proposal,briefing,enrich}`, `/api/design/{process,tiers}`,
  `/api/scheduler/{draft-notification,optimize,voice-memo}`, `/api/inventory/{forecast,process-image}`,
  `/api/{daily-briefing,translate,reviews/process,expenses/ocr,knowledge/ingest,compliance/check}`,
  `/api/brain/{compress,query}`, `/api/reports/predictive-maintenance`, `/api/outbound/{generate-campaign,simulate-call}`,
  `/api/jobs/generate-checklist`, `/api/job/broadcast`, `/api/dashboard/customize`, `/api/invoice/extract`.
- **Integration/data routes (OAuth token in header):** `/api/integration/{keep,gmail,chat,drive}`,
  `/api/workflows/{weather,reorder,followup,maintenance,routing,irrigation,chemical-log,generate-invoice-pdf}`,
  `/api/invoices/generate-pdf` (Puppeteer), `/api/sms/send` (Twilio), `/api/config/maps` (returns public Maps key).
- **Stripe (strictLimiter):** `/api/stripe/{connect,checkout,webhook}` — **make tenant-safe (A5)**.
- **Rate limits:** `globalLimiter` (1000/15m, all `/api`), `aiLimiter` (100/day/UID, AI prefixes),
  `strictLimiter` (100/hr, stripe). `cacheApiResponse` on selected design/crm/inventory/telemetry routes.
- **SSRF:** only `/api/agent/onboarding-scrape` (`:1646`) fetches a user URL — **already** uses
  `validateSafeUrl` + `redirect:'error'`. Reuse that pattern for any new user-URL fetch.

## Appendix C — Secrets / env vars
`GEMINI_API_KEY` (unset → mock mode, but ~20 routes still fail) · `VITE_FIREBASE_*` (client Auth — missing) ·
`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` · `JWT_SECRET` (hardcoded fallback — fix) · `TELEMETRY_EXPORT_KEY` ·
`GOOGLE_MAPS_PLATFORM_KEY` · `OPENWEATHER_API_KEY` · `GOOGLE_SHEETS_SPREADSHEET_ID` · `TWILIO_ACCOUNT_SID|AUTH_TOKEN|PHONE_NUMBER`
(graceful fallback) · `NODE_ENV`. Firebase Admin uses ADC (Cloud Run service account roles). Create `.env.example` (A1).

## Appendix D — Reusable assets (don't reinvent)
`validateSafeUrl` (`src/lib/securityUtils.ts`) · `compressImage` (`src/lib/imageUtils.ts`) ·
`INITIAL_SERVICE_CATALOG` (`src/lib/constants.ts`) + `tenant.settings.serviceCatalog` · tenant `design_catalog`
& `inventory` Firestore collections · `/api/design/{process,tiers,generate-mockup}` · `BeforeAfterSlider`,
`MarkupCanvas` · `syncService` (offline queue) · `firestore.rules` (solid tenant model) · `security_spec.md` +
`TEST_MATRIX.md` (test specs to implement).
