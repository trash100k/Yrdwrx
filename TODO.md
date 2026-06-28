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
> _Last updated: 2026-06-27 — re-prioritized from the deep US market study (`MARKET_RESEARCH.md`):
> QuickBooks/payments/recurring billing are now launch table-stakes (A7); AI repositioned as on-site
> closing; added the Gemini-native build-leverage map + the beachhead. Prior: full ship-ready
> checklist from four investigations incl. a live pentest._

## How to use this file

- **Launch model:** lean **MVP to first paying client (Part A)**, then **fast-follow (Part B)**,
  then **scale/hardening (Part C)**. **Part A is the gate** — nothing ships until it's done.
- **Audience:** broad, **tier-gated** (free / pro / enterprise). Build features once, gate by tier.
- **Billing:** **both** — landscapers pay YardWorx a subscription *and* use Stripe Connect to bill
  their own customers.
- Priority legend: 🔴 **blocker** (can't launch) · 🟠 **risky** (breaks/degrades in real prod or at
  scale) · 🟢 **feature/polish** (value-add & de-uglify).

> **Backend architecture (decided + in progress): HYBRID.** Keep **Firebase Auth** (Google Sign-In +
> Workspace consent) + **Cloud Run** (+ **Vertex AI Gemini via ADC**); move only **DATA → Supabase
> Postgres + RLS**, bridged by **Supabase Third-Party Auth (Firebase)** so RLS keys on the Firebase
> UID (`auth.jwt()->>'sub'`). **Live now:** the full Postgres schema + RLS is applied to project
> `bzpxudpmksnawmaanxal` (org GaelWorx) — 23 tables, tenant-scoped policies in a hardened `private`
> helper schema, **cross-tenant isolation verified live**, **0 security advisories**. Migrations:
> `supabase/migrations/0001`–`0004`. Next: enable Supabase Third-Party Auth → Firebase in the
> dashboard, then cut pages off Firestore via `src/lib/repos/*`.

---

## Launch-readiness snapshot

| Area | Status | ~Ready | Headline gap |
|------|:------:|:------:|--------------|
| Build / deploy | 🔴 | 0% | `npm run build` never bundles `server.ts` → `dist/server.cjs`; Cloud Run crash-loops |
| Auth | 🔴 | 0% | **Every `/api/*` route is unauthenticated** (proven live — mount-path bug) |
| Multi-tenancy | 🟠 | ~55% | **Supabase Postgres + RLS is LIVE** (project `bzpxudpmksnawmaanxal`, Firebase-UID keyed, cross-tenant isolation verified, 0 security advisories). Remaining: wire Third-Party Auth in dashboard + cut pages over from Firestore; client still hardcodes `demo-tenant-1` until then |
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

### A7 — Market table-stakes for a credible launch 🔴 (from `MARKET_RESEARCH.md`)
> The deep market study is blunt: these are the **entry bar**, shipped by every incumbent (Jobber,
> LMN, SingleOps, Aspire) — not differentiators. Operator tool usage: accounting **77%**, invoicing
> **72%**, estimating **61%**. Missing them = not credible, regardless of how good the AI is.

- [ ] **QuickBooks sync.** The confirmed competitive **moat** (every incumbent ships it; "double
  entry is a thing of the past"). Ship **one-way** first (Jobber-style: customers, invoices, payments,
  items → QuickBooks Online), then two-way (SingleOps/LMN-style) as a stickiness follow-up. _Decide
  one-way-now vs two-way at design time — it interacts with the Supabase migration._
- [ ] **Online payments to the contractor's customers** — card + **ACH** on invoices (extends the
  existing Stripe Connect wiring); branded invoice sent on job completion via SMS/email.
- [ ] **Recurring / seasonal billing & contract auto-renew** — core to landscaper economics
  (mowing/maintenance seasons). Pairs with making Contracts real (Part B).
- [ ] **Online booking / instant-quote request** — beyond the magic-link portal; a customer-facing
  intake that feeds the CRM pipeline.
