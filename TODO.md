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
> _Last updated: 2026-06-29 (APP DEEP-DIVE AUDIT) — ran an 8-cluster workflow audit of all 32
> sections; full report in **`APP_AUDIT.md`** (purpose/works/missing/research per section + cross-cutting
> themes + top-10 research agenda). The actionable backlog derived from it is the new **"App audit
> remediation backlog"** section below; a parallel subagent build sprint is clearing the buildable-now
> items (honesty pass, security hot spots, metrics-theater, geocoding, per-job linkage). Earlier:
> 2026-06-29 (HELL SPRINT cont.2) — **ALL Design Studio phases built** (Phase 1
> segmentation snap + VLM-judge/retry + undo/redo; Phase 2 catalog seed + SuggestedPalette→cost +
> provenance; Phase 3 crop-and-paste-back "Precise"). New: `/api/design/segment`, `/api/design/judge`;
> `src/lib/{designSession(+tests),plantCatalogSeed}`; `components/design/SuggestedPalette`. Depth/shadow
> + Perenual import + server-side sharp composite remain provider/key-gated (documented). 136 tests
> green. Built via 4 parallel role-subagents + integration. Earlier:
> 2026-06-29 (HELL SPRINT cont.) — added `LAUNCH_CHECKLIST.md` (the human-only
> config gate to go live: keys, network allowlist, Supabase auth, flip `REQUIRE_AUTH`, deploy +
> verify steps); Design Studio **iterate-on-render** ("Refine" = place object-after-object on the
> result); fixed dead `meridiangreen.io` icon refs → local YardWorx `public/icon.svg` + correct
> title/manifest; **QA smoke crawl now 20/20 routes crash-clean**. App is feature-complete +
> verifiably crash-clean in demo mode; remaining gate is keys/config (see LAUNCH_CHECKLIST). Earlier:
> 2026-06-29 (HELL SPRINT — feature blitz to sellable) — on top of the Design Studio
> overhaul, shipped in rapid gated-green waves: Design Studio money path (zone-aware placement, AI-viz
> badge, branded proposal PDF, plantIntelligence lib +20 tests); Referrals engine; Equipment/fleet
> tracker; Unified conversation Inbox; On-My-Way arrival ETA; Business Defaults in Settings; + a QA
> smoke crawl (18/19 routes crash-clean). 7 of 12 "find more" items now DONE (see Discovered backlog).
> New Supabase tables: equipment, referrals (RLS, 0 advisories). 123 tests green. Previously:
> 2026-06-29 (DESIGN STUDIO overhaul + owner-intelligence wave) — see the dedicated
> **"Design Studio overhaul"** and **"Owner-intelligence wave"** sections below, and the full engineering
> spec in **`DESIGN_STUDIO_PLAN.md`**. Shipped a whole-feature Design Studio audit + reliability pass +
> new features + the real flagship region-aware "draw a circle → place THAT object exactly there"
> placement engine (Phase 0), all gated green (103 tests). Previously the same day:
> 2026-06-29 (feature wave SHIPPED) — **built & shipped six research-driven features
> (gated green, 89 tests): outbound EMAIL send, the "Tailgate Closeout" flagship voice→actions flow,
> real-time JOB COSTING, chemical/pesticide COMPLIANCE log (+ new `compliance_logs` Supabase table,
> 0 advisories), public ONLINE BOOKING widget, and INSTANT ESTIMATE (property measurement).** New
> server endpoints: `/api/email/send`, `/api/agent/closeout`, `/api/measure/property`. All wired into
> routes + sidebar nav. A parallel "find more" agent surfaced 12 NEW high-value ideas (referral
> engine, push notifications, On-My-Way ETA, churn radar, per-customer profitability, equipment
> tracker, unified inbox, weather auto-reschedule, before/after gallery, card-on-file auto-charge, AI
> owner digest, address enrichment) — logged under "Discovered backlog" below. Previously:
> 2026-06-29 (market + design research) — **ran a parallel market/design research
> sweep; see `PRODUCT_RESEARCH_2026.md`.** Competitor gap analysis, 2026–2027 SaaS UI/UX trends, and a
> flagship UX case. Top table-stakes gaps: real outbound EMAIL (foundational), AERIAL PROPERTY
> MEASUREMENT → instant estimate (#1 landscaping table-stake), real-time JOB COSTING, QuickBooks sync,
> GPS crew tracking, chemical/compliance logs. Design north star = **"Tell it, don't drive it"**
> (intent-first, ambient AI, generative defaults, confidence+undo, sunlight/big-target field UI).
> Flagship to build = **"The Tailgate Closeout"** (one voice utterance at the truck → invoice sent,
> job closed, next visit booked, inventory flagged) via a reusable risk-tiered ActionCard primitive.
> Also: the QA crawl loop CONVERGED — full 31-route headless crawl is crash-clean. Previously:_
> _2026-06-29 (QA crawl loop + missing-functions audit) — **built a headless
> Chromium crawler that loads every route and clicks every button**, capturing runtime crashes /
> console errors / error-boundary trips, and ran a test->fix->retest loop. Fixes landed: CrewSuite
> window.prompt -> modal; res.ok/content-type guards on the maps + threat-log fetches; and a whole
> NULL-FIREBASE-AUTH CRASH CLASS (7 signInWithPopup(auth) sites + AiPlayground auth?.currentUser +
> Dashboard) that crashed under Supabase-only/demo. **Result: all 18 admin routes now crawl clean —
> zero error boundaries, zero render crashes, zero button errors.** (Crawler: scratchpad/crawl.cjs.)
>
> MISSING FUNCTIONS for real usability (audited, NOT yet built — see "Missing functions" below):
> (1) real outbound EMAIL delivery — every "send" (invoice/estimate/proposal/review-request/outreach/
> team-invite) only drafts to an in-app outbox; the only wired email path is the Gmail API behind the
> dead Firebase popup. Needs a server-side provider (Resend/SendGrid/SMTP). (2) address GEOCODING —
> zero in the codebase, so the map + route optimizer can't plot real jobs. (3) Google Calendar/Gmail/
> Contacts sync — all via the broken Firebase popup. Config blockers unchanged (network->supabase.co,
> service-role key, Gemini/Stripe/Twilio keys, JWT, confirm-email off, auth flags).
> Previously: 2026-06-29 (deferred features + QoL) — **shipped the Scheduler calendar view, a
> quality-of-life wave, and the three endpoint-backed features that were deferred.** Calendar: month
> grid w/ board toggle, click-day-to-schedule, status chips. QoL: confirm dialogs on all destructive
> actions, loading/empty states across the list screens, real Cmd+K entity search, keyboard-shortcut
> help, and the offline syncService now flushes to Supabase (was the dead Firestore). Deferred features
> NOW DONE (server + UI): Team invites (GET/POST /api/team[/invite|/remove], invite email w/ shareable
> link fallback + member list + remove), Client-portal Approve-Proposal + Invoice-PDF download
> (token-scoped /api/portal/{proposal/approve,invoice-pdf}), and the Platform-admin tenant console
> (/api/admin/tenants[/:id/tier], list + tier editing). Gates green throughout. NEXT: the security
> sprint. Previously: 2026-06-29 (feature-completeness sprint) — **swept every section for dead buttons,
> fake/hardcoded data, crashes, and missing functions, then fixed them in a 7-agent wave.** CRM
> (approved-lead status bug, real Tasks/Documents tabs, aiScore on create, removed fabricated columns
> + a crash), field ops (CrewSuite crash, Field Mode Start-Job/Photo/Audio/incident, real Route
> Optimizer + Resource Timeline + job reschedule), money (Mark Paid, Convert-to-Contract wiring the
> quote_approved trigger, inventory edit + forecast fix, real Reviews/Reports, Stripe no-fake-success),
> agent (Agent.tsx's 4 mockup tabs made real, AgentLabs failure states, workflow toggle persistence),
> and shell (dead Settings toggles removed, notification dots/rows, command palette, portal name +
> no fake payment). Server: invoice-PDF line items + /employee/ai-playground route. Gates green.
> DEFERRED (need new server endpoints / bigger builds, NOT yet done): SaaS-Admin tenant console
> (+/api/admin/tenants), Team invite (+/api/team/invite), Client-portal "approve proposal" +
> invoice-PDF download (token-scoped endpoints), full Scheduler calendar view. Security sprint is next.
> Previously: 2026-06-29 (HOA + automations) — **deepened HOA features and made the "agent
> workflows" real.** Two audits (HOA depth, agentic-function completeness) drove a wave: Field Mode
> now shows the crew the REAL gate code + the property's actual HOA rules (was hardcoded); CRM got a
> real "Edit Bylaws" editor + HOA fields in add/edit modals (is_hoa + data.{hoaRules,gateCode});
> Scheduler warns on HOA quiet-hours violations (no service before 9 AM). The big one: a new
> `src/lib/automations.ts` engine that actually EXECUTES the rules stored in
> tenant.settings.workflows (webhook proxy / flag-for-review task / AI follow-up draft) with real
> run metadata — previously rules were saved but never ran. Triggers wired on client_created /
> job_completed / invoice_paid; WorkflowBuilder now shows honest run stats. Design/annotate verified
> end-to-end (build_design_vision → DesignStudio MarkupCanvas). Gates green (tsc, 89 tests, build).
> Previously:_
> _2026-06-28 (cutover wave 2) — **finished the Firestore→Supabase cutover + killed
> silent data loss / fake data.** Three audits (frontend data paths, server.ts, fake/stub content)
> found ~25 components + several server routes still wrote to a dead Firestore project (writes lost;
> some screens showed FABRICATED business data as the user's own). Migrated all to `src/lib/repos/*`
> (new `tenantsRepo`/`timesheetsRepo`/`systemLogsRepo`), removed the fake fallbacks, moved server
> lead-intake/inbound-SMS/booking-name to Supabase, added the real GDPR account-deletion endpoint,
> removed the Stripe Firestore mirror, replaced random inventory alerts, capped cluster workers, and
> added a global error handler. Gates green (tsc, 89 tests, build). See **Part F+** below. Previously:_
> _2026-06-28 (later still) — **first-run experience hardened by mobile simulation.**
> Caught + fixed a production boot crash (Firebase init threw `auth/invalid-api-key` at module load
> when running Supabase-only → blank screen); made the guided walkthrough **tappable** (quick-reply
> chips so a tech-illiterate contractor never types during onboarding); fixed the onboarding progress
> bar (3 segments for a 4-step flow); and **hardened `/api/tenants/provision`** against invited-member
> role escalation. Verified the full new-user DB-build chain (signup trigger → onboarding gate →
> provision → idempotent rich seed) end-to-end. See **Part F → First-run** below. Previously:_
> _2026-06-28 (later) — **architecture decision changed to FULL SUPABASE AUTH** (see
> the backend note above). Landed: the Firebase→Supabase Auth migration (client + server + signup
> provisioning trigger), the **unified agent action executor** (Live Ear voice + copilot text both
> perform real RLS-scoped mutations: create contact/job/invoice/quote/expense, gate codes, inventory
> draws, etc.), and a batch of lost-import runtime-crash fixes (gate-photo flow, geofence, magic-link,
> TTS auth) + the job-status casing fix that was silently breaking Field Mode. **Next: Part F — the
> Firestore→repos screen cutover.** Earlier this session: added **Part E** (audit findings) and the
> quick-wins batch; before that: server hardening
> (playground gated, threats admin-only, fail-fast `JWT_SECRET`, IPv6 limiter, tenant-scoped caches,
> env-driven CSP), auth restoration behind `VITE_REQUIRE_AUTH`/`REQUIRE_AUTH` + the tenant
> provisioning endpoint, real billing (tenant-safe Stripe + `application_fee` + ACH + subscribe) and
> tier/credit-wallet metering, design/tiers catalog grounding + AI mock-mode 503 fallbacks, money-path
> UI fixes, tests + CI, frontend cleanup, README rewrite, and the missing Supabase migration (`0006`).
> Remaining: the full Firestore→Supabase page cutover and the human-only go-live blockers (§ A2 / README).
> Prior (2026-06-27): re-prioritized from the deep US market study (`MARKET_RESEARCH.md`) —
> QuickBooks/payments/recurring billing as launch table-stakes (A7); AI repositioned as on-site closing;
> added the Gemini-native build-leverage map + the beachhead._

## App audit remediation backlog (2026-06-29) — from `APP_AUDIT.md`

Derived from the section-by-section deep dive. **Full per-section detail (purpose/works/missing/
needs-research) is in `APP_AUDIT.md`** — this is the actionable, prioritized work list. Checkboxes
track the parallel remediation sprint.

### P0 — Honesty & trust (the #1 trust risk; buildable now)
Kill the "graceful fallback to success" pattern everywhere — never show "Synced!/Sent!/Review Sent"
when the call failed, was cancelled, or only simulated. The good sections (Client Portal, Booking,
Owner Digest, Inbox, Scheduler On-My-Way) prove the honest `simulated:true` pattern — make it global.
- [ ] **Dashboard** — Workspace/integration handlers show success on failure/cancel; Morning Briefing
      uses hardcoded Alpha/Beta/Gamma crews + "Schmidt Residence" placeholders (use real crew/job data).
- [ ] **CRM** — SMS claims "sent securely via Twilio" even when simulated (surface `simulated`);
      remove the fabricated property-value growth chart (invented numbers shown to a paying user).
- [ ] **Field & Crew (CrewSuite)** — dispatch shows success when it didn't.
- [ ] **Reviews** — "Deploy/Solicit/Review Sent" success-on-failure.
- [ ] **Metrics theater** — make real or remove: Inventory `$65/unit` valuation + `4.2% leakage` +
      "100% SECURE"; Agent "Runtime Stats" panel; SOC toggles that enforce nothing.

### P0 — Security & cost-abuse hot spots (buildable now)
- [ ] **`/api/live` WebSocket is unauthenticated** — open, unmetered Gemini + client-side tool exec.
      Add token auth on connection + per-tenant metering + a connection cap.
- [ ] Public lead-intake has no CAPTCHA/abuse guard — add rate-limit + a basic bot check.
- [ ] Client-side-only role gates (e.g. CRM CSV import) — enforce server-side/RLS.
- [ ] Raw browser Google Maps key handed to any client — restrict key (referrer) / proxy.
- [ ] Closeout high-risk invoice gate not enforced server-side.

### P0 — Geocoding layer (single highest-leverage enabler)
- [ ] No address→lat/lng anywhere → Route Optimizer unusable, CustomerMap re-geocodes each view,
      Scheduler jobs non-routable. Add **server-side geocode-on-write** (Google Geocoding,
      `GOOGLE_MAPS_PLATFORM_KEY`, mock-safe) caching lat/lng on the customer/job record. Unblocks 3 sections.

### P1 — Data integrity & analytics truth
- [ ] **Per-job linkage** — require `jobId`/`customerId` on timesheets, expenses, material logs, invoices
      at the source (clock-in-against-job, log-to-job, invoice-with-customer) so Job Costing / Customer
      Intelligence profitability / Closeout invoices stop falling back to estimates.
- [ ] Real per-customer **activity timeline** feeding the CRM AI briefing (today `interactions:[]` hardcoded).
- [ ] Dead/stub endpoints: remove or implement `/api/crm/clients` ({status:'ok'}); de-dupe the mock
      `/api/weather` route and wire the Dashboard to the real `{configured,...}` shape.

### P1 — Real-time / offline / notifications
- [ ] Inbox + Portal Messages are reload-only → add realtime/polling.
- [ ] Event notifications (email/SMS/push) on new invoice/message/approved-design/low-stock/arrival.
- [ ] Closeout (the field flow most likely to lose signal) should use the existing `syncService` offline queue.

### P1 — Data-seeding / ingestion
- [ ] Reviews: ingest from Google/Yelp (no ingestion today). CRM/Inventory: CSV import + **dedupe/merge**
      (re-import currently creates duplicates). Inbox: inbound email routing. Starter templates for
      Form Builder + Compliance.

### P1 — Field / mobile UX
- [ ] Crew-facing job view (start/complete, checklist, photos), before/after photo capture at closeout,
      geofenced clock-in, HEIC/EXIF intake, offline queueing.

### P2 — Brand / legacy-stack cleanup
- [ ] Reconcile multi-brand copy (YardWorx / Cutty / Meridian Green / Gaelworx AI) in user+legal text.
- [ ] Purge Firestore-era strings/shims in a Supabase app (Inventory/Reviews/CRM error strings, Form
      Builder Firebase import, AI Playground "infrastructure" test). Switch AI Playground to `fetchApi`.

### Research agenda (top 10 — see `APP_AUDIT.md` for full context; many gate live launch)
- [ ] 1. Property-measurement provider selection + economics (Nearmap/Regrid/EagleView/Google Solar) — gates Instant Estimate.
- [ ] 2. Geocoding provider + caching at SMB scale (+ Google Route Optimization API/VRP) — gates routing/maps.
- [ ] 3. Google restricted-scope / CASA security assessment (gmail/calendar/drive/contacts) — gates Workspace surface.
- [~] 4. SMS 10DLC/A2P + TCPA consent + two-party-consent (Live Ear) — gates Inbox/On-My-Way/CRM SMS/recording.
      **Research done → see `TEXT_CAMPAIGN_RESEARCH.md`.** **Text Campaign feature SHIPPED** (migration
      `0010`: customers.sms_consent/opt_out, customer_messages delivery cols, `sms_campaigns` +
      append-only `sms_consent_log`, RLS, 0 advisories): bulk send `/api/sms/send-bulk` (consent-filtered,
      STOP-footer, simulate-aware, per-recipient status), `/api/sms/consent`, `GET /api/sms/campaigns`,
      Twilio status callback `/api/public/sms/status`, inbound STOP/HELP/START handling, SMS channel on
      `/api/outbound/draft-personalized-campaign`, pure helpers `src/lib/smsCampaign.ts` (+tests), the
      `TextCampaigns.tsx` page (admin nav). **Design Studio × Text bridge SHIPPED**: `/api/sms/send-proposal`
      (texts a portal magic-link, MMS when live) + DesignStudio "Text Proposal to Client" + the
      "Has Design Vision" / "Proposal Not Approved" campaign segments. **Agentic auto-reply SHIPPED**:
      inbound webhook runs a grounded bounded reply (off/draft/auto modes), auto mode captures a booking
      as a REQUESTED job (never auto-invoices); `detectSmsCommand` hardened (HELP/START exact-match only).
      **10DLC onboarding SHIPPED**: migration `0011` `sms_registrations`, `GET/POST /api/sms/registration`
      + `/submit`, `Sms10DLCSetup.tsx` setup card (registration checklist + auto-reply selector).
      **Remaining (human/config):** real A2P carrier submission needs live Twilio keys + `TWILIO_ENABLE_A2P`
      (full brand/campaign vetting in the Twilio Console; decide ISV sub-account model); scheduling/queue;
      RCS rich messaging — see the phased plan in the research doc.
- [ ] 5. Stripe Connect economics & onboarding (Express vs Standard, fees, ACH) — gates the money path.
- [ ] 6. US sales-tax for landscaping + tax-engine buy decision (Avalara/TaxJar/Stripe Tax).
- [ ] 7. Live-key validation pass of all Gemini features on Cloud Run (Design Studio flagship first).
- [ ] 8. Competitor parity benchmark (Jobber/ServiceTitan/Aspire/Housecall/LawnStarter/SingleOps).
- [ ] 9. Legal review of trust/compliance copy (DataMap data-sale + CCPA/CPRA, AI Usage "binding" terms, review-gating FTC/Google).
- [ ] 10. Validated churn signals + labor-burden/overhead model for green industry (Customer Intel / Job Costing / Owner Digest).

## How to use this file

- **Launch model:** lean **MVP to first paying client (Part A)**, then **fast-follow (Part B)**,
  then **scale/hardening (Part C)**. **Part A is the gate** — nothing ships until it's done.
- **Audience:** broad, **tier-gated** (free / pro / enterprise). Build features once, gate by tier.
- **Billing:** **both** — landscapers pay YardWorx a subscription *and* use Stripe Connect to bill
  their own customers.
- Priority legend: 🔴 **blocker** (can't launch) · 🟠 **risky** (breaks/degrades in real prod or at
  scale) · 🟢 **feature/polish** (value-add & de-uglify).

> **Backend architecture (DECISION CHANGED 2026-06-28): FULL SUPABASE.** Auth moved from
> Firebase to **native Supabase Auth** (email/password + magic link); **DATA = Supabase Postgres + RLS**.
> RLS keys on the Supabase JWT `sub` (the user UID) matched to `profiles.firebase_uid` (column kept its
> historical name; it now stores the Supabase UID) via the `private.auth_tenant_id/auth_role/is_platform_admin`
> helpers. A `handle_new_user` trigger auto-provisions a tenant + owner profile on signup. The Express
> server verifies the Supabase JWT (`auth.getUser(token)`, anon client). Firebase is retained only for
> optional **Storage**. Project `bzpxudpmksnawmaanxal` — **0 security advisories**.
> **DONE:** auth swap (client + server), provisioning trigger, the unified agent action executor
> (voice **and** text agents perform real RLS-scoped mutations).
> **REMAINING (the cutover): the ~10 screens still read/write Firestore** — migrate them to
> `src/lib/repos/*` so real data + the agent's writes are visible. See **Part F** below.

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

- [~] 🟡 **QuickBooks sync (one-way) — wired, pending sandbox verification.** Built the OAuth connect
  flow (`/api/quickbooks/connect|callback|status`) + a one-way **customers** push (`/api/quickbooks/sync`)
  with token refresh; tokens stored in the service-role-only `integrations` table (migration 0009, RLS,
  advisors=0). Settings has a Connect/Sync UI; env `QBO_*`. Guard-path tested. **Remaining (needs Intuit
  sandbox creds): verify live token exchange + entity mapping, then add invoices/items/payments + nightly
  sync.** Two-way is a later stickiness follow-up.
- [ ] **Online payments to the contractor's customers** — card + **ACH** on invoices (extends the
  existing Stripe Connect wiring); branded invoice sent on job completion via SMS/email.
- [x] ✅ **Recurring / seasonal billing** — `POST /api/stripe/recurring/checkout` creates a
  subscription-mode Stripe Checkout on the contractor's connected account (weekly→yearly intervals)
  with the platform `application_fee_percent`; tenant-safe, simulated without keys. UI: a "Recurring"
  action per invoice in `Invoices.tsx`. Tested. _Follow-up: contract auto-renew + manage/cancel UI._
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
- [x] ✅ **Two-way SMS (inbound path)** — outbound (`/api/sms/send`) plus a new Twilio inbound
  webhook `POST /api/public/sms/inbound` (form-encoded, registered before the JSON gate,
  signature-verified when `TWILIO_AUTH_TOKEN` set, timeout-guarded), persisting to
  `inbound_messages`. Tested. _Follow-up: per-tenant number routing (match `To`→tenant) + a
  conversation-thread UI in CRM/ClientPortal (reuse the `messages`/`customer_messages` tables)._
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
  invoices/crews/leads) are now real. `AlertsWidget` now shows REAL action items (overdue/open
  invoices + leads awaiting follow-up) with an "All clear" empty state — no Dashboard widget renders
  fabricated data anymore. _Optional later: add weather/equipment signals to the alert feed._
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

---

## Part F — Firestore → Supabase cutover (the remaining gate) 🔴

Auth + the agent executor are on Supabase; these screens still read/write **Firestore**, so real
data and the agent's writes don't show. Migrate each to `src/lib/repos/*` (RLS-scoped; `subscribe()`
replaces `onSnapshot`, `create/update/remove` replace `addDoc/updateDoc/deleteDoc`). Repos return
**camelCase** (so most field reads keep working) and snake-ize writes; **drop `tenantId`** from
reads/writes (RLS handles it) and `serverTimestamp()` (DB defaults). Job status is **UPPERCASE**
(`SCHEDULED|IN_PROGRESS|COMPLETED`). Verify each screen logged-in before moving on.

- [x] **CRM** (`src/pages/CRM.tsx`) — `customers` (→ `customersRepo`) + `knowledge` (→ `knowledgeRepo`). DONE.
      ~14 customer call sites incl. a dynamic-path `addDoc` (`:787`) and bulk import (`:864/:933`).
      This is where the agent's `create_contact`/`load_client_data`/`add_client_note`/`set_gate_code` land.
- [x] **Scheduler** (`src/pages/Scheduler.tsx`) — `jobs` → `jobsRepo` (+ its auto-invoice → `invoicesRepo`). DONE.
- [x] **Invoices** (`src/pages/Invoices.tsx`) — `invoices` → `invoicesRepo`, `expenses` → `expensesRepo`
      (agent `create_invoice`/`create_quote`/`log_expense`). Status lowercased on read; agent now writes
      `data.client` + `"draft"`. DONE.
- [x] **Inventory** (`src/pages/Inventory.tsx`) — `inventory` → `inventoryRepo`, `materialLogs` →
      `materialLogsRepo` (added to repos/index). DONE. NOTE: the inventory offline syncService path
      (Firestore-targeted) is bypassed — re-add an offline queue against Supabase later if needed.
- [x] **CrewSuite** (`src/pages/CrewSuite.tsx`) — `crews` → `crewsRepo`. DONE. (TimeClock `timesheets`
      still on Firestore; `employees` table / `employeesRepo` for `load_employee_data` still TODO.)
- [x] **Reviews** (`src/pages/Reviews.tsx`) — `reviews` → `reviewsRepo`. DONE.
- [x] **FieldModeInterface** (`src/components/FieldModeInterface.tsx`) — active-job + completion write
      → `jobsRepo` (photos/notes/variance in job `data`); `inspection_forms` → `inspectionFormsRepo`;
      gate code surfaced from the linked customer's `data.gateCode`. DONE.
- [x] **Portfolio** (`src/pages/Portfolio.tsx`) — completed jobs → `jobsRepo` (status COMPLETED +
      `data.departurePhotoUrl`). DONE.
- [x] **Dashboard** (`src/pages/Dashboard.tsx`) — crews/leads/vendors/invoices reads + customer create
      → repos. DONE.
- [x] **ClientPortal** (`src/pages/ClientPortal.tsx`) — DONE, and **secured**: rebuilt as a
      capability-token, server-proxied portal (`/api/portal/{data,message,checkout}`), no direct DB
      / no localStorage-only authz; real jobs/invoices/designs/messages; fabricated proposal removed.
      `magic-link/generate` now owner-authed + tenant-scoped. **Requires `SUPABASE_SERVICE_ROLE_KEY`**
      on the server to run. (Stripe checkout + invoice-paid webhook also moved to Supabase.)

### First-run experience (new-user onboarding + walkthrough) — verified by mobile sim
> Simulated the new-user journey headless on a 390×844 viewport in the tech-illiterate-contractor
> mindset. The chain is: signup → `handle_new_user` trigger (fresh tenant + owner profile,
> `agreements_accepted=false`, `legal.aiDisclaimerAccepted=false`) → App.tsx gate shows `Onboarding.tsx`
> → `POST /api/tenants/provision` (sets agreements + disclaimer, idempotently seeds rich starter data)
> → Dashboard → `Layout` auto-opens the `CuttyChat` walkthrough after 2.5s → tour prompt → property
> type → bottleneck → dashboard personalization → guided `CuttyGuide` tour.
- [x] **Boot crash fixed.** `src/lib/firebase.ts` called `initializeAuth()` with an empty apiKey →
      `auth/invalid-api-key` thrown at module load → blank app in Supabase-only mode. Now Firestore
      (projectId-only) always inits so legacy `collection(db,…)` calls don't throw at render;
      auth/storage/analytics guarded behind a real apiKey; exports keep their non-null type contract.
- [x] **Walkthrough is tappable.** Added big quick-reply chips for every guided stage
      (disclaimer / tour prompt / property type / bottleneck) in `CuttyChat.tsx` — no typing required.
      `handleQuery` takes an `overrideText` so chips drive the state machine; keyboard/voice still work.
- [x] **Onboarding progress bar** fixed (`[1,2,3]` → `[1,2,3,4]` for the 4-step flow).
- [x] **Provision hardened** against invited-member role escalation: preserves an existing profile's
      role (only brand-new self-serve signups default to `owner`); a non-owner can only record their
      own disclaimer acceptance, not clobber tenant fields or seed demo data.
- [x] **DB seed verified rich + idempotent:** 3 customers (HOA rules + gate codes in `data`), 3 jobs
      (SCHEDULED/IN_PROGRESS/COMPLETED), 2 crews, 2 leads, 2 vendors, 5 inventory items, 2 invoices.
- [ ] **Invited-employee onboarding UX** — an invited employee currently sees the *owner* business-setup
      form (now harmless server-side, but wrong UX). Route non-owners to a lighter agreements-only step.
- [ ] **Live-key tour pass** — re-run the sim against a real Gemini/Supabase key to confirm the tour
      tooltips render the step copy (sim showed the spotlight; a stray demo toast overlapped it).

### Part F+ — second cutover wave (audit-driven) — DONE this session
> Three audits (frontend data paths, server.ts, fake/stub content) found the real remaining
> production gap was **silent data loss**: ~25 components + several server routes still wrote
> to / read from the dead Firestore project, and some screens fell back to FABRICATED business
> data shown as the user's own. All migrated to `src/lib/repos/*`; fake fallbacks removed.
- [x] **tenant-settings writers** — Settings, ServicePricingCatalog, IntegrationSettings,
      WorkflowBuilderSection, StripeConnectSection, DisclaimerModal -> `tenantsRepo` (JSONB merge; no Firestore dot-paths).
- [x] **CRM writers** — LeadSubmissionModal/LeadVerificationPanel/Pipeline/CRMCustomFields -> `customersRepo`;
      VoiceMemoJobModal -> `jobsRepo`; CuttyChat dead firebase imports removed.
- [x] **TimeClock -> `timesheetsRepo`** (payroll no longer dropped); **Reports** -> systemLogs/customers/jobs repos;
      **FormBuilder/DesignStudio/DesignDatabasePanel** -> inspectionForms/designCatalog repos.
- [x] **Inventory/analytics** — ResourceAssignmentModal/InventoryForecast/LiveInventoryFeed,
      LossLeaderAnalyzer/AgenticOutreachDrawer/brainService -> real repos.
- [x] **Removed fabricated data** shown as the user's own: LossLeader P&L, outreach sample leads,
      LiveInventory mock ticker, DailyBriefing fake earnings, Dashboard "3 crews"/fake vendor invoices/
      disruption shields, CRM "Mrs. Gable" note-seeding button.
- [x] **Server**: lead-intake + inbound SMS + public booking name moved Firestore->Supabase (with tenant
      validation); Stripe webhook Firestore mirror removed; outbound SMS persists; real inventory low-stock
      query (was `Math.random()`); cluster workers capped to CPU grant; global error handler + process guards.
- [x] **Account deletion** — `POST /api/account/delete` (owner-only, cascade + `auth.admin.deleteUser`)
      wired to the Settings delete button (was a no-op that falsely claimed success). GDPR/CCPA.
- [x] New repos: `tenantsRepo` (JSONB merge), `timesheetsRepo`, `systemLogsRepo`.

### Auth follow-ups (post-switch) — still open
- [ ] **"Connect Google" buttons** still call Firebase `signInWithPopup` for Calendar/Gmail scopes
      (CRM, DesignStudio, Dashboard, Invoices, CrewSuite). Rework via Google OAuth, or hide until ready.
- [ ] **ClientPortal** still uses `auth.onAuthStateChanged` (Firebase) — vestigial (portal uses token auth). Remove.
- [ ] **`src/services/syncService.ts` offline queue still targets Firestore** — offline mutations won't flush
      to Supabase. Rework to dispatch per-collection repo writes (the one deferred Medium from this wave).
- [ ] **Multi-tenant Twilio inbound routing** — inbound SMS now persists to `customer_messages` by matching
      the sender phone to a UNIQUE customer; multi-number/by-`To` tenant routing needs a phone→tenant registry.
- [ ] **Stripe webhook idempotency** is per-worker in-memory — fine for tier flips; a `stripe_events` table
      would make it correct across cluster workers.
- [ ] **Low-value server stubs** — `/api/analytics/telemetry-export` (mock pool) + `/api/revenue/audit`
      (fabricated) have no confirmed app consumers; wire to real Supabase aggregates or remove.
- [ ] **AiPlayground "Test Database"** telemetry write (dev diagnostic) — drop or repoint.

### Human-only (you)
- [ ] Supabase dashboard → **Auth → Email**: turn off "Confirm email" (or set SMTP) for instant signup.
- [ ] Put the **service-role key** in the server env (`SUPABASE_SERVICE_ROLE_KEY`) for server-side
      tenant lookups + AI credit metering.
- [ ] Set `VITE_REQUIRE_AUTH=true` + `REQUIRE_AUTH=true` to enforce the real auth gate.

---

## Missing functions for real usability (audited 2026-06-29)

Core CRUD/screens are functionally present and crawl-clean. These are the genuinely
MISSING functions a real contractor needs, in priority order:

- [x] **Outbound EMAIL delivery (highest leverage).** ✅ DONE — added `sendEmail()` +
      `POST /api/email/send` (Resend via `RESEND_API_KEY`/`EMAIL_FROM`, honest
      `{simulated:true}` fallback when unconfigured). WorkspaceOutbox now SENDS per-item
      (and Send-All) through it with sent/draft/sending/failed states — no faked success.
      _Remaining wiring: also point invoice "send" + client-portal proposal at it (today
      they still draft to the outbox)._
- [ ] **Address geocoding.** Zero geocoding in the codebase → customers/jobs never get
      lat/lng → the map + Route Optimizer can't plot real stops (optimization only runs
      for jobs that already have coords, which none do). Add geocode-on-save (Google
      Geocoding API) for customer/job addresses.
