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
> _Last updated: 2026-06-28 — added **Part E** (audit findings: landscaper feature gaps, widget/UI
> health, text/copy) and kicked off the quick-wins batch. Earlier this session: server hardening
> (playground gated, threats admin-only, fail-fast `JWT_SECRET`, IPv6 limiter, tenant-scoped caches,
> env-driven CSP), auth restoration behind `VITE_REQUIRE_AUTH`/`REQUIRE_AUTH` + the tenant
> provisioning endpoint, real billing (tenant-safe Stripe + `application_fee` + ACH + subscribe) and
> tier/credit-wallet metering, design/tiers catalog grounding + AI mock-mode 503 fallbacks, money-path
> UI fixes, tests + CI, frontend cleanup, README rewrite, and the missing Supabase migration (`0006`).
> Remaining: the full Firestore→Supabase page cutover and the human-only go-live blockers (§ A2 / README).
> Prior (2026-06-27): re-prioritized from the deep US market study (`MARKET_RESEARCH.md`) —
> QuickBooks/payments/recurring billing as launch table-stakes (A7); AI repositioned as on-site closing;
> added the Gemini-native build-leverage map + the beachhead._

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
> `bzpxudpmksnawmaanxal` (org GaelWorx) — tenant-scoped policies in a hardened `private`
> helper schema, **cross-tenant isolation verified live**, **0 security advisories**. Migrations:
> `supabase/migrations/0001`–`0006` (`0006` adds the supporting tables the app needed:
> `material_logs`/`messages`/`audit_logs`/`system_logs`/`telemetry`, same RLS pattern). Next: enable
> Supabase Third-Party Auth → Firebase in the dashboard, then cut pages off Firestore via
> `src/lib/repos/*` (still runs on Firestore in the demo today).

---

## Launch-readiness snapshot

| Area | Status | ~Ready | Headline gap |
|------|:------:|:------:|--------------|
| Build / deploy | 🟢 | ~85% | ✅ server bundles to `dist/server.cjs`; **boots + serves SPA + API** (verified); IPv6 rate-limiter fixed; cache path env-driven (`GEMINI_CACHE_FILE`). Remaining: Docker-image smoke test, Vertex/ADC |
| Auth | 🟠 | ~55% | ✅ mount-path **bypass fixed + enforced behind `REQUIRE_AUTH`**; ✅ client gate behind **`VITE_REQUIRE_AUTH`** + tenant **provisioning endpoint** added. Remaining: finish the real `onAuthStateChanged`/`useRole`/`TenantContext` wiring & flip both flags on with the human go-live steps |
| Multi-tenancy | 🟠 | ~55% | **Supabase Postgres + RLS is LIVE** (project `bzpxudpmksnawmaanxal`, Firebase-UID keyed, cross-tenant isolation verified, 0 security advisories); supporting tables added (`0006`). Remaining (human + cutover): wire Third-Party Auth in dashboard + cut pages over from Firestore; client still hardcodes `demo-tenant-1` and runs on Firestore until then |
| Billing | 🟠 | ~60% | ✅ tenant-safe Stripe (`application_fee`, ACH, require `invoiceId`) + `/api/stripe/subscribe`; ✅ tier enforcement + AI **credit-wallet** metering (402/429). Remaining: QuickBooks sync, recurring/seasonal billing, connect a live Stripe account (human) |
| Design Studio | 🟠 | ~55% | ✅ catalog-grounded pricing + AI mock-mode 503 fallbacks (no more mock-mode white-screen / unmocked 500s). Remaining: reliable image mockup on a live key; full on-photo good/better/best verification |
| Live Ear (flagship) | 🟢 | ~60% | Streaming works; Live tools still partly stubbed; no vision builder yet |
| Security / firewalls | 🟢 | ~80% | ✅ `/api/playground/*` gated, threat log admin-only, fail-fast `JWT_SECRET`, tenant-scoped AI caches, env-driven CSP (`frameAncestors`). Remaining: distributed limiter/threat-log persistence, prompt-injection delimiting |
| Core features | 🟢 | ~75% | CRM/Scheduler/Inventory/Invoices/Compliance real; Contracts/RouteOptimizer/Agent partial |
| Tests | 🟠 | ~40% | ✅ smoke + money-path tests + **CI workflow** (`tsc --noEmit` + `vitest`) landing this session. Remaining: `security_spec.md` "Dirty Dozen" + cross-tenant emulator test, broader E2E |
| Docs / README | 🟢 | ~80% | ✅ README rewritten (real product/architecture/env/deploy + human go-live checklist); `.env.example` complete. Remaining: keep in sync as cutover lands |