- [ ] **Crew time-tracking → payroll** — clock-in/out tied to jobs (`/api/workflows/payroll` drafts
  an audit but there's no timeclock).

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

## Gemini-native capabilities → features (build leverage)
*Why a lot of this ships cheap and **with confidence**: the capabilities below are baked into the
Gemini models and **already wired + proven in `server.ts`** — extending them is pattern-reuse, not
greenfield. Cite the line when building so it's reuse, not aspiration.*

**Cheap + confident (reuse the proven pattern):**
- **Google Search grounding** (`server.ts:1607` brain/query, `:3186` playground) → lead/customer/
  property **enrichment**, local **market & competitor-pricing intel**, plant/horticulture facts, and
  **state pesticide / EPA regulatory lookups**. Citations are the "confidence."
- **Google Maps grounding** (`server.ts:3187`) → property context, geocoding, neighborhood/drive context.
- **Structured output / `responseSchema`** (pervasive; `server.ts:2855`) → reliable extraction (intake,
  receipts, quotes, invoices) and any model→DB write.
- **Function calling / tools** (`server.ts:3448`) → Live Ear actions + agentic workflows.
- **Vision + image-gen** (`/api/design/*`, OCR) → yard analysis, plant ID, before/after render.
- **Thinking mode** (`server.ts:3191`) → complex multi-step estimates / plans.

**Still real (non-AI) engineering — don't let "Gemini can do it" mask these:**
- **QuickBooks** sync (deterministic API + reconciliation) — A7, the moat.
- **Stripe** card/ACH payments + recurring/seasonal billing — A7.
- **Aerial/satellite measurement** accuracy — needs an imagery provider (see Part D); **grounding ≠
  measurement**.
- **Supabase multi-tenant backend** (the migration) — infra, not AI.

> **Guardrail:** grounding gives *factual* confidence + citations, but the model's **numbers**
> (measurements, prices) are still on us — keep quotes **catalog-grounded / deterministic**, never
> model-invented. (This is both the Design Studio fix in A4 and the market-trust point in Part D.)
> Search/Maps grounding carry cost + latency + quota — **gate by tier** (ties to A5 quota work).

---

## Part B — Fast-follow 🟠
*Right after the first client; finishes the PARTIAL/STUB surface and the operability gaps.*

### CRM completeness gaps (delete / reset / persistence) — from a live audit
> Do these as part of cutting CRM over to Supabase repos (so persistence + the gaps land together).
> 🔴 = broken/data-loss-risk · 🟠 = missing-but-expected.

**Persistence holes (UI-only today — buttons with no handler / mock data):**
- [ ] 🔴 **Tasks** (`CRMTasks.tsx`): "New Task" button has **no handler**; complete-toggle updates **local
  state only** (not saved). No create / edit / delete / assign / due-date. Needs a Postgres `tasks` table + full CRUD.
- [ ] 🔴 **Jobs** (`CRMJobs.tsx`): "+ New Job" + "View Details" have **no handlers**; **mock data**, no
  persistence. No create / edit / delete / status-change / reschedule / reassign. (Jobs exist as a real
  collection elsewhere — wire CRMJobs to it.)
- [ ] 🔴 **Documents** (`CRMDocuments.tsx`): Upload / download / preview / delete buttons have **no
  handlers**; mock data. Needs Storage upload + delete + list.

**Delete / restore safety:**
- [ ] 🔴 **Customers hard-delete with no undo** (`CRM.tsx:410` single, `:257` bulk via `window.confirm`).
  Add **soft-delete** (`is_archived` / `deleted_at` on the `customers` table — not present in schema yet)
  + a Restore/Trash view. Same for **Leads reject = hard delete** (`LeadVerificationPanel.tsx:34`) → archive instead.
- [ ] 🟠 **Restore / undo** missing everywhere; **Knowledge** soft-deletes (`CRM.tsx:1478`) but has **no
  restore UI** and no edit.

**Reset / bulk management:**
- [ ] 🟠 **No "reset / clear demo data"** action (seed data can't be wiped from the UI) — needed before a real tenant goes live.
- [ ] 🟠 **No reset pipeline** (stages hard-coded `Pipeline.tsx:11-16`; no customize/rename/reset/clear).
- [ ] 🟠 **Bulk ops partial:** bulk delete + bulk tag exist (`CRM.tsx:248,270`); **missing** bulk
  status-change, bulk reassign-owner, bulk tag-remove.
- [ ] 🟠 **Merge duplicate customers** — none.
- [ ] 🟠 **Custom fields** (`CRMCustomFields.tsx`): no inline value edit (delete + re-add only), no field
  types, no rename, no reorder.
- [ ] 🟠 **Campaigns/outreach** (`AutonomousCampaigns.tsx`, `AgenticOutreachDrawer.tsx`): approve/send is
  toast-only — **no persistence, no send log, no schedule, no unsubscribe/CAN-SPAM**.
- [ ] 🟢 **Customer Map** (`CustomerMap.tsx`): not a real map (grid placeholder; needs Maps key + clustering).


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

## Part D — Market-fit / positioning (from `MARKET_RESEARCH.md`)
*Verified against the US market study. Full report + citations in `MARKET_RESEARCH.md`.*

**Competitive reality (don't fool ourselves):** the market is mature and commoditized. The AI bets
are **contested** — Jobber Voice (Sept 2025) overlaps Live Ear; Aspire PropertyIntel / SatQuote /
SiteRecon do AI estimating; ReimagineHome already does photo-to-design. So **don't position as "AI
estimating" (aerial owns it) or "voice admin" (Jobber owns it).**

**The open lane — sell on the spot.** The one workflow incumbents *don't* own: **live, on-site,
customer-facing visual selling**. They anchor on remote aerial measurement to *avoid* the site
visit; our edge is the opposite — co-create a designed, priced, good/better/best proposal **in the
driveway**, narrated by Live Ear, then e-sign → invoice → get paid. This is the demo that sells.

> **Positioning statement:** *"Close the job in the driveway. YardWorx turns a phone photo and a
> conversation into a designed, priced, good/better/best proposal your customer signs on the spot —
> then syncs to QuickBooks and gets you paid."*

**Recommended beachhead: small-to-mid residential design-build / install landscapers.** They live on
visual selling + upsell (our strength), sit **below Aspire's revenue floor** (Aspire is revenue-tiered,
$1M+, explicitly not for startups), and are under-served at the SMB price point. Avoid commercial
maintenance (Aspire's turf; heavy on routing/scale we lack). _Secondary wedge:_ pesticide-applying
**lawn-care** operators — the federal 30-day customer-furnishing rule for **restricted-use** products
is still in force, and our Compliance module (EPA log + signature + audit + portal) can fulfill it.
_(Don't over-specify recordkeeping schemas in marketing without state-level legal review.)_

**Pricing & packaging (verified band $200–$650/mo):** undercut LMN's mandatory onboarding fee with
**no setup fee + a free/low entry tier** to land; Pro ~$199–299/mo (AI selling suite + QuickBooks +
payments); Enterprise above. Tier the value: free = core CRM/scheduling/invoicing; pro = Design
Studio + Live Ear + routing; enterprise = compliance, multi-crew, reporting. Enforce via A5.

**Durable strengths to keep first-class:** field-first PWA + offline `syncService`; catalog-grounded
(non-hallucinated) pricing (A4) — the trust point; Compliance/EPA logging.

**Strategic decision — aerial/satellite measurement.** Incumbents market remote takeoff as the speed
win (SiteRecon: 24-hr proposals vs 3–4 days, doubled close rates). Photo-from-the-yard does **not**
replace it. Decide: **build vs partner** (Nearmap / SatQuote-style integration, or Gemini Maps
satellite tiles) to neutralize the gap. _Open question — see `MARKET_RESEARCH.md`._

> Most table-stakes form-fit gaps (QuickBooks, payments, recurring billing, online booking,
> time-tracking) were **promoted to launch blockers in [A7](#a7--market-table-stakes-for-a-credible-launch--from-market_researchmd)** — they're no longer "later" backlog.

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