- [ ] **Google Calendar / Gmail / Contacts sync.** All via the Firebase Google popup,
      which is dead under Supabase Auth (now guarded so it no longer crashes — just
      toasts "not configured"). Rework via server-side Google OAuth, or hide until ready.

Already present (do NOT re-list as missing): recurring/seasonal billing
(`/api/stripe/recurring/checkout`), SMS send (Twilio when configured), payments,
client portal (view/pay/approve/PDF), AI agent (voice+text), automations engine,
team invites, admin tenant console, account deletion, offline sync.

---

## Feature wave — SHIPPED 2026-06-29 (research-driven, gated green)

Built off `PRODUCT_RESEARCH_2026.md`. All six landed lint+test+build green (89 tests),
wired into routes (`App.tsx`) and the sidebar (`Layout.tsx`).

- [x] **Outbound email** — `sendEmail()` + `POST /api/email/send` (Resend) + WorkspaceOutbox
      send/Send-All with honest unconfigured fallback.
- [x] **"Tailgate Closeout" flagship** (`src/pages/Closeout.tsx` + `src/components/closeout/*`)
      — voice → `POST /api/agent/closeout` → risk-tiered `ActionCard` stack (low pre-checked,
      high invoice = explicit confirm) → execute via repos → Gmail-style `UndoChip` (~12s).
      Reusable `ActionCard` primitive discriminated by `action.type`.