---

## Part A — MVP launch blockers 🔴
*Everything here must land before the first paying client.*

### A1 — Build & deploy (get it running on Cloud Run)
> Today `cloudbuild.yaml` builds & deploys, then the container crash-loops: `npm start` runs
> `node dist/server.cjs`, but `npm run build` only builds the frontend.

- [x] **Bundle the server.** ✅ Added `build:server` (`esbuild … --packages=external --outfile=dist/server.cjs`)
  + wired `build` to run it. Verified: `npm run build` emits `dist/` (frontend) **and** `dist/server.cjs`
  (137 KB); the bundle **boots** under `NODE_ENV=production` and serves both `/` (SPA) and `/api/*`.
- [x] **Complete the Firebase client config.** ✅ `src/lib/firebase.ts` now reads
  `import.meta.env.VITE_FIREBASE_*` (apiKey/authDomain/storageBucket/messagingSenderId/appId), projectId fallback kept.
- [x] **`.env.example`.** ✅ Created at repo root with Firebase/Supabase/Gemini/Stripe/Twilio/etc. + `REQUIRE_AUTH`.
  _(Follow-up: add a loud startup warn in `server.ts` for missing critical vars.)_
- [x] **Real `JWT_SECRET`.** ✅ Hardcoded dev fallback removed; the server **fails fast** when
  `REQUIRE_AUTH`/prod and `JWT_SECRET` is unset (no silent insecure default).
- [ ] **Cloud Run IAM.** (human/GCP) `firebase-admin` uses ADC + `projectId` only (`server.ts:435-444`); the
  service account needs Firestore + Auth Admin roles or token verification/DB writes fail silently.