- [x] **Job Costing** (`src/pages/JobCosting.tsx`) — real-time estimate-vs-actual margins from
      jobs/invoices/expenses/timesheets/material-logs; per-job margin table + blended summary;
      honest "est." labels where per-job cost can't be resolved.
- [x] **Chemical / pesticide application log** (Compliance tab + `complianceLogsRepo` + new
      Supabase `compliance_logs` table w/ RLS, 0 advisories) — regulatory must-have for turf/tree.
- [x] **Public online booking widget** (`src/pages/BookingIntake.tsx`, `/book/:tenantId`) —
      branded form → `/api/public/tenant/:id` + `/api/public/lead-intake` (no-auth), with
      503/loading/success states + validation.
- [x] **Instant Estimate** (`src/components/InstantEstimate.tsx` + `src/pages/EstimateStudio.tsx`)
      — address → `POST /api/measure/property` (provider-pluggable, honest AI-estimate badge) →
      suggested quote → create draft estimate. _Aerial measurement provider still a config blocker._

## Owner-intelligence wave — SHIPPED 2026-06-29 (gated green, 89 tests)

New server endpoints `POST /api/agent/owner-digest` + `POST /api/agent/save-play` (Gemini, mock-safe).

- [x] **Customer Intelligence** (`src/pages/CustomerIntelligence.tsx`) — churn-risk radar (health
      score + reasons) + per-customer profitability/LTV with margin verdicts and AI "save play"
      (`/api/agent/save-play`, optional emailed send). Covers 2 find-more items.
- [x] **Owner Digest** (`src/pages/OwnerDigest.tsx`) — AI "state of your business" brief from
      client-computed aggregates (`/api/agent/owner-digest`), period toggle, email-me. Honest
      metrics (utilization omitted when underivable).
- [x] **Before/After gallery + review prompt** (Portfolio) — arrival vs departure photos grouped by
      property; per-customer review request; slideshow kept intact.
- [x] Wired admin routes (`customer-intel`, `owner-digest`) + sidebar nav (Activity / FileText icons).

## Design Studio overhaul — SHIPPED 2026-06-29 (gated green, 103 tests)

Whole-feature audit + reliability + new features + the **real flagship region-aware placement engine**.
Full engineering spec: **`DESIGN_STUDIO_PLAN.md`** (verified 2026 AI contract + 10-step flawless
process + phased plan + must-test risks). Commits: `ff9b25f`, `e4aaa2f`, `c942172`.

**Reliability (done):**
- [x] `response.ok` guards + honest error/info toasts on `processDesign` / `generateMockup` /
      `generateTiers` (were silent `console.error`); mock mode now says "AI rendering needs a Gemini
      key" instead of echoing the photo as a no-op; removed dead top-level `data.estimatedCost` line.
- [x] **Image-cache bug fixed** (`server.ts`): the `generateContent` cache stored only `.text`, so a
      repeat IMAGE request returned no `candidates` → blank render. Image requests now bypass cache.