- [x] **Fix the ephemeral cache.** ✅ Cache path is now env-driven via **`GEMINI_CACHE_FILE`**;
  unset → in-memory only (recommended on Cloud Run's ephemeral/RO FS).
- [ ] **Container smoke test.** `npm ci` → `npm run build` → build image → run → `/` serves SPA and an `/api/*` route responds.

### A2 — Auth + real multi-tenant isolation
> The biggest risk. The server-side fix is ~1 line; the client side couples to onboarding/tenant.

- [x] **🔴 Fix the global auth bypass.** ✅ `verifyFirebaseToken` now matches on the full path
  (`req.baseUrl + req.path`), gated behind a new **`REQUIRE_AUTH`** env flag (default off so the mock
  demo keeps working). _Verified:_ with `REQUIRE_AUTH=true`, no-token & garbage-token → **401**;
  excluded routes still pass. **Client mirror added:** **`VITE_REQUIRE_AUTH`** gates the demo vs real
  auth on the frontend. **Remaining (A2):** finish the real-auth wiring (below) + flip **both**
  `REQUIRE_AUTH=true` AND `VITE_REQUIRE_AUTH=true` together in prod (client only sends a token when
  `auth.currentUser` exists). Flag default stays off so the demo runs.
- [~] **Restore real auth.** Restoring `onAuthStateChanged` behind `VITE_REQUIRE_AUTH` (mock admin is
  the default-off demo path). Wiring landing this session; flip-on happens with the human go-live steps.
- [~] **Make `useRole` real.** `src/hooks/useRole.ts` hard-returns `owner`/`hasPermission:()=>true` for
  the demo — read role from the authed user's `profiles` row when `VITE_REQUIRE_AUTH` is on. In progress.
- [~] **Make `TenantContext` real.** Hardcodes `demo-tenant-1`/tier `enterprise` for the demo — resolve
  the real tenant + tier per authed user (`/api/tenants/me`) when auth is on; support `switchTenant`. In progress.
- [~] **Fix new-client provisioning.** ✅ Server endpoint **`POST /api/tenants/provision`** added (mints a
  unique tenant + owner `profiles` row via the service role; **`GET /api/tenants/me`** resolves the caller's
  tenant). **Remaining:** point `src/components/Onboarding.tsx` at it (was writing every company to
  `genesis-1`) so onboarding mints a unique tenant instead of colliding.
- [ ] **Verify isolation.** Re-check `firestore.rules` against `security_spec.md` "Dirty Dozen";
  confirm the `demo-tenant-1` anonymous safe-hatch (`firestore.rules:40-44`) is gated for prod.
- [ ] **De-hardcode the SaaS-admin gate.** `src/components/auth/SaaSOwnerGate.tsx` embeds an owner
  email in source — move to a Firebase custom claim.

### A3 — Endpoint gating & firewalls
> Hardening is partly present (Helmet, limiters, SSRF guard on the one user-URL route). These are
> the holes that matter for a public, multi-tenant deployment.

- [x] **Gate the `/api/playground/*` routes.** ✅ Now require auth (removed from the excluded list);
  no longer an open path to real, non-mocked Gemini chat/image/video/music → closes the AI-cost abuse hole.
- [x] **Admin-only the threat log.** ✅ `GET /api/security/threats` now restricted to owner/admin (no
  longer leaks the threat log to any caller).
- [x] **Derive `role` from the token, not the body.** ✅ `/api/design/*` financial-visibility gating now
  reads the token role (`req.user`), not `req.body.role` → closes the privilege-escalation path.
- [x] **Tenant-scope the AI cache key.** ✅ Cache keys now include `tenantId` so responses can't leak
  across tenants (PII risk closed).
- [x] **Tighten CSP.** ✅ `frameAncestors` is now **env-driven** (self/your domains) instead of `['*']`.
- [ ] **Sanitize prompt-injection inputs.** Delimit user text (`prompt`, `customInstallRules`,
  `designCatalog` names) and instruct the model to treat it as data; don't rely on prose "air gap".
- [x] **Harden secondary guards.** ✅ `aiLimiter` IPv6 key-gen fixed (uses the `ipKeyGenerator` helper).
  _Remaining:_ rotate/strengthen the `TELEMETRY_EXPORT_KEY` single-header check.

### A4 — Design Studio: working, reliable & grounded in their data
> **Huge priority.** From a live pentest. Goal: cohesive, repeatable designs with **trustworthy
> pricing derived from the tenant's own catalog + live inventory**, not AI-invented numbers.

- [x] **Stop the mock-mode white-screen.** ✅ `/api/design/process` & `/tiers` now return a realistic
  design **mock branch** in mock mode (plus AI mock-mode **503 fallbacks** instead of `{}` → no more
  `undefined` map crashes on `result.identifiedAreas` / `result.tiers[activeTier]`).
- [ ] **Fix the mockup / "Reveal Slider."** `/api/design/generate-mockup` → `500` (`ai.interactions.create`,
  is unmocked + experimental API + speculative image model). Validate the real API against a live key or
  switch to a supported image path; add a dev placeholder fallback. _(Partial: 503 fallback added; needs a live-key path.)_
- [ ] **Validate inputs (400 not 500).** Missing `image` → `500 "...reading 'includes'"`;
  `designCatalog[].type.toUpperCase()` crashes on non-string. Return 400s.
- [x] **Ground the design in tenant data.** ✅ `/api/design/process` + `/tiers` are now **catalog-grounded**:
  line-item prices are derived from the tenant's `serviceCatalog`/`design_catalog`, not model-invented
  (the trust point). _Remaining:_ also feed the live `inventory` collection.
- [x] **Enforce the financial air-gap server-side.** ✅ Employee/foreman cost visibility is gated by the
  **token role** server-side (see A3 "Derive `role` from the token"), not the prose guardrail / client checks.
- [ ] **Cleanup:** unbounded non-tenant cache eviction (`server.ts:254-299`); governance-scanner false
  positives on legit design text (`../`,`1=1`,`.env` → 403, `server.ts:375-422`); dead `markup` param +
  non-existent `data.estimatedCost` (`DesignStudio.tsx:237`).

### A5 — Billing (subscription + Connect), made tenant-safe
- [x] **Enforce subscription tiers + AI credit wallet.** ✅ Tier-enforcement middleware + an **AI
  credit-wallet** that meters expensive Gemini ops and returns **402** (out of credits) / **429**
  (rate) when exhausted. Per-tier monthly allotments via `AI_CREDITS_FREE/PRO/ENTERPRISE`.
- [x] **Tenant-safe Stripe Connect + payments.** ✅ Stripe routes verify the caller owns the tenant
  (no longer trust `req.body.tenantId`); payments take the platform **`application_fee`**
  (`PLATFORM_FEE_PCT`), support **ACH**, and **require `invoiceId`**. New **`/api/stripe/subscribe`**
  for the YardWorx subscription. _Remaining (human): connect a live Stripe account._
- [x] **Tenant-safe webhook.** ✅ `/api/stripe/webhook` validates tenant ownership before mutating
  invoices (signature verification was already correct).

### A6 — Minimum tests + docs
- [ ] **Security tests.** Implement the `security_spec.md` "Dirty Dozen" against `firestore.rules`
  (emulator) + a **cross-tenant isolation** test (Tenant A cannot read/write Tenant B). _(Still open.)_
- [x] **Smoke / money-path tests.** ✅ Added smoke + money-path tests (incl. auth-enforcement: no token → 401).
- [x] **CI.** ✅ GitHub Actions workflow runs `npm run lint` (`tsc --noEmit`) + `npm run test` on PRs.
- [x] **Rewrite the README.** ✅ Replaced the AI-Studio boilerplate with real product/architecture,
  env (→ `.env.example`), roles, deploy, and a human-only "Going live — first paying client" checklist.

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

### Gemini 3.x capability roadmap — what to leverage now (capability → YardWorx feature)
*The app already touches a lot of the Gemini surface but uses a fraction of each. Models seen in
`server.ts`: `gemini-2.0-flash`, `2.5-flash/pro`, `3.5-flash`, `3.1-pro-preview`, `3.1-flash-image`,
`3.1-flash-live-preview`, `3.1-flash-tts`, `veo-3.1`, `lyria-3`, deep-research agent. Standardize new
work on **`gemini-3.5-flash`** (cheap/fast default) + **`3.1-pro`** (hard reasoning).*

**✅ Already wired (keep/extend):** text gen, **vision** (Design Studio, receipt/part OCR),
**Search grounding** (`:1607`), **Maps grounding** (playground `:3187`), **structured output**
(`responseSchema` `:2855`), **function calling** (Live tools `:3448`), **Live API** voice (`/api/live`),
**image gen** (design mockup via `ai.interactions`), **Veo** video, **Lyria** music, **TTS**, **deep
research** agent.

**🟡 Under-utilized / not wired (the opportunity):**
- [ ] **Thinking / reasoning mode** — only in the playground (`:3191`). Turn it on for the hard calls:
  estimate math, route/schedule optimization, payroll/job-costing audits, compliance reasoning.
- [ ] **Native image *editing*** ("nano-banana" `gemini-3.x-flash-image`) — Design Studio only does a
  one-shot transform. Use real **iterative edits + multi-image** (before photo + product photos →
  inpaint specific beds, swap plants, keep the rest of the yard). The headline on-site selling moment.
- [ ] **Context caching** — we hand-roll a SHA disk cache; use **Gemini context caching** to cache the
  tenant's catalog/pricing/brand once and reuse it across calls (cheaper, faster, consistent).
- [ ] **Long context (1M+)** — stop truncating: feed the **whole customer history + catalog + notes**
  into briefings, proposals, and Live Ear for genuinely personalized output.
- [ ] **PDF / document understanding** — parse uploaded **contracts, vendor invoices, permits, spec
  sheets** natively (not just images) → structured data into `documents`/`invoices`.
- [ ] **Embeddings (`text-embedding`)** — replace the hand-rolled "brain"/knowledge with real
  **semantic search + dedup** (customer dedup-merge, similar-job lookup, knowledge RAG, lead scoring).
- [ ] **URL context tool** — point Gemini at a prospect's **website/Google listing** for instant
  onboarding/enrichment (extends the SSRF-guarded scrape).
- [ ] **Code execution tool** — deterministic math the model shouldn't eyeball: cubic-yards of mulch,
  sq-ft of sod, dosing/mix rates, multi-tier price rollups.
- [ ] **Maps grounding in production** (not just playground) — drive-time-aware scheduling, service-area
  validation, "customers within X mi," property/lot context for estimates.
- [ ] **Batch API** — overnight bulk jobs at lower cost: re-score the whole lead list, draft seasonal
  campaigns for every customer, refresh predictive-maintenance suggestions.
- [ ] **Structured output everywhere** — several routes still `parseGeminiJson` loosely; move them to
  enforced `responseSchema` so AI→DB writes can't be malformed.
- [ ] **Computer-use / agentic (later)** — auto-fill municipal permit portals, supplier reordering.

**Roadmap (phased; gate the heavy ones by tier + the credit wallet A5):**
1. **Now (cheap, high-impact):** thinking-mode on estimates/scheduling; structured-output hardening;
   long-context briefings/proposals; code-execution for measurement math.
2. **Next (the wow):** native iterative image-editing in Design Studio (multi-image inpaint) + context
   caching of the tenant catalog; PDF understanding for contracts/vendor invoices.
3. **Then (scale/intelligence):** embeddings-based semantic search + dedup + RAG knowledge; production
   Maps grounding for routing/estimates; URL-context onboarding; Batch API for nightly bulk AI.
4. **Later:** computer-use agents (permits/reordering). All metered ops ride the A5 credit wallet.

---

## Part B — Fast-follow 🟠
*Right after the first client; finishes the PARTIAL/STUB surface and the operability gaps.*

### CRM completeness gaps (delete / reset / persistence) — from a live audit
> Do these as part of cutting CRM over to Supabase repos (so persistence + the gaps land together).
> 🔴 = broken/data-loss-risk · 🟠 = missing-but-expected.

**Persistence holes (UI-only today — buttons with no handler / mock data):**
- [x] ✅ **Tasks** (`CRMTasks.tsx`): full CRUD + persisted complete/reopen + due/priority/assignee via `tasksRepo`.
- [x] ✅ **Jobs** (`CRMJobs.tsx`): create/edit/delete + status transitions + reschedule + reassign via `jobsRepo`.
- [x] ✅ **Documents** (`CRMDocuments.tsx`): upload (Firebase Storage) + list + download + delete via `documentsRepo`.

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

**Schema additions these imply (Supabase):**
- [x] ✅ Added `is_archived` + `deleted_at` to `customers`; new `tasks` + `documents` tables — applied to
  the live project (`0005`), RLS-enabled + tenant policies, 0 advisories. Repo layer (`src/lib/repos/*`)
  extended with `archive`/`restore`/`listArchived` + `customers`/`tasks`/`jobs`/`documents`/`leads` repos.
- [x] ✅ **Custom fields** inline value edit + field types (text/number/date/yes-no), backward-compatible.
- [x] ✅ **Supporting tables migration (`0006`)** — `material_logs`/`messages`/`audit_logs`/`system_logs`/
  `telemetry` with the same tenant-isolation RLS (private.* helpers); additive + idempotent (backfills
  columns on the tables that already existed). _(Written; the main session applies it via the Supabase MCP.)_
- [ ] Add `status='REJECTED'`/archive path for leads instead of hard delete (in the CRM.tsx cutover pass).


- [ ] **Finish PARTIAL features:** Contracts persistence (`Contracts.tsx` — UI only, no Firestore);
  RouteOptimizer optimize path (`/api/workflows/routing` — validate end-to-end); Agent workflow
  execution + AgentLabs (Deep Research / Video) — UI present, orchestration mocked; InventoryForecast
  model (`InventoryForecast.tsx` — charts only); NotificationsCenter event plumbing; ClientPortal
  stubbed tabs.
- [ ] **SaaS-admin tenant management UI** (`SaaSAdminDashboard.tsx` — currently threat-log only):
  create/list/suspend tenants, assign Stripe accounts, set tiers/quotas.
- [ ] **Distributed rate limiting + persistent threat log** (Redis/Firestore) — in-memory today
  (`server.ts:456-503,355-372`), per-instance only on Cloud Run.
- [x] **Graceful AI fallbacks** for the non-mocked routes (`ai.interactions.*`, `generateVideos/Images`,
  `.models.get()`, `ai.live`) — ✅ they now degrade with a **503** in mock mode / on a missing-limited key
  instead of 500-ing. _(Live-key image-mockup path still needs validation — see A4.)_
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

## Part E — Audit findings (2026-06-28): features · widgets · text

From a three-part audit (landscaper feature gaps vs `MARKET_RESEARCH.md`, a widget/UI health
sweep, and a text/copy consistency scan). Newly-surfaced concrete work, prioritized.

### E1 — Landscaper feature gaps (what a real operator still can't do)
*Ties to A7; this is the verified status after this session's billing/payment work.*

- [ ] 🔴 **QuickBooks Online sync** — the moat; **entirely missing** (no `/api/quickbooks`, no UI).
  Ship one-way first (customers/invoices/payments/items → QBO).
- [ ] 🔴 **Customer recurring / seasonal billing + contract auto-renew** — `/api/stripe/subscribe`
  only bills the SaaS tier, not the contractor billing *their* customers monthly. `Contracts` has
  an `mrr` field but no billing engine. Build scheduled invoices / Stripe subscriptions on the
  connected account with `application_fee_percent`.
- [ ] 🔴 **Two-way SMS** — outbound only (`/api/sms/send`). Add a Twilio inbound webhook →
  conversation thread (reuse the `messages` table from migration 0006).
- [x] ✅ **Online booking / instant-quote public intake** — shipped: public page `/book/:tenantId`
  (`src/pages/BookingIntake.tsx`) → `POST /api/public/lead-intake` (auth-excluded, rate-limited 30/hr,
  injection-scanned, input-capped) creates a NEW lead in the tenant's pipeline; `GET /api/public/tenant/:id`
  shows the company name. Degrades to a simulated success without Firebase creds. _Follow-up: surface the
  shareable booking link in Settings; land the lead in Supabase `leads` once the data cutover happens._
- [x] ✅ **Crew time-tracking (clock in/out + weekly hours)** — shipped: `TimeClock` component in
  CrewSuite (live elapsed timer, week-hours rollup), pure helpers in `src/lib/timesheets.ts`
  (unit-tested), persisted to Firestore + the new Supabase `timesheets` table (migration 0008, RLS,
  advisors=0). Optimistic local state keeps it usable offline/in demo. _Follow-up: feed timesheets
  into the `/api/workflows/payroll` draft so payroll is computed from real hours._
- [ ] 🟠 **Estimate e-signature → auto-convert to job + invoice** — Design Studio quotes are real +
  catalog-grounded and `Compliance` captures signatures, but the "client signs the estimate →
  job+invoice created" loop doesn't exist.
- [ ] 🟠 **Route optimization on real data** — `RouteOptimizer` uses **sample** stops; wire to real
  job/customer geocodes (`/api/workflows/routing`).
- [ ] 🟢 **Reviews → Google Business Profile** ingest/post-back; **Inventory POs/reordering** persistence
  (AI suggests; nothing is saved/sent).
- [ ] 🟢 **Aerial/satellite property measurement** — strategic build-vs-partner gap (see Part D).

### E2 — Widget / UI health (from the widget audit)
- [ ] 🔴 **`LiveInventoryFeed.tsx:95-150` renders NaN with real data** — reads `item.quantity`/
  `minQuantity`/`unit` but real docs have `stock` (typed at `:16`); low-stock condition is always
  false. Map the real `stock`/threshold/unit fields.
- [ ] 🔴 **`pb-safe` is undefined → no safe-area padding** (`Layout.tsx:796`, `ConsentBanner.tsx:31`).
  With `viewport-fit=cover`, the fixed bottom nav is occluded by the phone home indicator. Define
  `.pb-safe { padding-bottom: env(safe-area-inset-bottom); }` in `src/index.css`.
- [x] ✅ **Dashboard widgets wired to REAL data** — Dashboard subscribes to `invoices`;
  `EarningsWidget` (14-day paid series + MTD totals, "Live" badge w/ labeled "Sample" fallback),
  **Top Services** (top paid-invoice services + revenue share, LIVE/SAMPLE badge), and the **Analytics
  stat cards** (Weekly Earnings, Crew Status, Open Leads, Outstanding Billing — all computed from
  invoices/crews/leads) are now real. _Remaining: `AlertsWidget` still sample (needs a real alerting
  engine — weather/fuel/HOA signals)._
- [ ] 🟠 **`crews` widget has no empty state** (`Dashboard.tsx:2087`) — new tenant sees an empty box.
- [ ] 🟢 `EarningsWidget.tsx:28` conflicting `md:w-full md:w-[450px]`; `WidgetConfigurator.tsx:91`
  malformed `shadow-[...]` (spaces → silently no-ops); `Tabs.tsx:13` `w-max` overflows mobile w/ no
  scroll; `StockDepletionChart.tsx` is fully hardcoded; icon-only buttons missing `aria-label`
  (widget hide buttons, `WidgetConfigurator`, `Modal`/`Drawer` close, `DailyBriefing`).

### E3 — Text / copy (from the text scan)
- [ ] 🟠 **Brand drift in user-facing strings** — leftover **"Meridian"** (`Layout.tsx` ×4, `App.tsx`,
  server `"Meridian Green CRM"` log), `package.json` still `react-example`. Decide whether **"Cutty"**
  (assistant persona, `CuttyGuideContext`/`CuttyChat`/`LiveEar`) stays or becomes YardWorx. Sweep.
- [ ] 🟠 **Scary/jargon copy shown to users** — security 403 bodies (`"Governance & Compliance
  Violation…"`, `"Lineage Violation"`), `"Neural Design Vision"`. Soften user-facing wording.
- [ ] 🟢 **i18n is shallow** — `useTranslate` + `aiOmnilingual` translate chat/messages, not UI chrome
  (hardcoded English). **Formatting ad-hoc** — mix of `toLocaleString` vs raw concat; some raw ISO
  dates surface to users. Centralize currency/date formatting.
- [x] ✅ Text overflow is mostly guarded (97 `truncate`/`line-clamp`/`min-w-0` across 30 files).

> **Quick-wins batch (in progress):** E2 `LiveInventoryFeed` NaN, `pb-safe`, hardcoded-widget
> relabel + `crews` empty state, `WidgetConfigurator`/`EarningsWidget`/`Tabs` fixes; E3 403-copy
> softening + Meridian→YardWorx sweep.

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