- [x] **BeforeAfterSlider** — respect `imageAspectRatio` (no more `object-fill` stretch), keyboard
      a11y (arrows/Home/End), broken-image fallback.

**New features (done):**
- [x] **Attach a client** picker in the studio (bind visions/quotes without agent navigation).
- [x] **Send Design to Client** — emails the vision via `/api/email/send` (honest simulated/draft).
- [x] **Regenerate (Redo) + Download** on the render panel.
- [x] **Catalog DB inline Edit** (`DesignDatabasePanel` — was create/delete only; now uses
      `designCatalogRepo.update` + validation).

**Phase 0 placement engine — the "draw a circle → place THAT object exactly there" flagship (done):**
- [x] `src/lib/canvasGeometry.ts` (+14 Vitest cases) — pure contain→normalized coord math;
      `regionFromBBox`; `describeRegion`.
- [x] **MarkupCanvas** tags circle/box (`add`) and X (`remove`) shapes; on finalize emits semantic
      `regions[]` (normalized 0..1) + the **clean** photo (no burned-in marks) via a `MarkupPayload`.
- [x] **`POST /api/design/place-objects`** — clean photo + numbered per-region instruction
      (`describeRegion`) → `gemini-2.5-flash-image`; parts order **refs → yard (last) → text** +
      `imageConfig.aspectRatio`; mock parity (echo photo); honest errors.
- [x] **DesignStudio** — per-region "what goes here" labels; `generateMockup` routes through
      place-objects when regions exist, then **composites the model output back over the
      byte-identical original through a feathered region mask (client-side)** so nothing outside the
      regions changes (THE guarantee); whole-image restyle kept as fallback; unified FAB.

**Verified AI contract (the decisive findings — see `DESIGN_STUDIO_PLAN.md`):**
- NO first-party Google mask-inpaint exists (Imagen mask-inpaint was Vertex-only AND shut down
  2026-06-24); `gemini-2.5-flash-image` is **instruction-only** (no mask/bbox/editMode field).
- The "rest-of-scene-unchanged" guarantee is a **feathered-mask composite**, not a prompt/marker.
- Parts order **refs → yard last → text last** (output adopts the yard's aspect ratio).
- Gemini-native **segmentation** (`box_2d` + PNG) is free from the same SDK; SynthID watermark on
  output; ~$0.039/image; `MAX_REFS=2` (dev-API cap unconfirmed); model **EOL Oct 2 2026**.

**HONEST caveats / blockers:**
- ⚠️ **Real-model behavior is UNVERIFIED in this sandbox** — the network policy blocks Gemini egress,
  so the placement engine is built to the verified contract + gated-green + mock-safe, but actual
  render quality needs a live `GEMINI_API_KEY` to validate (must-test-first risks in the plan §8).
- Chose **client-side composite** for Phase 0 (zero new deps, gate-verifiable). The stronger
  **server-side `sharp` composite + SCENE_PRESERVED assertion** is the recommended hardening —
  deferred because `sharp` is a native dep with a flagged Cloud Run build risk (needs human verify).

**Design Studio — ALL PHASES BUILT (to the extent buildable without provider keys; detail in `DESIGN_STUDIO_PLAN.md`):**
- [x] **Phase 1 — Snap/verify/iterate:** `/api/design/segment` surface-snap (+ "Smart Snap" toggle);
      `/api/design/judge` VLM auto-verify + bounded retry (fixHint into prompt; mock→PASS); undo/redo
      via `designSession.ts` (+13 tests), iteration feeds the composited HEAD. _Storage-backed
      `DesignSession` persistence + per-tenant image budget remain follow-ups (need Firestore wiring)._
- [x] **Phase 2 — Grounding & economics:** `plantCatalogSeed.ts` (36 species) + `selectPlants` +
      `resolveZone`; `SuggestedPalette` → priced zone-fit palette → Apply (fills spots + merges
      deterministic line items); AI-viz badge + disclaimer in proposal PDF; provenance on saved visions.
      _Perenual/USDA-PLANTS commercial catalog import remains a `[key]` follow-up._
- [x] **Phase 3 — crop-and-paste-back v2** ("Precise" toggle, `cropPlaceRender`). ⛔ Depth Anything v2
      + shadow/intrinsic harmonization remain PROVIDER-GATED (self-hosted depth/GPU) — documented, not built.
- [ ] **Server-side `sharp` composite** hardening (Dockerfile + Cloud Run binary verify) — the
      flagged-blocking upgrade that makes "rest unchanged" server-enforced (currently client-side).
- [ ] Fix `reopenVision` snake/camel mismatch so saved visions reload (`DesignStudio.tsx`).
- [ ] Design3D maps procedural primitives only (doesn't use the uploaded photo) — conceptual; map the
      photo onto a ground plane later.

## Discovered backlog — "find more" pass (2026-06-29)

Twelve genuinely-new, high-value ideas surfaced by a parallel gap-audit agent (grounded in repo
greps + 2026 market data). Effort: S/M/L.

> **SPRINT UPDATE 2026-06-29 — 7 of 12 SHIPPED** (all gated green, pushed):
> ✅ Referral & advocacy engine (`src/pages/Referrals.tsx` + `referrals` table) ·
> ✅ On-My-Way arrival ETA (`src/components/OnMyWayButton.tsx`, wired into Scheduler) ·
> ✅ Customer health/churn radar + ✅ per-customer profitability/LTV (`CustomerIntelligence.tsx`) ·
> ✅ Equipment/fleet maintenance tracker (`src/pages/Equipment.tsx` + `equipment` table) ·
> ✅ Unified conversation inbox (`src/pages/Inbox.tsx` + `customerMessagesRepo`) ·
> ✅ AI owner digest (`src/pages/OwnerDigest.tsx`) · ✅ Before/after gallery (Portfolio).
> Plus: ✅ Business Defaults in Settings (laborRate/ratePerSqft/zone/ownerEmail) so the
> features are contractor-configurable; ✅ QA smoke crawl (18/19 routes crash-clean).
> **REMAINING (5):** push notifications [config: FCM/VAPID], weather auto-reschedule
> [config: OPENWEATHER], card-on-file auto-charge [config: Stripe SetupIntent], property/
> address enrichment [buildable — note `/api/crm/enrich` already exists], and the referral
> "credit on first paid invoice" automation (the engine + tracking shipped; auto-credit is
> the follow-up). Original list retained below for detail.

- [ ] **Referral & advocacy engine** (M) — _Retention/growth (CRM + Reviews)._ Zero referral/
      loyalty code exists; auto-fire a trackable referral offer + share-link when a customer
      leaves 4–5★, credit the referrer on the referred customer's first paid invoice, leaderboard
      in CRM. Near-free CAC reduction on top of the new outbound email/SMS.
- [ ] **Real push notifications (web-push/FCM)** (M) — _PWA + server._ Only the FCM
      `messagingSenderId` config string exists (`src/lib/firebase.ts:17`); no token registration,
      SW push handler, or send path. Lights up crew dispatch, route-change, payment, low-stock,
      arrival, and reminder flows at once.
- [ ] **Crew "On My Way" arrival ETA to customer** (S) — _Field Mode + portal._ Field Mode +
      CrewSuite have live location but no customer-facing arrival ping (only a hardcoded Dashboard
      one-liner, `Dashboard.tsx:1054`). One-tap → text customer arrival window + crew + tracking
      link. Reuses geofencing, Twilio, and the secured portal token.
- [ ] **Customer health score + churn-risk radar** (M) — _CRM + Contracts._ `at_risk`/
      `pending_renewal` are manual statuses nothing computes. Score from existing Supabase data
      (days since last job, declined visits, overdue invoices, review sentiment, responsiveness)
      → "who's about to leave" list + AI-drafted save play. Differentiated owner intelligence.
- [ ] **Per-customer / per-route profitability + LTV (loss-leader detector)** (M) — _Reports/
      JobCosting._ `LossLeaderAnalyzer` is aggregate-only; JobCosting is per-job. Roll up costing +
      drive time + invoices per customer into LTV/margin ranking with fire/raise/keep guidance.
      Justifies the Pro tier.
- [ ] **Equipment & vehicle maintenance tracker** (M) — _new module._ Crews/equip are just strings
      on the Crew type (`types.ts:9`); no asset model or service log. Hour/mileage logging (via
      Field Mode + barcode scanner) + predictive "service due" reminders. Distinct from deferred GPS
      telematics — this is the asset/maintenance ledger, and it feeds true job-costing.
- [ ] **Unified two-way conversation inbox (SMS + email + portal)** (M) — _CRM._ Inbound SMS
      (`customer_messages`, `server.ts:548`), portal posts, and outbound email are three fragmented
      surfaces. One chronological per-customer thread + AI-suggested replies. Core daily-use surface
      Jobber/Housecall ship.
- [ ] **Weather-triggered auto-reschedule cascade** (M) — _automations + Scheduler._ Weather is
      passive-advisory only (`server.ts:2867`). On high rain/wind forecast, propose one-tap bulk
      reschedule of affected outdoor jobs to next open slot + notify customers. Reuses OPENWEATHER +
      automations engine + Scheduler. Distinct from deferred snow-dispatch.
- [ ] **Before/after property photo gallery + auto review prompt** (S) — _Portfolio + portal._
      Departure photos (`departurePhotoUrl`) are captured but not assembled into a per-property
      visual timeline. Reuse `BeforeAfterSlider` + Firebase Storage → retention proof, Design Studio
      upsell hook, and the perfect attachment for the automated review request.
- [ ] **Card-on-file + auto-charge for recurring maintenance** (M) — _Stripe/Contracts._ Recurring
      checkout exists but bounces the customer to checkout each cycle; no SetupIntent/off-session
      charge. Card-on-file is the biggest cash-flow/DSO win for mow routes; pairs with the Closeout
      invoice action. Extends the existing Connect wiring.
- [ ] **AI quarterly/weekly owner digest** (S) — _Reports + agent._ There's a DailyBriefing but no
      periodic narrative "state of your business" (revenue vs last period, margin movers, at-risk
      customers, upsell ops, crew utilization, overdue AR) emailed out. Gemini long-context over
      existing aggregates; strong anti-churn-of-the-SaaS, gateable to Pro/Enterprise.
- [ ] **Property enrichment + "first quote" pack from address** (M) — _CRM + Design Studio._ On new
      lead, use Gemini Search + Maps grounding (already wired, `server.ts:1607`/`3187`) to enrich
      property (lot-size band, HOA hints, hardiness zone, comparable jobs) and pre-draft a
      good/better/best proposal. Reinforces "close in the driveway" without the heavy aerial build.

## Simulation pass — fixes (2026-06-29)

Full-app simulation (3 parallel trace agents over money path / server endpoints / core flows +
a 40-route Puppeteer smoke crawl across all portals). **Smoke result: 40/40 routes crash-clean.**
Gates after fixes: `tsc --noEmit` clean, **172 tests** (added `src/lib/payments.test.ts`), server
bundles, vitest green.

### FIXED this pass ✅
- [x] **[P0] Stripe webhook wrote off partial payments** (`server.ts` `checkout.session.completed`).
      It set `status:"paid"` for ANY amount and never updated `data.amountPaid` → a $50 payment on a
      $500 invoice marked it fully paid and lost $450, and left the client able to be charged again.
      Now reads the invoice, accumulates `data.amountPaid` from `session.amount_total`, merges the
      `data` jsonb (a column write replaces it wholesale), appends to `payments[]`, and only marks
      `paid` when the balance is settled (else `partial`).
- [x] **[P1] Cash "Mark Paid" left `amountPaid` stale** (`Invoices.tsx handleMarkPaid`). Now stamps
      `data.amountPaid = total`, so AR "collected", the portal balance, and the checkout guard agree.
- [x] **[P1] AR "collected" undercounted** — same root cause as above; fixed by the two ledger writes.
- [x] **[P1] Portal could re-charge a settled invoice** (`/api/portal/checkout`). Added an explicit
      `status` check → 409 on already paid/void/cancelled invoices (defense-in-depth on top of the
      now-correct `amountPaid` math).
- [x] **[P1] ~16 API routes shadowed by SPA serving.** `app.use(vite.middlewares)` (dev) and the
      prod `app.get("*all")` SPA catch-all were registered BEFORE later `/api/*` routes, so GET
      `/api/portal/data`, `/api/team`, `/api/admin/tenants` returned index.html in production and all
      POST routes after the mount were dead in dev. Both now skip `/api/*` (`req.path.startsWith`).
- [x] **[P1] Editing a customer/job address never re-geocoded** (`repos/index.ts`). Added `update`
      overrides to `customersRepo`/`jobsRepo` that re-geocode on address change (lat/lng stayed stale).
- [x] **[P1] Mock-mode 500s** — `parseGeminiJson` threw on the generic mock prose for any AI route
      whose system-instruction had no `getMockText` matcher (e.g. `/api/compliance/check`). `getMockText`
      now returns `{}` when the caller expects JSON, so mock/demo mode never 500s on unmatched routes.
- [x] **[P2] AR aging never aged no-due-date invoices** (`Invoices.tsx arAging`) — contract
      auto-invoices have no `dueDate` so they sat in "Current" forever and dodged reminders. Now falls
      back to `inv.date`/`created_at`.
- [x] **[P2] Possible duplicate contract invoice on date drift** (`Scheduler.tsx
      finalizeContractBilling`) — match now normalizes both sides to `YYYY-MM-DD` (`.slice(0,10)`).
- [x] **[P2] Overpayment inflated AR "collected"** (`Invoices.tsx handleRecordPayment`) — extracted
      `src/lib/payments.ts` (`applyPayment`/`invoiceBalance`/`agingBucket`, unit-tested) that clamps a
      payment to the remaining balance; wired into the handler.
- [x] **[P2] `$NaN` invoice totals** — two inline line-item reducers multiplied `rate*quantity`
      without `Number()` guards (`Invoices.tsx`); now `(Number(rate)||0)*(Number(qty)||0)`.
- [x] **[P2] Empty service-catalog crash** (`ServicePricingCatalog.tsx addCustomService`) — guarded
      `catalog[0]?.name` + early-return on empty catalog.
- [x] **[P2] Unguarded request bodies → caught 500s leaking internal error strings** — added input
      validation (400s) to `/api/crm/draft-proposal`, `/api/scheduler/draft-notification`,
      `/api/reports/predictive-maintenance`, `/api/inventory/forecast`,
      `/api/outbound/draft-personalized-campaign`, `/api/outbound/simulate-call`.

### DEFERRED (logged, not yet fixed)
- [ ] **[P2] `nextInvoiceNumber()` is racy** (`Invoices.tsx`) — computed from the in-memory list, so
      two fast/concurrent creates can collide. Needs a DB sequence or unique constraint to fix properly.
- [ ] **[P2] Auto-billed contract invoices have no `number`** — they label as `INV-<id slice>` and
      skip sequential numbering. Decide: stamp a number on the auto-billed path, or accept hash labels.
- [ ] **[P2] First recurring visit can be dated "today" and immediately invoiced** (`recurring.ts`
      anchor clamps to today for past `start_date`). Decide whether `i=0`=today should be billable.
- [ ] **[P2] Circle placement radius uses an inconsistent normalization denominator**
      (`canvasGeometry.ts` `regionFromBBox` circle: `min(nw,nh)/2` vs consumers `* max(W,H)`). Mild
      footprint error on wide images; store radius in one explicit space.
- [ ] **[P2] Design Studio "Refine" discards the prior materials/tier estimate on re-finalize**
      (`DesignStudio.tsx`) — merge new analysis into the prior result instead of replacing.
- [ ] **[P2] `/api/workflows/*` ignore mock mode** — `/api/workflows/proposal` uses a raw `fetch` to
      the Gemini REST endpoint (hard-fails without a key); route it through the mocked `ai` client so
      the proposal workflow is demoable in mock mode like every other AI route.
- [ ] **[note] `PORT` hardcoded to 3000** (`server.ts`) — ignores `process.env.PORT`; Cloud Run injects
      `$PORT`. Confirm the deploy maps 3000 or switch to `process.env.PORT || 3000`.
