# YardWorx — Ship-Ready Launch Checklist

<!-- MARKET GAP ANALYSIS (2026-07-02) — grounded in MARKET_RESEARCH.md + a code inventory.
Verdict: table-stakes are LARGELY MET. Confirmed already-shipped: CRM, scheduler, invoicing,
estimate→invoice, partial/deposit payments, Stripe card + **ACH** (us_bank_account already on
/api/stripe/checkout:2215), recurring contracts + per-contract visit/invoice generation, AI
payment-chaser, online booking (/book), instant estimate, client portal + magic links, route
optimizer, inventory, reviews loop, Design Studio, Live Ear, Cutty, job costing, timesheets,
referrals, equipment, unified inbox, offline/PWA, QuickBooks (one-way), Twilio SMS, property-measure
scaffold (AI fallback + provider-pending).
GENUINE GAPS — ALL SHIPPED this wave (459 tests, tsc clean, build OK):
  [x][P0] E-signature on estimates — the "sign it in the driveway" close. Server endpoint
       POST /api/portal/estimate/sign + reusable SignaturePad.tsx (canvas draw + typed fallback)
       wired into the client portal (customer signs on their phone → estimate flips to "accepted")
       AND owner Invoices (customer signs on the owner's tablet on-site, written via the repo).
  [x][P1] Payroll export — src/lib/payroll.ts (per-worker regular/OT hours, weekly-40 OT, 17 tests)
       + a Payroll tab in Reports with date-range + CSV export.
  [x][P1] Batch "Bill This Cycle" — one idempotent click drafts this period's invoices for every
       active recurring contract (two-layer dup-guard + partial-failure safe); recurring.ts helpers tested.
DEFERRED (need a paid vendor / more scope): aerial/satellite takeoff provider (Nearmap/Regrid key),
two-way QuickBooks (needs sandbox verification), deposit-required-on-acceptance (chains off e-sign). -->


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
> _Last updated: 2026-07-05 (PRODUCTION-READINESS HARDENING PASS — OWASP-grounded + 3 code audits →
> `PRODUCTION_READINESS.md`; fixed the confirmed `/api/stripe/checkout` BOLA, AI single-flight
> coalescing, per-tenant outbound rate limit, and Supabase client timeout (c9df08f, ea10539); open
> abuse/scale backlog logged in **Production-readiness hardening pass** section above). Prior:
> SPRINT COMPLETION RECONCILED — 11/13 ship-it features shipped; SEC-1..7 +
> advisors-0 + Stripe double-billing + tenant-tier + helmet/undici deps + LiveEar mic-stop remediated;
> 13-layer L1/L5/L7/L10/L11/L12/L13 hardening landed; see the **Sprint completion log** above). Prior:
> 13-LAYER PRODUCTION AUDIT synthesized — the 7-agent production-stack
> audit landed and its verified fixes are now the **"13-layer audit fix backlog"** section above
> (73 concrete fixes: 15 P0 / 36 P1 / 22 P2, de-duped across layers → ~12 distinct P0). Headline demo→product
> gaps: real-auth cutover + baking real-auth env into the prod build (the deployed SPA is mock-admin on a
> placeholder DB), Stripe idempotency (double-billing under cluster), migrations-not-authoritative + PITR,
> graceful SIGTERM, photos-bucket RLS, error tracking (L12 missing), distributed rate-limiter, CI deploy +
> branch protection. Every layer scored partial except L12 (missing). The clean/fast/smooth/secure code audit
> now landed too (13 confirmed-high / 13 total; 4 P0 / 2 P1 / 7 P2) → new "Code-quality audit
> (clean/fast/smooth/secure)" subsection under the Sprint Bug Log, de-duped into the 13-layer backlog. Earlier:
> 2026-07-02 (WHITE-HOT SELLABILITY) — 14-agent workflow + solo server/DB lane + a
> 10-finding adversarially-verified security audit, all remediated. Feature: Dashboard setup checklist +
> memoized aggregates, guided-tour resume/fallback/replay, sample-data label+clear, CommandPalette
> server search, Closeout job picker, MarkupCanvas offset, Inbox cross-tab reads, syncService
> lock+dead-letter, base64→Storage. Honesty: Live Ear speaks as the tenant, weather/followup/invoice-PDF
> de-hardcoded + escaped. Scale: fetchWithTimeout on all outbound, RLS perf migration (28 policies split,
> initplan subselects, 11 FK indexes; advisors 0 security/perf-cleared), private photos bucket + RLS,
> 2-tenant isolation sim 6/6. Security: proposal-PDF XSS/SSRF (esc+renderPdf JS-off/data-only), QBO
> OAuth HMAC state, webhook redirect:error, DNS-rebind all-addr check, cache PII (private), SMS
> toll-fraud (own-customer-only), reviews IDOR, error-leak sweep, CSV-injection lib. 434 tests, tsc
> clean, bundles, boots. Commits a47685b + 164f5bc on branch+main. Earlier:
> 2026-07-02 (100-CUSTOMER BATTLE-READINESS) — cleared Wave 1 (base.ts realtime/pagination,
> body-limit + threat-scan, cloudbuild env + prod fail-fast, shared PDF renderer, Gemini outbound timeout,
> 6 broken ai.models.get sites, CRM sample-data crash, invoice-PDF false-429) and Wave 2 flagships:
> Design Studio (best-render banking, honest gate copy, refine-merge, HEIC guard, narrated progress),
> Live Ear (retired double-write cutty-action listeners → single executor, 24kHz playback, mic/WS-drop
> surfaced, server session onclose/onerror + 30s heartbeat + /api/live quota enforcement), CuttyChat text-agent
> confirm gate + interrogative guard + follow-up chips, CrewSuite crew-status persistence. Gates green:
> tsc clean, 365 tests, vite + server bundle. Remaining: DesignStudio marker offset, Closeout job picker,
> integration-fetch AbortSignals, Waves 3-4 (walkthrough wow, offline/multi-tab). Earlier:
> 2026-06-29 (APP DEEP-DIVE AUDIT) — ran an 8-cluster workflow audit of all 32
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

## Production-readiness hardening pass (2026-07-05) — abuse / scale / BOLA

Driven by an OWASP-grounded production-readiness research pass + **three independent code audits**
(abuse/scale, IDOR/BOLA sweep, resilience). Full reference + `file:line` evidence + how-to-test:
**`PRODUCTION_READINESS.md`**. Answers "1000 tenants × 1000 emails", "5000 identical AI questions",
"attacker with Postman + F12", and "dependency down".

**✅ Fixed + gated green + pushed (branch + main):**
- [x][P0] **`/api/stripe/checkout` cross-tenant BOLA** (API1) — invoice was loaded by body `invoiceId`
  with no caller-tenant check → foreign-amount disclosure + could flip another tenant's invoice to
  paid via the webhook. Now `resolveTenant`-scoped → 403 on mismatch. `tests/stripe.checkout.bola.api.test.ts`. (`c9df08f`)
- [x][P0/B] **AI single-flight / request coalescing** — 5,000 identical prompts no longer stampede a
  cold cache key; they collapse to ONE upstream Gemini call. `src/lib/singleFlight.ts` (+6 tests). (`c9df08f`)
- [x][P0/A] **Per-tenant outbound rate limit** (email/SMS/notifications) — memory-safe fixed-window
  per-minute+per-day cap → 429+Retry-After. `src/lib/outboundLimiter.ts` (+9 unit, +3 e2e). (`ea10539`)
- [x][P1/D] **Supabase client-level timeout** — 8s `AbortSignal` `global.fetch` on both clients so a
  slow Supabase can't pin Express workers under Cloud Run concurrency 80; fails closed. (`c9df08f`)
- [x][P1/B] **Gemini global concurrency semaphore** — bounds concurrent upstream `generateContent`
  calls (distinct-prompt flood); load-sheds past the cap with a clean 503 `AI_BUSY`. Complements
  coalescing (identical prompts). `src/lib/semaphore.ts` (+6 tests). High default cap = passthrough
  under normal load.

**⬜ Open backlog (from the audits — prioritized; details in `PRODUCTION_READINESS.md` Fix Ledger):**
- [ ][P0] `DEFAULT_SPEND_CAP_CENTS` — paid-tier bill-shock ceiling / denial-of-wallet kill-switch.
- [ ][P1] Gemini **fail-closed cost cap** (fails open on Supabase error today) + Gemini-429 → client-429/Retry-After. _(concurrency semaphore: done.)_
- [ ][P1] **Shared (Redis) limiter store** + **per-UID/per-tenant limits on non-AI writes** (team/invite, notifications/dispatch, stripe/*, portal/*).
- [ ][P1] Route `dispatchNotification` sends through the spend meter (close metering bypass); fix SMS-meter TOCTOU (atomic Postgres RPC).
- [ ][P1] **Dirty-Dozen RLS as a CI gate** + live route-inventory auth test + coverage/`npm audit`/secret-scan in CI.
- [ ][P1] Full **money-path E2E** round-trip (seeded test DB) + **k6** spike/soak run.
- [ ][P2] WS `/api/live`: `maxPayload` + per-IP/per-tenant conn cap + pre-upgrade throttle.
- [ ][P2] Per-tenant **sender isolation** (Resend subdomain / Twilio subaccount) + outbound **queue with controlled drain**.
- [ ][P2] **Circuit breaker + backoff-with-jitter** on external deps.
- [ ][P2] **CAN-SPAM/TCPA** send-time enforcement (suppression, unsubscribe, quiet hours, A2P reg) + SPF/DKIM/DMARC + bounce/complaint suppression.
- [ ][P2] Dedicated **RLS-policy review** (PostgREST is the real anon-key+token blast radius).

## Sprint completion log — 2026-07-05

This production sprint moved YardWorx from "feature-rich demo" toward a shippable multi-tenant SaaS.
Reconciled against the git log; each item below landed **gated green** (tsc + vitest + frontend/server bundle).

**Features shipped — 11 of 13.** 1 Deposit-on-acceptance (99ddbc6), 2 Design-Studio iterative image
editing (a690883), 4 Geocoding layer (8d99132), 5 Event notifications (946faa7), 6 Two-way QuickBooks
(c0ca2cc), 7 Reviews ingestion (81a0c17), 8 CSV import + dedupe/merge (433daac), 9 Crew timeclock →
payroll (433daac), 10 Document understanding (6639eb8), 11 Usage-metered billing (195de58), plus the
widgets/Dashboard cockpit overhaul (433daac). **Not yet shipped: 3 aerial/satellite takeoff (in flight —
needs a paid provider key), 12 AI receptionist, 13 Living Proposal.**

**Security remediation — complete.** Adversarial pentest + hardening: **SEC-1** (profiles
privilege-escalation → cross-tenant takeover; anti-escalation trigger, migrations 0013/0015) and
**SEC-2** (16 world-open `cc_*` command-center tables holding real prospect PII dropped, migration 0014)
— the two crown-jewel breaks — plus **SEC-3..7** (error-leak echo, DNS-rebind TOCTOU, video-download SSRF,
open-redirect, portal-JWT-in-query). **Supabase security advisors: 0 lints.** Money/deps: durable
`stripe_events` idempotency + idempotency keys + 200→500-on-error (kills cluster-mode invoice
double-billing, 346c3fd); `/api/tenants/provision` client-supplied-`tier` self-grant closed (346c3fd);
helmet+undici declared as prod deps (fixes prod boot-crash / silent SSRF-defense-off, 5d9e8fa); LiveEar
mic/camera now stop on stop/unmount (privacy, 5d9e8fa).

**13-layer production hardening delivered.** L12 (was the one MISSING layer): structured JSON logging +
GCP Error Reporting format + request-logging middleware (4aaeef3). L13: `/healthz` + `/readyz` probes +
graceful SIGTERM/SIGINT drain + Cloud Run startup/liveness probes (4aaeef3). L11/L10: `geminiCache` +
`apiCacheStore` now bounded (evict-oldest LRU) + per-instance/session-affinity notes (4aaeef3). L1/L10:
a11y foundations (focus-visible outline, skip link, reduced-motion, contrast, ≥44px tap targets,
axe-core under DEV) + `manualChunks` bundle-split (0dfa964, f4687c3). L5/L7: reproducible image
(Dockerfile VITE build args, `npm ci --omit=dev`, `.dockerignore`/`.gcloudignore`) + `npm run build`
step in CI (33da2ba). Auth `getUser` round-trip confirmed already cached (346c3fd).

**What remains.** Features 3/12/13; a final QA-smoke pass; the P1/P2 code-quality polish still open below
(25MB-image re-hash, dead recharts import, `select("*")` over-fetch, dead Google Workspace Hub,
lazy-load three/fabric in DesignStudio) + migration-parity capture; and the **human-only go-live
switches** — flip real auth (`REQUIRE_AUTH`/`VITE_REQUIRE_AUTH` + restore `onAuthStateChanged`),
enable Supabase PITR, set real Secret Manager values (incl. the `SUPABASE_ANON_KEY` runtime secret and
`BASE_URL`), codify branch protection, verify the Intuit QBO sandbox round-trip, and add an aerial
provider key.

## Ship-it fleet backlog (2026-07-05) — 10 features + standing agent workstreams

Grounded in `MARKET_RESEARCH.md` (table-stakes met; the one open lane = **on-site visual
selling / "close it in the driveway"**) + a fresh code inventory. Built and driven by a dedicated
subagent fleet defined in `.claude/agents/*.md`. Each feature ships **gated green** (`tsc`, vitest,
build) and committed. Ranked by **value × readiness**.

### The 10 features (build order)
- [x] **1. Deposit on acceptance** (`feat-deposit-on-accept`) — SHIPPED (commit 99ddbc6). chains off the shipped e-signature:
      client signs an estimate → required deposit collected via the existing `/api/portal/checkout`
      Stripe Connect flow → estimate flips accepted + optional auto-create job. Owner sets a deposit
      %/flat (per-estimate + tenant default). Idempotent, tenant-safe, mock-safe. *Highest ROI, lowest lift.*
- [x] **2. Design Studio iterative image editing** (`feat-design-studio-inpaint`) — SHIPPED (a690883). THE differentiator.
      Multi-step region-aware edits (Gemini `*-flash-image`): "swap this bed, keep the rest of the yard,"
      edit stacking + undo/redo + before/after slider. Mock-safe placeholder (no white-screen), 400-not-500
      on bad input, pricing stays catalog-grounded.
- [ ] **3. Aerial/satellite property takeoff** (`feat-aerial-takeoff`) — neutralizes the incumbents'
      remote-measurement lane. Provider-pluggable adapter (Google Solar / Regrid / Nearmap) behind the
      existing `/api/property/measure` hook → lawn/bed/hardscape sqft + source + confidence; prefills the
      instant estimate. **No fake precision** when unkeyed (labeled estimate/manual). *Needs a paid key (human).*
- [x] **4. Geocoding layer** (`feat-geocoding`) — SHIPPED (commit 8d99132). the single highest-leverage enabler. Geocode-on-write
      (Google Geocoding, mock-safe) caches lat/lng on customer/job; unblocks Route Optimizer, CustomerMap,
      and drive-time Scheduler at once.
- [x] **5. Event notifications** (`feat-notifications`) — SHIPPED (946faa7). email/SMS/web-push on invoice created/paid, new
      message, design approved, low stock, crew arrival, via the existing senders; per-tenant/per-customer
      prefs + quiet hours + CAN-SPAM/TCPA opt-out; honest `simulated:true` when no provider.
- [x] **6. Two-way QuickBooks** (`feat-quickbooks-twoway`) — SHIPPED (c0ca2cc). the accounting moat. Pull invoices/payments/
      items back + reconcile + nightly sync on top of the shipped one-way push. Fixture-tested; live
      round-trip is a documented human Intuit-sandbox step. *Needs sandbox creds (human).*
- [x] **7. Reviews ingestion** (`feat-reviews-ingestion`) — SHIPPED (81a0c17). pull Google/Yelp reviews into the table
      (dedup + real rating rollups) so the Reviews surface reflects actual reputation, not just outbound
      requests. Mock-safe labeled samples.
- [x] **8. CSV import + dedupe/merge** (`feat-csv-import-dedupe`) — SHIPPED (commit 433daac). header-mapped import for customers/
      inventory that **updates instead of duplicating** on re-import, flags near-dupes, + merge-duplicate-
      customers (reassign children, archive loser). Lowers switching cost from Jobber/LMN. Injection-safe.
- [x] **9. Crew timeclock → payroll** (`feat-timeclock-payroll`) — SHIPPED (commit 433daac). clock-in/out tied to a job (optional
      geofence, offline-safe) writing `jobId`/`customerId` timesheets that feed the shipped `payroll.ts`
      export; makes Job Costing real instead of estimate-fallback.
- [x] **10. Document understanding** (`feat-doc-understanding`) — SHIPPED (6639eb8). Gemini PDF extraction: vendor invoice →
      draft expense (feeds Job Costing); contract/permit → structured fields. `responseSchema`, mock-safe,
      400-not-500, confirm-before-commit.

### Standing agent workstreams (continuous until shippable)
- [ ] **QA smoke** (`qa-smoke-tester`) — after every wave: gates + headless route crawl + API probe;
      logs every crash/regression back here as a bug.
- [x] **Pentest** (`pentester`) — DONE: full adversarial pass; 2 crown-jewel breaks (SEC-1/SEC-2) + SEC-3..7, all remediated.
- [x] **Security hardening** (`security-hardener`) — pentest + SEC-1..7 remediated (see Sprint bug log); advisors 0 lints.
- [x] **Market pain research** (`market-pain-researcher`) — DONE → Research-fed backlog below.
- [x] **Pricing strategy** (`pricing-strategist`) — DONE → `PRICING_STRATEGY.md` + usage-billing workstream (Feature 11).
- [ ] **Feature ideation** (`feature-ideator`) — keeps this backlog fed with ranked, de-duped, buildable ideas.
- [x] **Widgets + Dashboard** (`widget-dashboard-designer`) — SHIPPED (commit 433daac). strengthen/replace/kill widgets (no metrics
      theater), invent high-signal ones, redesign the Dashboard cockpit.

> **Bugs found during this sprint** are appended under "Sprint bug log" below as they're discovered,
> then cleared as they're fixed.

## 13-Layer Production Readiness (2026-07-05) — the demo→product gap

The full production stack is 13 layers; a demo ships ~2–4 (frontend, backend, DB, sometimes auth).
Two audits are mapping YardWorx against all 13 + code quality (clean/fast/smooth/secure); **verified
findings + concrete fixes are appended below as each audit lane lands**, then worked P0→P2, each fix
gated + committed + pushed. Current known state per layer (refined by the audits):

| # | Layer | Known state |
|---|-------|-------------|
| 1 | Front-end foundations | React19/Vite/Router/Tailwind; lazy routes; error boundaries; PWA. Audit: bundle-size/code-split, memoization, list virtualization. |
| 2 | APIs & back-end logic | ~80 Express routes; mock-mode; fetchWithTimeout. Audit: 400-vs-500 validation, error envelopes, monolith risk. |
| 3 | Database & storage | Supabase Postgres + RLS + Storage; migrations 0001–0015. Audit: backups/PITR, indexes, seed separation. |
| 4 | Auth & permissions | Supabase Auth + RLS helpers; **demo mock-admin bypass still on** (REQUIRE_AUTH/VITE_REQUIRE_AUTH gate the flip). Audit: real-auth cutover. |
| 5 | Hosting & deployment | Dockerfile multi-stage + cloudbuild.yaml → Cloud Run; dist/server.cjs. Audit: Secret Manager vs env, pipeline health. |
| 6 | Cloud & compute | Cloud Run 2vCPU/1Gi/conc80/min1 + cluster workers + system Chromium. Audit: worker×concurrency tuning, cold start. |
| 7 | CI/CD & version control | GitHub Actions (tsc + vitest on PR). Audit: deploy workflow, branch protection, staging, dep/secret scan. |
| 8 | Security & RLS | **SEC-1..7 fixed; advisors 0 lints; cc_* PII leak removed.** Audit: residual CSP/prompt-injection/secrets. |
| 9 | Rate limiting | express-rate-limit (global/ai/strict) + AI credit wallet. Audit: **per-worker/instance limiter → distributed**, public-endpoint abuse guards. |
| 10 | Caching & CDN | Gemini disk cache, cacheApiResponse (private), workbox runtime caching. Audit: Cache-Control coverage, SPA CDN, asset hashing. |
| 11 | Load balancing & scaling | Cloud Run autoscale. Audit: **in-memory state breaks multi-instance** (threatLog/limiter/processedStripeEvents/GEO_CACHE), /api/live sticky-session FIXME. |
| 12 | Error tracking & logs | console.* + in-memory threatLog. Audit: **structured logging + error tracking (Sentry/GCP Error Reporting) + threat-log persistence + tracing**. |
| 13 | Availability & recovery | health route. Audit: **graceful SIGTERM drain, readiness probe, DB backups/PITR, retries/circuit-breakers, DR**. |

### 13-layer audit fix backlog (2026-07-05)

Synthesized from the **production-stack 13-layer audit** (7-agent workflow; per-layer
status/whatExists/gaps/fixes with file refs). Every layer scored **partial** except **L12 (missing)**;
none scored solid. Items are de-duped across layers (a fix that serves two layers lives once at its
canonical layer with an `(also Lx)` pointer) and against work already done (SEC-1..7, geocoding,
e-sign, etc.). Tags: **[P0]** blocks a real launch / correctness / security / data-loss · **[P1]**
breaks or degrades at scale / in real prod · **[P2]** polish. Effort S/M/L.

> _The clean/fast/smooth/secure code audit (`clean-fast-smooth-secure-audit`) **landed** (2026-07-05; 13
> confirmed-high findings, 0 refuted) — folded into the **"Code-quality audit (clean/fast/smooth/secure)"**
> subsection under the Sprint Bug Log below (4 P0 / 2 P1 / 7 P2, de-duped against this backlog via `(see LN)` cross-refs)._

#### P0 fix list (do first) — what most separates this demo from a real product
These are the handful that make the deployed app actually authenticate, not lose money/data, and survive a deploy:

1. **Real-auth cutover** [L8] — flip `REQUIRE_AUTH` + `VITE_REQUIRE_AUTH` true, restore `onAuthStateChanged` in `App.tsx`, verify tenant isolation under two real JWTs. *Until this is on, all RLS is inert and the app is mock-admin.*
2. **Bake real-auth env into the prod build** [L5/L4] — inject `VITE_SUPABASE_URL/ANON_KEY/REQUIRE_AUTH=true` as Dockerfile build args (+ `--build-arg` from cloudbuild) **and** add `SUPABASE_ANON_KEY` to Cloud Run runtime secrets. *Today the shipped SPA bakes `placeholder.supabase.co` and the server 503s every authed call — the deploy is functionally dead.*
3. **Fix `BASE_URL` + `.dockerignore` + reproducible `npm ci` + `npm run build` in CI** [L5/L7] — the deploy-hygiene blockers (broken magic-links/redirects, secret leak into image, drifted runtime deps, build breakage only caught at deploy).
4. **Stripe idempotency → durable table + idempotency keys** [L2/L11] — the in-memory `processedStripeEvents` Set double-credits invoices under cluster mode (2 workers = live bug, no multi-instance needed).
5. **Migrations authoritative + capture `handle_new_user` trigger** [L3] — repo `migrations/` (15 files) does not reproduce the live DB (27 applied); a rebuild has no signup provisioning → blank app under real auth.
6. **`photos` storage bucket RLS policy** [L8] — `photoStorage.ts` writes `${tenantId}/<uuid>` to a bucket with **no** migration/policy → cross-tenant photo read hole.
7. **Graceful SIGTERM shutdown** [L13] — zero SIGTERM handling; every deploy + scale-in hard-kills in-flight invoice PDF renders and paid Gemini Live sockets.
8. **Enable Supabase PITR before the first real tenant** [L3/L13] — service-role writes bypass RLS, so one bad migration/admin write between daily snapshots = unrecoverable multi-tenant financial data loss.
9. **Error tracking + structured logging** [L12, missing layer; audit-P1, existential] — no Sentry/pino/tracing; 117 unstructured `console.*`, no request/tenant/trace correlation, uncaught rejections keep serving corrupt.
10. **Distributed rate-limiter / shared store** [L9/L11, audit-P1] — every limiter is per-process `MemoryStore`; the AI-cost cap evaporates exactly at scale-out. Plus **CI deploy workflow + branch protection** [L7] so deploy is reproducible and gated.

---

#### Layer 1 — Front-end foundations `[partial]`
- [x] **Restore visible keyboard focus + skip link** `[P1]` S — SHIPPED (0dfa964). global `*:focus-visible` outline in `index.css` @layer base (stop bare `focus:outline-none` on inputs/buttons); skip-to-content anchor as first child of Layout `<main>` → `#main-content`.
- [x] **Add `prefers-reduced-motion` handling** `[P1]` M — SHIPPED (0dfa964). `@media (prefers-reduced-motion: reduce)` block in `src/index.css` zeroing transitions/animations (mirror `.field-mode-active`); gate Motion props behind `useReducedMotion()`. Fails WCAG 2.3.3 today.
- [x] **Fix contrast + min text size for sunlight legibility** `[P1]` M — SHIPPED (0dfa964). raise labels to ≥12px, lift `text-zinc-500`/`text-white/40` → `zinc-400`/`white/60` to clear AA; wire the already-installed `@axe-core/react` into `main.tsx` under DEV as a standing gate. (`Layout.tsx:563,664,713`)
- [ ] **Self-host fonts** `[P1]` M — remove the render-blocking Google Fonts `@import` (`index.css:1`), add `@font-face` woff2 + `font-display:swap`. Unblocks CSP hardening, stops the Google leak, and lets Workbox precache the brand offline. *(feeds L10 precache)*
- [ ] **Unify brand + palette** `[P1]` M — delete the ember-orange `!important` overrides (`index.css:72`) or update CLAUDE.md to match; replace `GAELWORX`/`TerraMind` wordmarks (`Layout.tsx:568,718`) with one YardWorx identity.
- [x] **Image alt/lazy + 44px tap targets + route skeletons + `manualChunks`** `[P2]` M — SHIPPED (0dfa964; route-skeletons partial). `alt`/`loading="lazy"` on non-hero `<img>` (18/24 lack alt); header icon buttons `min h-11 w-11` on mobile; per-route Skeleton fallbacks instead of the bare `PageLoader` spinner (`App.tsx:71`); add `build.rollupOptions.output.manualChunks` in `vite.config.ts` (split react/router, charts, three/fabric, firebase/supabase).

#### Layer 2 — APIs & Back-End Logic `[partial]`
- [x] **Persist Stripe idempotency across workers/instances + add idempotency keys** `[P0]` M — SHIPPED (346c3fd). replace the in-memory `processedStripeEvents` Set with a `stripe_events(id pk, processed_at)` table (`INSERT … ON CONFLICT DO NOTHING`, 0-row = duplicate short-circuit before re-applying payment); pass `{idempotencyKey}` to every `stripe.checkout.sessions.create` (`~5534`, `~5604`). Closes cross-worker/instance invoice double-credit. *(canonical; = L11 fix)*
- [ ] **Add a global Express error handler + terminal `/api` JSON 404** `[P1]` S — after all routes in `createApp`: `app.use('/api', 404 {error})` + final `(err,req,res,next)` mapping `entity.parse.failed`→400, else 500 `{error}`. Guarantees the `{error}` envelope for unknown routes / thrown-outside-try / malformed JSON instead of HTML/stack (`server.ts:5282`).
- [ ] **Restore mock-mode contract on legacy workflow routes** `[P1]` M — `/api/workflows/{proposal:1528, invoice-chaser:2061, chemical-log:2101, payroll:2174, seasonal}` call the Gemini REST endpoint directly and 500 in mock mode; route them through shared `ai.models.generateContent` (inherits mock + cache + 503 mapping) or add an `isMockMode` guard. Also stop overloading the app's `Authorization` header for Google OAuth (header collision).
- [ ] **Set explicit HTTP server timeouts** `[P2]` S — set `server.requestTimeout`/`headersTimeout`/`keepAliveTimeout` aligned to Cloud Run's 300s cap (`server.ts:6152`) so a wedged handler can't hold a concurrency-80 slot.
- [ ] **Add input validation + a single AI-bad-output contract** `[P2]` M — `assertBody`/zod on high-traffic AI routes (`scheduler/optimize:3478`, `compliance/check`, `daily-briefing`, `reports/*`, `crm/briefing`) → 400 before the model call; wrap `parseGeminiJson` failures uniformly as 502 `AI_BAD_OUTPUT` (status drifts 500/502 today).
- [ ] **Begin decomposing the monolith into domain routers** `[P2]` L — split `server.ts` (6541 lines / ~130 handlers) into `src/server/routes/*.ts` via `express.Router()` (stripe, portal, workflows, crm, design, agent); drop `@ts-nocheck` on new modules (`routeAuth.ts` is the proof pattern).
- _Credit-metering atomicity → **L9**. High-sev prod deps (form-data CRLF, protobufjs DoS) → **L7** scanning._

#### Layer 3 — Database & Storage `[partial]`
- [ ] **Make `supabase/migrations/` the authoritative source of truth** `[P0]` M — `supabase db pull` from `bzpxudpmksnawmaanxal`, commit a squashed baseline (or backfill 8+ live-only migrations: full SMS schema, `photos` bucket, `rls_perf_split_write_policies`, `add_customer_latlng`); fix the `0010/0011/0012` filename collision (repo referrals/documents/timesheets vs live SMS); verify parity by diffing a fresh `db reset`.
- [ ] **Capture the `handle_new_user` signup trigger (+ execute lockdown) as committed migrations** `[P0]` S — capture-only (exists live). Without it a rebuilt DB creates `auth.users` on signup but no profile/tenant → every new user fails RLS on everything under `REQUIRE_AUTH=true`.
- [ ] **Add a migration gate to the deploy pipeline** `[P1]` M — `supabase db push` (or migra/diff) step in `cloudbuild.yaml` before deploy + a drift-check in `ci.yml`, so schema and code ship together and PR CI fails on divergence. *(also L7)*
- [ ] **Verify + enable Point-in-Time Recovery before the first real tenant** `[P1]` S — confirm plan, enable PITR (Pro add-on), document RPO/RTO. Tables are empty now — do it before real data lands. *(also L13)*
- [ ] **Index the `timesheets.customer_id` FK + re-audit indexes post-launch** `[P2]` S — `create index on public.timesheets(customer_id)` (composite `(tenant_id, customer_id)` doesn't cover the single-col FK check); defer unused-index cleanup until there's real traffic.

#### Layer 4 — Auth & Permissions `[partial]`
- [ ] **Enforce the 5-role model server-side, not just in the UI** `[P1]` L — RLS write policies gate only `auth_role()<>'client'`, so employee/foreman/owner/admin have identical full write to every tenant table; the granular `ROLE_PERMISSIONS` map is frontend-only cosmetics. Differentiate write policies by role (field tables for employee/foreman; owner/admin full) or add per-route checks. *(overlaps L8 destructive-op RLS)*
- [ ] **Verify Supabase JWTs locally instead of `getUser` per request** `[P1]` M — validate the access-token signature via JWT secret/JWKS + cache claims, replacing the `sb.auth.getUser(token)` network round-trip in `verifySupabaseToken` (per-request latency + hard Auth-service dependency at concurrency 80).
- [ ] **Require email verification before privileged provisioning** `[P2]` S — keep "Confirm email" ON in prod; gate the `PLATFORM_OWNER_EMAIL→is_platform_admin` assignment (`server.ts:~1261`) on a verified address. *(BASE_URL half of this fix → L5)*
- [ ] **Fix the `useRole()` Rules-of-Hooks violation** `[P2]` S — it returns before `useState`/`useEffect` when `!REQUIRE_AUTH`; restructure so hooks always run and the real-auth path is the default branch (so the authed path is actually exercised).
- _Baking real-auth env into the prod build + `SUPABASE_ANON_KEY` → **L5**. Flip flags + restore `onAuthStateChanged` → **L8**._

#### Layer 5 — Hosting & Deployment `[partial]`
- [x] **Inject `VITE_` build args in the Dockerfile builder + pass from cloudbuild** `[P0]` M — SHIPPED (33da2ba). add `ARG/ENV VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_REQUIRE_AUTH=true`, `VITE_GOOGLE_MAPS_PLATFORM_KEY` before `npm run build`; matching `--build-arg` in cloudbuild. **The top launch blocker** — without it the SPA ships mock-admin against `placeholder.supabase.co`. *(= L4 "build frontend with real-auth env")*
- [ ] **Add `SUPABASE_ANON_KEY` to the Cloud Run runtime secrets** `[P0]` S — append `SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest` to `--set-secrets`; without it `verifySupabaseToken`/the auth-login proxy 503 every authed call (`server.ts:1003,1033`). *(= L4 anon-key fix)*
- [x] **Add a `.dockerignore` (and `.gcloudignore`)** `[P0]` S — SHIPPED (33da2ba). exclude `node_modules`, `.git`, `.env*`, `dist`, `coverage`, `cypress`, `*.log`, and the root scratch scripts/dumps. Prevents secret leakage into the builder layer and stops a host `node_modules` from clobbering clean deps at `COPY . .` (`Dockerfile:17`).
- [ ] **Set a real `BASE_URL`** `[P0]` S — replace `BASE_URL=https://YOUR-DOMAIN` (`cloudbuild.yaml:35`) via substitution/Secret Manager; drives Stripe redirects, portal magic links, QBO callback (`server.ts:2366,2438,2582`). Ships broken/phishing-shaped links as-is. *(also L4/L7)*
- [ ] **Drop redundant apk `nodejs`/`yarn` + migrate GCR→Artifact Registry** `[P2]` M — remove `nodejs yarn` from the runner `apk add` (base already has Node 20); repoint image refs off deprecated `gcr.io`, rename `react-example-app`→`yardworx`, add an image-scan step before deploy.
- _Reproducible runtime install (`npm ci` from lockfile) → **L7** (there it's tagged P0)._

#### Layer 6 — Cloud & Compute `[partial]`
- [ ] **Set `--no-cpu-throttling` + `--timeout=3600` for the Live WebSocket** `[P1]` S — Cloud Run throttles CPU to ~zero between requests, stalling the Live audio bridge, 30s heartbeat, respawn logic, and Chromium idle-timer; the 300s default request timeout also severs Live voice sessions.
- [ ] **Cap `--max-instances` + size the DB pool (+ `--session-affinity` for `/api/live`)** `[P1]` S — no `--max-instances` defaults to 100 (100×2 workers ≈ 200 Supabase clients → connection storm + cost blowout); set e.g. `--max-instances=10` and confirm the pooler covers max-instances × `WEB_CONCURRENCY`. *(= L11 "cap and pin the fleet")*
- [ ] **Give Chromium real memory headroom** `[P1]` M — 2 workers each holding a ~200MB Chromium on 1024Mi → concurrent PDF renders OOM/SIGKILL. Bump `--memory 2048Mi`, or `WEB_CONCURRENCY=1`, or move PDF rendering to a dedicated Cloud Run service.
- [ ] **Document/tune cluster-vs-Cloud-Run scaling + cold-start mitigation** `[P2]` M — decide `WEB_CONCURRENCY=2` vs 1 + horizontal scale; add `--cpu-boost`/a warmup ping to `getSharedBrowser` (first PDF pays ~1–2s Chromium cold start); record the `min-instances=1` always-on billing tradeoff.
- _Graceful SIGTERM shutdown → **L13** (tagged P0 there)._

#### Layer 7 — CI/CD & Version Control `[partial]`
- [x] **Add `npm run build` to CI** `[P0]` S — SHIPPED (33da2ba). insert `- run: npm run build` in `ci.yml` after the test step to exercise both `vite build` and the esbuild `dist/server.cjs` entrypoint. Cheapest highest-signal fix (build breakage currently surfaces only at Cloud Build deploy).
- [x] **Make the prod Docker image reproducible (`npm ci` from lockfile)** `[P0]` S — SHIPPED (33da2ba). `COPY package-lock.json` into the runner and use `npm ci --omit=dev` (not `npm install`) so runtime deps match what CI tested (`Dockerfile:47,50`); pin base by digest, drop `npm i -g npm@latest` and the unused `yarn`. *(= L5 reproducible-install)*
- [ ] **Fix the `BASE_URL` placeholder + rename `react-example-app`→`yardworx` in the deploy path** `[P0]` S — *(same underlying fix as L5 BASE_URL; also de-risks the stale-branding footgun in cloudbuild + package.json name)*.
- [ ] **Add dependency + secret scanning gates to CI + patch current highs** `[P1]` M — `dependabot.yml` (npm weekly), `npm audit --audit-level=high` (or gitleaks/trufflehog) as a failing step, enable CodeQL; remediate the current highs now (vite `fs.deny` bypass, protobufjs DoS, form-data CRLF) via `npm audit fix` + re-lock. *(consolidates L2 + L8 scanning items)*
- [ ] **Version-control the deploy pipeline with least-privilege auth** `[P1]` M — add `.github/workflows/deploy.yml` gated on push-to-main **and** green CI via Workload Identity Federation (no long-lived JSON key), or commit the Cloud Build trigger config (`gcloud builds triggers export`). Deploy is console-only today — not reproducible/auditable.
- [ ] **Introduce a staging Cloud Run service + approval gate before prod** `[P1]` L — deploy main→`yardworx-staging` automatically, require a GitHub Environment manual approval (or version tag) to promote; optional per-PR previews. Every trigger fire ships straight to prod today.
- [ ] **Codify branch protection so tests gate merges** `[P1]` S — make CI (build+lint+test) a required status check on `main`, require 1 review, block direct pushes, commit `CODEOWNERS` + a ruleset. Nothing enforces green-before-merge today.
- [ ] **Give the lint/type gate teeth + resolve E2E dead weight** `[P2]` M — `tsc --noEmit` is a near-noop under pervasive `@ts-nocheck`; add ESLint + a CI step and/or a `@ts-nocheck`-count ratchet; wire the installed Cypress into a CI e2e job or remove it; add `engines: {node: ">=20 <21"}` and align `@types/node` to 20.
- [ ] **Delete the divergent `pnpm-lock.yaml` + add build provenance** `[P2]` S — remove `pnpm-lock.yaml` (npm is canonical) for a single dependency source of truth; add Cloud Build layer caching + an SBOM/attestation on the pushed image.

#### Layer 8 — Security & RLS `[partial]`
> **SEC-1..7 remediated** (SEC-1 anti-escalation trigger `0013`/`0015`; SEC-2 16 world-open `cc_*` tables dropped `0014`; SEC-3..7 tracked in the Sprint Bug Log → `security-hardener`). **Supabase security advisors: 0 lints.** NEW items from the 13-layer audit:
- [ ] **Flip `REQUIRE_AUTH` + `VITE_REQUIRE_AUTH` true and restore real auth** `[P0]` M — restore the Supabase `onAuthStateChanged` gate in `App.tsx` so every `/api/*` carries a verified JWT and RLS actually governs data. **Nothing else in L8 matters until this is on.** Verify with an `RLS_ISOLATION_TEST.sql` harness under two real tenant JWTs. *(the real-auth cutover; couples L4/L5 build args)*
- [ ] **Add a migration for the `photos` storage bucket + tenant-scoped policy** `[P0]` S — `0016_photos_storage.sql`: create `photos` (private) bucket + policy `bucket_id='photos' and (storage.foldername(name))[1] = private.auth_tenant_id()::text`. `photoStorage.ts` writes `${tenantId}/<uuid>` to a bucket with **no** policy → cross-tenant photo read hole (advisors don't flag missing per-bucket storage policies). Audit the dashboard for other unpolicied buckets.
- [ ] **Split CSP by environment** `[P1]` M — prod `scriptSrc` = `'self'` (drop `unsafe-eval`/`unsafe-inline` → nonces/hashes), drop `ws://localhost:*`/`http://localhost:*` from `connectSrc` (`server.ts:1108-1113`); keep the permissive set only for dev/Vite. Prod inherits an XSS-friendly dev CSP today.
- [ ] **Wrap untrusted external/model input with an explicit injection guard** `[P1]` M — `onboarding-scrape` (`server.ts:3076`) feeds arbitrary scraped-web text straight as model `contents` then writes the JSON into tenant settings; wrap in a labeled `<UNTRUSTED>` delimiter + a "data, never instructions" system rule; length-cap + schema-validate the output. Treatment is inconsistent across ~25 AI handlers.
- [ ] **Populate `req.user.role` in the auth middleware** `[P2]` S — `verifySupabaseToken` (`server.ts:~1041`) sets only uid/sub/email, so the `/api/security/threats` role gate 403s everyone (the feature is dead). Attach role/`is_platform_admin` from the profile.
- [ ] **Refine intra-tenant RLS for destructive/financial ops** `[P2]` M — restrict `DELETE` on invoices/contracts and `UPDATE` of financial fields to `role in ('admin','owner')` so a compromised employee/foreman can't wipe or alter billing within its own tenant. *(overlaps L4 5-role enforcement)*
- _Dependency + secret scanning + patch highs → **L7**._

#### Layer 9 — Rate limiting `[partial]`
- [ ] **Back the limiters with a shared store, or make credits the source of truth** `[P1]` M — every `express-rate-limit` tier uses per-worker/per-instance `MemoryStore`, so the effective ceiling is `limit × workers × instances` (the "100 AI/day" cost cap evaporates at scale-out). Add `rate-limit-redis`/Memorystore or `@acpr/rate-limit-postgresql`, or explicitly designate the (fixed) credit wallet as authoritative. *(= L11 shared-store fix)*
- [ ] **Make credit metering atomic + stream-aware + choose fail mode** `[P1]` M — `meterCredits` (`server.ts:1198-1212`) does a non-atomic read-modify-write (concurrent calls lost-update/undercount), only hooks `res.json` (streaming/`res.send`/`res.end` bypass metering), charges on cache HITs, and fails **open** silently. Use an atomic Postgres increment RPC, meter on `res` finish, skip charge on `X-App-Cache: HIT`, and deliberately pick fail-open vs fail-closed. *(consolidates the L2 metering item)*
- [ ] **Add a CAPTCHA/honeypot to public lead-intake** `[P1]` M — `/api/public/lead-intake` (`server.ts:1482`) has only a per-IP limiter; a botnet rotating IPs sprays lead inserts into tenants' pipelines. Add Turnstile/hCaptcha + a hidden honeypot + min-fill-time; keep the IP limiter as backstop. *(the one unauthenticated write endpoint)*
- [ ] **Add a per-tenant daily AI ceiling + weight credits by cost** `[P2]` M — quotas are per-user not per-tenant (10 employees = 10×100/day), and a megapixel design generation charges the same 1 credit as a one-line text call. Add a per-tenant daily cap + weight image/vision routes above text.

#### Layer 10 — Caching & CDN `[partial]`
> The caching **logic** is correct (tenant-keyed `cacheApiResponse` w/ `private,max-age` + `Vary`; content-hashed `immutable` asset headers; opt-in Gemini disk cache) but the **delivery topology** is not — there is no CDN, so those headers are honored by nobody.
- [ ] **Put a CDN in front of static assets** `[P1]` L — no Cloud CDN / external HTTPS LB / Firebase Hosting exists, so every JS/CSS/font/image request terminates at the single Node process (`express.static`, `server.ts:5138`) competing with API/PDF/Puppeteer/WS on 2 CPU. Add an external HTTPS LB + Cloud CDN with a serverless NEG, or move SPA/static serving to Firebase Hosting / a GCS backend-bucket + Cloud CDN and reserve Cloud Run for `/api`. Makes the existing `immutable`/`s-maxage` headers actually pay off.
- [x] **Bound the in-memory caches** `[P1]` S — SHIPPED (4aaeef3). `apiCacheStore` (`server.ts:614`) and `geminiCache` (`server.ts:553`) have **no** eviction/size cap (unlike `GEO_CACHE`/`designImageCache`/`processedStripeEvents` which self-bound); on a long-lived instance they grow toward the 1Gi OOM ceiling. Add an LRU/size cap mirroring `designImageCache`'s `while(size>MAX) delete oldest` (`server.ts:626`).
- [ ] **Fix the PWA install surface** `[P1]` M — two conflicting manifests (hardcoded `public/manifest.json` "YardWorx" `#05a845` at `index.html:10` vs VitePWA-generated "TerraMind Ops OS" `#000000`), three different theme-colors, no 192/512 PNG icons, and an SVG apple-touch-icon iOS ignores → blank home-screen icon; fails Android installability. Drop the redundant manifest, add PNG icons (incl. maskable + apple-touch), unify theme-color.
- [ ] **Move to a shared cache for multi-instance hit rates** `[P2]` L — back the API + Gemini caches with Memorystore (Redis) instead of per-process Maps so cluster workers and autoscaled instances share entries; keep the tenant-keyed hashing. *(overlaps L11 shared-cache)*
- [ ] **Precache self-hosted fonts + add an offline fallback** `[P2]` M — after self-hosting fonts (**L1**), include them in the Workbox precache so the offline shell (incl. the Cinzel wordmark) is self-contained; add a small `navigateFallback`/data-unavailable view beyond the connectivity banner.

#### L11 — Load balancing & scaling `[partial]`
> This layer's failure modes are **per-process in-memory state that doesn't survive horizontal scale-out** (2 workers × up to 100 instances ≈ 200 independent processes). The concrete fixes live at their canonical layers:
- [x] **Move Stripe idempotency to a durable table** `[P0]` M — SHIPPED (346c3fd). the live double-billing bug (fires at the default 2 workers). *(→ **L2**)*
- [ ] **Back rate limiters with a shared store** `[P1]` M — the cost-abuse cap goes unbounded under scale-out. *(→ **L9**)*
- [ ] **Cap + pin the fleet in `cloudbuild.yaml`** `[P1]` S — `--max-instances 10` + `--session-affinity` (helps `/api/live`, which carries an explicit ws-multiplexing scale FIXME at `server.ts:6157`). *(→ **L6**)*
- [ ] **Persist `threatLog` + shared caches out of process** `[P2]` M — `threatLog` (per-process, capped 200) → a Supabase table so `/api/security/threats` aggregates fleet-wide and survives scale-in; move `GEO_CACHE`/`geminiCache`/`apiCacheStore` to Redis/Memorystore or accept the duplicated Google/Gemini spend. *(threatLog persistence → **L12**)*

#### L12 — Error tracking & logs `[MISSING]`
> The only fully-missing layer. Cloud Logging captures stdout, but as 117 unstructured `console.*` lines with no severity/request-id/tenant/trace correlation; no error aggregation, tracing, metrics, or alerting.
- [x] **Introduce structured JSON logging** `[P1]` M — SHIPPED (4aaeef3; `src/lib/logger.ts`). add `pino` + `pino-http` (or `@google-cloud/logging-bunyan`); emit JSON with severity, trace (parsed from `X-Cloud-Trace-Context`), `tenantId`, route; replace the 117 `console.*` calls. Makes Cloud Logging severity, log-based metrics, and alerts work.
- [x] **Add error tracking (Sentry / Error Reporting)** `[P1]` S — SHIPPED (4aaeef3; GCP Error Reporting format via logger, Sentry optional). `@sentry/node` init at the top of `server.ts`, `Sentry.setupExpressErrorHandler(app)` before the final handler (`server.ts:6631`), report from the process guards (`6670-6675`); tag release with `COMMIT_SHA` (already in cloudbuild) so errors group per deploy.
- [ ] **Emit metrics + define alert policies** `[P2]` M — Cloud Monitoring custom metrics for AI calls (count + estimated cost per tenant) + alert policies (5xx rate, instance-count==max, `aiLimiter` 429 spikes); check the config into `monitoring/`/Terraform.
- [ ] **Persist + alert on the threat log** `[P2]` S — write `threatLog` entries (`server.ts:869`) to Supabase + alert on new HIGH-severity rows so injection/path-traversal attempts surface without an admin polling `/api/security/threats`. *(also L11)*

#### L13 — Availability & recovery `[partial]`
- [x] **Implement SIGTERM/SIGINT graceful shutdown** `[P0]` M — SHIPPED (4aaeef3). after `app.listen` (`server.ts:6152`): `server.close()`, close the WSS (drain upstream Gemini Live), await in-flight PDF renders, `sharedBrowser.close()` within a ~25s budget (< Cloud Run grace); the cluster primary forwards SIGTERM to workers and stops respawning. **Top availability fix** — every deploy + scale-in currently hard-kills live invoice PDFs and paid voice sessions (zero SIGTERM handling today).
- [x] **Split readiness from liveness** `[P1]` S — SHIPPED (4aaeef3; `/healthz` + `/readyz` + Cloud Run probes). add `/readyz` doing a real `select 1` vs Supabase (+ a cheap Gemini/mock check) → 503 when a critical dep is down; keep `/api/health` shallow; wire a Cloud Run `startupProbe` to `/readyz` so a wedged instance is recycled, not served. `/api/health` is liveness-only today (always 200, only checks the client object exists).
- [ ] **Enable Supabase PITR + a tested restore runbook** `[P1]` M — PITR (Pro add-on) or an external `pg_dump`→GCS cron; document RTO/RPO. The only safety net for a bad service-role/migration write between daily snapshots on a financial system. *(= L3 PITR)*
- [ ] **Add circuit breakers/backoff on external deps + fix the uncaught-exception exit** `[P2]` M — wrap Gemini/Stripe with a breaker (opossum)/fail-fast after N timeouts; add jitter to the webhook retry (`server.ts:5300-5313`) + worker respawn; change the standalone `uncaughtException` path (`server.ts:6673`) to log then `process.exit(1)` so the container restarts clean instead of serving in an undefined state.


### SPRINT BUG LOG (2026-07-05) — appended by qa-smoke/pentester/build agents; cleared when fixed.

**Final holistic QA smoke pass (2026-07-05):** gates ALL GREEN (tsc clean · 866/866 vitest · vite +
server bundle); **41/41 routes render crash-clean** (0 error-boundary trips) in demo mode; API probes
all honest (401/403 gates, 400-not-500 on bad input, honest 503s, mock branches return real shapes). Findings:
- [x] **[CRITICAL] CSP connect-src omitted Supabase → prod login + all data CSP-blocked — FIXED (7c36ee9).**
      `server.ts:1650` listed dead `*.firebaseio.com` but no Supabase; the SPA calls Supabase directly from
      the browser. Under the shipped `VITE_REQUIRE_AUTH=true` this refused auth + data. Added `*.supabase.co`
      + `wss://*.supabase.co`, dropped the dead firebase origins.
- [ ] **[P2 a11y] WCAG AA contrast + invalid nested-interactive debt** — @axe-core flags many low-contrast
      forest/zinc labels on near-black (~1–2.4:1, need 4.5:1) + 13× focusable children nested inside `<button>`.
      Raise label/link contrast + stop nesting focusable elements in buttons (`src/index.css` tokens + card/nav).
- [ ] **[config note] `.env.local` ships `REQUIRE_AUTH=true`/`VITE_REQUIRE_AUTH=true`** (real auth ON, not the
      CLAUDE.md demo bypass). With the CSP fix login now works against Supabase; this is the intended go-live
      posture. For a local mock-admin demo run, flip both flags off.

### Code-quality audit (clean/fast/smooth/secure) — 2026-07-05

**13 confirmed-high / 13 total** (0 refuted; no concrete medium/low surfaced — every finding was
reproduced + verified live). Synthesized from the **clean/fast/smooth/secure read-only code audit**
(19-agent workflow: 6 research lanes → 13 per-finding verify agents, all `CONFIRMED`). By priority:
**4 P0 · 2 P1 · 7 P2**. Tags per the 13-layer scheme (**[P0]** correctness/security/data-loss ·
**[P1]** the getUser-hop + any unbounded-memory/leak · **[P2]** polish/perf); effort S/M/L.
De-duped against the 13-layer backlog above via `(see LN)` cross-refs.

**Backend perf**
- [x] **Stop the per-request GoTrue round-trip in auth** `[P1]` M — SHIPPED (346c3fd; confirmed complete — sha256(token), 45s TTL, bounded 5000, revocation-preserving). `verifySupabaseToken` calls `sb.auth.getUser(token)` (an HTTP hop to Supabase Auth) before every `/api` handler → ~50–150ms + a hard GoTrue dependency at concurrency-80. Tier 1: wrap `getUser` in a size-capped 30–60s in-memory cache keyed by `sha256(token)` (per-worker; collapses repeat dashboard calls). Tier 2 (network-free): `jwt.verify(token, SUPABASE_JWT_SECRET, {algorithms:["HS256"], audience:"authenticated", issuer:`${SUPABASE_URL}/auth/v1`})` — MUST pin `algorithms` (else alg:none/confusion) + validate aud/iss; keep `getUser` as fallback when no secret/JWKS. (`server.ts:1035`) *(see L4 — same fix)*
- [x] **Bound the unbounded `geminiCache`** `[P1]` S — SHIPPED (4aaeef3; cap 2000, evict-oldest). `geminiCache` is an ever-growing in-memory object → slow OOM on the min-1 instance. Convert to a size-capped LRU `Map` (`GEMINI_CACHE_MAX≈2000`) mirroring `geoCacheSet`: evict-oldest on write, LRU-touch on hit, and fix disk persistence (`JSON.stringify(Object.fromEntries(map))` on save; `new Map(Object.entries(obj))` + trim on load). Caps worst-case at ~8MB. (`server.ts:552,601`) *(see L10 "Bound the in-memory caches" — same fix; L10 item also covers `apiCacheStore`)*
- [ ] **Stop re-hashing 25MB base64 images on every vision call** `[P2]` S — `cacheApiResponse` JSON-stringifies + SHA-256s the full image body for a ~0% hit rate, stalling the event loop on the hot path. Remove `cacheApiResponse` from `/api/design/process` (3660), `/api/inventory/process-image` (4677), `/api/expenses/ocr` (5024) **only** (keep it on `/api/crm/analyze-property` — small body, real hit rate); also extend the `geminiCache` inlineData-image bypass so the second hash is skipped too. (`server.ts:~668`, IMAGE_ROUTES)

**Frontend perf**
- [ ] **Lazy-load three.js + fabric.js in DesignStudio** `[P2]` M — both are statically imported (~250KB gz) yet render only behind tabs; three.js is double-gated (needs an AI result + a 3D-tab click) so most sessions never need it. Replace the two static imports with `React.lazy` and wrap the canvas-switch block in a single local `<Suspense>` (required, not cosmetic — else a re-suspend blanks the whole route). (`src/pages/DesignStudio.tsx:44,46`, render 1327-1345) *(see L1 manualChunks — same three/fabric split, targeted approach)*
- [ ] **Delete the unused `recharts` import from Dashboard** `[P2]` S — dead `import {AreaChart,Area,Tooltip,ResponsiveContainer} from "recharts"` (unflagged under `@ts-nocheck`) drags recharts + its d3 deps into the Dashboard landing chunk. Delete the line; charts still load lazily via EarningsWidget. Zero behavior change. (`src/pages/Dashboard.tsx:77`)
- [ ] **Split Layout's heavy children out of the entry chunk** `[P2]` M — Layout statically pulls CuttyChat (51KB) + LiveEar (28.7KB) + CommandPalette (15.8KB) + NotificationsCenter into the main entry chunk. `React.lazy` each, gated per lifecycle: open-gate CommandPalette (Cmd-K) + the NotificationsCenter panel; one-way `hasOpenedBrain` flag for CuttyChat (preserve history/exit anim); `<Suspense fallback={null}>` for always-on LiveEar. Extract the unread-count into a tiny hook so the bell still works. ~100KB+ off the entry bundle. (`src/components/Layout.tsx:56-57,70-71`)

**DB perf**
- [ ] **Kill whole-table `select("*")` over-fetch + add scoped reads** `[P2]` L — `makeRepo().list()` does `select("*")` and pages ALL rows to `MAX_ROWS=10000` across ~89 call sites with no UI pagination. Priority fixes (not blanket column-narrowing — several JSON cols are consumed off list rows): (1) add scoped repo methods (e.g. `designVisionsRepo.forCustomer` via `.eq`) to replace client-side `.filter`-after-list; (2) bounded/paged reads for the few append-heavy tables (customer_messages, system_logs, invoices, timesheets, compliance_logs); (3) gate the 30s post-every-event subscribe backstop to reconnect/id-less deltas only. (`src/lib/repos/base.ts:135-142,46-47,207-276`)
- [ ] **Drop the redundant `material_logs.inventory_item_id` FK column** `[P2]` S — `material_logs` carries two FKs to `inventory(id)` (`item_id` + `inventory_item_id`); nothing reads `inventory_item_id` and only the agent writer sets it. Ship a NEW append-only migration `0007_material_logs_drop_dup_fk.sql` with `alter table public.material_logs drop column if exists inventory_item_id;` (auto-drops its FK + idx) and delete the write at `agentActions.ts:278`. Keep `item_id` (the canonical job-costing join key). (`supabase/migrations/0006_supporting_tables.sql:22,28`; `agentActions.ts:278`)

**Security**
- [x] **Reject client-supplied `tier` on `/api/tenants/provision`** `[P0]` S — SHIPPED (346c3fd). provision reads `tier` from `req.body`, so any self-serve signup self-grants `enterprise` + 10k AI credits (and an onboarded owner can re-POST for a persistent self-upgrade). Drop `tier` from the destructure + the `safeTier` line; remove `tier` from the UPDATE payload; hardcode `tier:"free"` on the INSERT fallback. Leave the Stripe webhook `setTenantTier` + the platform-admin-gated `/api/admin/tenants/:id/tier` as the only tier writers. (`server.ts:1253,1290,1296`)
- [x] **Declare undici/helmet as prod deps + patch 4 npm highs** `[P0]` S — SHIPPED (5d9e8fa; deps moved to `dependencies`). undici (`server.ts:16`) and helmet (`server.ts:18`) are phantom prod deps: the prod image builds with `npm install --omit=dev`, so today the server **crashes on boot** and the SSRF DNS-rebind Agent may be silently ignored (version mismatch vs Node 20's internal undici). Add `"undici":"^7.28.0"` + move `helmet` to `dependencies`; then `npm audit fix` the transitive highs (form-data CRLF, protobufjs DoS) + bump `vite` ≥8.0.16; add a smoke test asserting the pinned lookup rejects a private-IP resolution. (`package.json`; `server.ts:16,224`) *(see L7 dep-scan — this is the P0 boot-crash/SSRF slice of that item)*

**Cleanliness**
- [ ] **Remove the dead "Google Workspace Hub" feature** `[P2]` L — the Dashboard "Card E" widget advertises Calendar/Gmail auto-dispatch that can never work (no token flow exists anywhere; guarded by the dead Firebase shim's always-null `auth`). Delete the UI (`Dashboard.tsx:2544-2700`), the dead handlers (`handleConnectWorkspace`/`runSyncCalendar`/`runDispatchGmail`/`runIntegration` etc. ~595-815), the state + `cutty_workspace_active` read + `workspace:true` default-widget, and the sibling CrewSuite "Field Report" Gmail button (`CrewSuite.tsx:650-660`); drop the now-unused `auth` import. Never ship a button whose only behavior is an error toast. (`src/pages/Dashboard.tsx:595-860,2544-2700`)

**Reliability**
- [x] **Make the Stripe webhook idempotent + 500-on-error** `[P0]` M — SHIPPED (346c3fd). the handler marks the event processed (`processedStripeEvents.add`) BEFORE any DB work, swallows apply errors, and still acks 200 → double-counts payments under cluster mode and drops failed applies silently. Stamp each `payments[]` entry with `stripeId`; do the read-modify-write in an atomic SECURITY DEFINER RPC guarded by `WHERE NOT (data->'payments' @> …stripeId)` (true no-op on redelivery, closes the two-worker race); return **500** (not 200) whenever apply / `sb`-null / `setTenantTier` throws so Stripe retries; record `event.id` in a durable `stripe_events(UNIQUE)` table only after commit, replacing the in-memory Set. Fix the empty `setTenantTier` catch (server.ts:723). (`server.ts:709-758,787`) *(see L2/L11 — adds the 200→500 + atomic `@>`-guarded apply slice to the idempotency fix)*
- [x] **Stop the LiveEar mic/camera after stop/unmount** `[P0]` S — SHIPPED (5d9e8fa). `LiveEar` never calls `getTracks().forEach(t=>t.stop())`, so the device keeps recording (camera/mic indicator stays lit) after the user stops — a privacy defect. Add a `streamRef`, assign it right after `getUserMedia` (covers both AV + audio-only fallback paths), and in `stopLiveEar()` stop all tracks + null the ref; also promote `videoInterval` to a ref and clear it in `stopLiveEar` instead of relying on `ws.onclose`. (`src/components/LiveEar.tsx:98-112,125-133`)

**Security — adversarial pentest (read-only pass, findings reproduced live in rolled-back txns):**
- [x] **[SEC-1 CRITICAL] profiles privilege escalation → cross-tenant takeover — FIXED + VERIFIED.**
      `profiles_update` RLS had no WITH CHECK + no anti-escalation trigger, so any authenticated user
      could PATCH their own row to `is_platform_admin=true` / `role=owner` / switch `tenant_id` and take
      over every tenant. Migration **0013_profiles_anti_escalation.sql** adds a BEFORE UPDATE trigger
      (`private.guard_profile_privileged_columns`) blocking role/tenant_id/is_platform_admin/firebase_uid
      changes unless service_role or platform admin. Applied to the live DB; the exploit now raises 42501
      (verified in a rolled-back sim).
- [x] **[SEC-2 HIGH] `cc_*` tables world-readable/writable via the public anon key — RESOLVED (owner-authorized).**
      16 abandoned "command center" `cc_*` tables (not YardWorx — zero code refs, no `tenant_id`, no FK from
      any YardWorx table) were world-open via the public anon key and held real prospect PII. The owner
      authorized removal; migration **0014_drop_command_center_tables.sql** dropped all 16 (~76 rows) CASCADE.
      Migration **0015_guard_fn_search_path.sql** also pins the SEC-1 trigger fn's search_path. **Supabase
      security advisors now return 0 lints** (was 5 rls-always-true + 1 mutable-search-path).
- [ ] **[SEC-3 MED] Raw exception messages echoed to clients** (server.ts 5539, 2256, 4988 [also blind-SSRF
      oracle], 4463/4461, 4002, 644). Return generic strings; keep `e.message` in `console.error`. → security-hardener.
- [ ] **[SEC-4 MED] DNS-rebind TOCTOU in `validateSafeUrl`** (securityUtils.ts:47-83) — pin the validated IP
      at connect time. Affects onboarding-scrape (2887) + automations webhook (4981). → security-hardener.
- [ ] **[SEC-5 LOW] video-download fetch** (server.ts:4054) lacks validateSafeUrl/redirect:"error". → security-hardener.
- [ ] **[SEC-6 LOW] Open redirect** via body `success_url`/`cancel_url` (server.ts 2180/2303/5228/5407) — allowlist to BASE_URL. → security-hardener.
- [ ] **[SEC-7 LOW] Portal JWT accepted from `?token=`** (server.ts:5121) leaks via logs/Referer — prefer header-only. → security-hardener.
- _Verified NOT vulnerable: core tenant tables, storage buckets, Stripe/QBO/portal/PDF, SPA XSS, CSV injection, /api/live quota._

**Geocoding follow-ups (from feat-geocoding):**
- [ ] CRM.tsx customer-create doesn't geocode-on-write (customers get coords lazily via CustomerMap backfill) — mirror the Scheduler change.
- [ ] `/api/public/lead-intake` writes addresses to `leads` un-geocoded (leads.lat/lng columns unconfirmed — schema check if leads need mapping).

## Encryption & secrets hardening (2026-07-05) — the security frontier

Grounded in the live DB: **RLS is enabled on 100% of public tables**; `pgcrypto` + `supabase_vault`
are installed; **`integrations.access_token`/`refresh_token` are stored PLAINTEXT** (the one real
encryption hole — a DB read hands over live QBO tokens). Baseline already in place: at-rest AES-256
(Supabase/GCP-managed DB + backups), TLS/HSTS/wss in transit, passwords hashed by Supabase Auth,
tenant RLS + anti-escalation trigger (advisors 0), Stripe/QBO/portal integrity checks.

> **Hash vs encrypt (do NOT "hashify" everything):** HASH one-way/compare-only things (passwords —
> Supabase does it; API keys/webhook secrets you *issue* → store hash, compare). ENCRYPT reversible
> things you must reuse (the QBO OAuth tokens). Hashing the tokens would break the integration.

### P0 — Encrypt stored third-party secrets (code)
- [ ] **`src/lib/secretCrypto.ts`** — tiered envelope, one interface: (dev) no key = passthrough (tests/
      demo unaffected); (staging) `SECRET_ENCRYPTION_KEY` (32-byte base64 from Secret Manager) =
      AES-256-GCM; (prod) `KMS_KEY_NAME` = Cloud KMS envelope (see P2). Zero new deps (node crypto).
- [ ] Wire `integrations.access_token`/`refresh_token` through `encryptSecret` on write / `decryptSecret`
      on read (QBO connect/callback/refresh + two-way sync). Forward-compatible (legacy plaintext rows
      still decrypt as passthrough). One-time re-encrypt pass once a key is set. `0018` migration.
- [ ] `.env.example`: `SECRET_ENCRYPTION_KEY`, `KMS_KEY_NAME`.

### P1 — RLS depth (beyond enablement)
- [ ] **Dirty-Dozen cross-tenant RLS verification** (from `security_spec.md`) run as a live SQL simulation
      (tenant A vs B + simulated JWTs) via the Supabase MCP; then codify as a CI gate so drift is caught per-PR.
- [ ] **Column-level lockdown** on `profiles` (`0018`): `REVOKE UPDATE (role, tenant_id, is_platform_admin,
      firebase_uid) FROM authenticated, anon` — grant-layer belt behind the trigger.
- [ ] Enumerate every table's policies; confirm tenant-scoped + deny-by-default (no stray `USING(true)`);
      the intentional service-role-only tables (`stripe_events`, `integrations`, usage ledger) stay policy-less.

### P1 — Secrets management + rotation (infra; `cloudbuild --set-secrets` already wired)
- [ ] Move `JWT_SECRET`, service-role key, Stripe/Twilio/QBO client secrets into **Google Secret Manager**;
      grant the Cloud Run SA `secretmanager.secretAccessor`; **mount as files, not env vars**; set rotation.

### P2 — Most-secure tier + depth
- [ ] **Cloud KMS envelope encryption** for stored tenant secrets: KEK in KMS (HSM tier, never leaves KMS),
      **per-tenant DEK** wrapped by the KEK, store ciphertext + wrapped-DEK; every unwrap audited/revocable.
      Short-TTL in-memory DEK cache to amortize the KMS call. (`@google-cloud/kms` dep + `KMS_KEY_NAME`.)
- [ ] **Workload Identity** so Cloud Run authenticates to KMS/Secret Manager/Supabase with NO stored
      credentials (identity = credential; solves the secret-to-get-secrets bootstrap).
- [ ] **Field-level PII / Vault** (scoped, not blanket) via `supabase_vault`/`pgcrypto` for the most
      sensitive columns only (signature images now; SSN/bank if ever added) — blanket column crypto kills queries.
- [ ] **Append-only audit trail** (`audit_logs`): log platform-admin cross-tenant reads, token decryptions,
      exports — plugs into the shipped L12 structured logging; breach forensics + SOC2 readiness.
- [ ] **MFA (TOTP)** via Supabase Auth for owner/admin (client already has `BiometricGuard`); key rotation
      for `JWT_SECRET` + the encryption key; CMEK + private egress (later, not day-one).

## Research-fed backlog (2026-07-05) — from the pricing/market-pain/ideation fleet

Three research agents ran this sprint. Full pricing design of record: **`PRICING_STRATEGY.md`**.
Items below are de-duped against the 10-feature ship-it list; `[dup]` marks where two agents
converged (build once). Sources are cited in each agent's output / `MARKET_RESEARCH.md`.

### Pricing model — base + per-seat + usage-metered (owner-requested) → build workstream `feat-usage-billing`
Model (from `PRICING_STRATEGY.md`): **Free $0 · Pro $249 (+$29/seat) · Enterprise $649 (+$25/seat)**,
$0 onboarding (undercuts LMN's $797–$1,497). Metered overage priced ≥2.5× labeled 2026 COGS:
**SMS $0.03/seg · AI-credit $0.04 · Live-Ear $0.30/min · aerial lookup $3.00**. Personas prove
70–91% gross margin light+heavy (aerial is the one margin compressor to watch).
- [x] **Usage ledger schema** — SHIPPED (195de58; migration 0017). `usage_events(tenant_id, period, meter, quantity, unit_cost_cents, created_at)` + `tenant_usage` rollup + `tenants.spend_cap_cents`; keep AI-credit back-compat.
- [x] **Generalize `meterCredits()` → `meterUsage(meter, qty)`** (server.ts ~1027): SHIPPED (195de58; `gateUsage()`/`writeUsage()` + env `TIER_ALLOTMENTS`). write ledger + increment rollup, preserve 402-on-exhaustion + fail-open. `AI_CREDITS` → env-driven `TIER_ALLOTMENTS` (seats/credits/sms/live_min/aerial).
- [x] **Metering hooks** — SHIPPED (195de58). AI weights (design/image=5, text=1); SMS per-segment in `/api/sms/send` (keep toll-fraud guard); Live-Ear per-minute (meter on WS close, replace flat 1-credit); aerial per-lookup; PDF nominal past soft cap.
- [x] **Stripe metered subscription items** — SHIPPED (195de58). base Price + per-seat (quantity) + one metered Price/meter via Stripe meter events; extend `/api/stripe/subscribe` + webhook (seat qty; on payment_failed suspend metered ops).
- [x] **Usage dashboard + spend caps** — SHIPPED (195de58). `/api/usage/summary` (multi-meter) + `AiUsage.tsx` per-meter bars + projected bill; spend-cap + 50/80/100% alerts in Settings; enforce `402 SPEND_CAP_EXCEEDED`.
- [ ] **Overage invoicing + prepaid packs** (500 credits/$20); period-close rollup → Stripe metered lines; dunning.
- [ ] **Compliance gate (human/legal)** — A2P 10DLC brand+campaign; TCPA consent + STOP/HELP suppression before paid SMS at scale; 0 SMS included on Free.

### Market-pain features (verified 2025–26 landscaper pains → feature)
- [ ] **AI missed-call / after-hours receptionist + speed-to-lead** (`feat-ai-receptionist`) — HIGH value.
      Inbound call/SMS → AI answers, captures name/address/need, books or creates a lead, texts instant
      reply, alerts owner. Pain: owner in field misses calls; homeowners hire first responder (Invoca ~27%
      of home-services calls unanswered; MIT 78% buy from first responder). NEW (only outbound simulate-call
      exists). Reuse Twilio + Live API + agent executor + Inbox. Add `/api/voice/inbound` + `/api/agent/receptionist`.
- [ ] **Homeowner point-of-sale financing at the close** (`feat-homeowner-financing`) `[dup: ideator #4]` — HIGH.
      Monthly-payment financing (Wisetack/Hearth/Sunbit) inline on estimate/portal for $5k–$50k design-build;
      chains off e-sign + deposit. Reuse `/api/portal/checkout`. *Needs a paid vendor key (human).*
- [ ] **Bilingual (EN/ES) crew field mode + customer-comms translation** (`feat-bilingual-crew`) — MED-HIGH.
      Workforce is majority Spanish-speaking, incumbents English-first. Extends `/api/translate` + useTranslate
      into Field Mode/Closeout/checklists + two-way SMS translation.
- [ ] **Sales-tax on estimates/invoices (jurisdiction-aware)** (`feat-sales-tax`) `[dup: ideator #12]` — MED.
      Landscaping taxability is a 50-state patchwork (maintenance vs capital-improvement flips within a state).
      Stripe Tax / per-jurisdiction table + taxable flag on catalog items; honest fallback to manual `taxRate`.
      *Legal review before GTM copy.*
- [ ] **Customer-facing photo-proof / service verification** (`feat-service-proof`) `[dup: ideator #5]` — MED.
      Surface completion photos + AI snapshot check to the customer on job completion. Revive the built-but-
      unwired `/api/job/snapshot-check` (server.ts:4499) via portal + Closeout capture.
- [ ] **Prepaid / annual maintenance packages** (`feat-prepaid-packages`) `[dup: ideator #7]` — MED.
      Sell prepaid annual programs (winter cash-flow smoothing); maintenance ≈ 44% of market revenue.
      Extends `/api/stripe/recurring/checkout` + Contracts.tsx.
- [ ] **No-fee onboarding + migration wizard** (`feat-onboarding-wizard`) — MED. Cutty-guided setup + import
      that undercuts incumbents' $800–1,500 onboarding wall (GTM weapon). Builds on Cutty + the CSV-import item.
- [ ] **Heat-safety crew check-in + heat-index alert** (`feat-heat-safety`) — LOW-MED, niche. OSHA heat NPRM
      (not final) + 6 state rules. Heat-index warning on the schedule + crew check-in log.
- [ ] **Electric-equipment / CARB compliance flag + badge** (`feat-electric-compliance`) — LOW, niche.
      CA bans *sale* of new gas SORE; HOAs require electric-only. Track equipment fuel type + an "electric crew"
      bid badge. Frame as sale-restriction, not use-ban.
- [ ] **Shared-lead escape / first-party lead engine** — MED (from grandchild research). Angi/HomeAdvisor/
      Thumbtack are widely resented (shared 3–8 ways, non-refundable). Lean into owned booking + reviews + GBP
      as the anti-marketplace pitch; already partially served by `/book` + reviews loop.

### Product-ideation features (ranked; reuse-referenced)
- [ ] **Living Proposal + engagement tracking** (`feat-proposal-tracking`) — TOP PICK. Promote the tiered
      Design vision into a shareable Proposal object (good/better/best + before/after + e-sign + deposit) at a
      capability-token URL, and **log open/view events** back to the owner ("viewed 2×, unsigned") → auto follow-up.
      Makes the whole "close in the driveway" lane measurable (nothing tracks whether the customer opened the quote).
      Reuse `/api/portal/*` + e-sign + `automations.ts` + notifications.
- [ ] **Estimate/proposal win-rate analytics** (`feat-sales-analytics`) — TOP PICK, highest readiness (pure
      aggregate, no key/AI). Sales tab in Reports: quote→win conversion, close rate by tier/service, avg deal,
      stale-estimate list. The metric the design-build beachhead optimizes on.
- [ ] **Deterministic materials & measurement calculator** (`feat-materials-calc`) — TOP PICK. Gemini
      code-execution → mulch cu-yd, sod sqft, paver/plant counts, dosing → deterministic math prefilling estimate
      line items + inventory draws + compliance log. Keeps numbers deterministic (the trust point).
- [ ] **AI job-quality verification at closeout** (`feat-quality-verify`) `[= feat-service-proof]` — revive
      `/api/job/snapshot-check`; departure photo → AI confirms scope match → unlocks review request + gallery.
- [ ] **"Similar past jobs" pricing assist** (`feat-similar-jobs`) — on a new estimate, surface the tenant's 3
      most-similar completed jobs w/ real charged+cost. v1 = one structured Gemini call (mock-safe); embeddings later.
- [ ] **Client-portal upsell: tip + request-more-work + add-ons** (`feat-portal-upsell`) — tip line at checkout,
      "request a quote" → CRM lead, services menu. Small lift on the secured portal.
- [ ] **AI review-reply drafting + post-back** (`feat-review-replies`) — pairs with reviews-ingestion; auto-draft
      on-brand replies to Google reviews, one-tap post-back.
- [ ] **Owner "next best action" queue (clickable)** (`feat-action-queue`) — merge churn + stale estimates +
      overdue AR + unsigned proposals + low stock into one do-list; supersede/absorb AlertsWidget.
- [ ] **On-site "walk the yard" measurement** (`feat-onsite-measure`) — ground photos + reference object → bed/
      lawn sqft (the on-site opposite of aerial takeoff). Label as estimate (accuracy unproven).

<!-- SPRINT BUG LOG continues above. -->

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
- [ ] 4. SMS 10DLC/A2P + TCPA consent + two-party-consent (Live Ear) — gates Inbox/On-My-Way/CRM SMS/recording.
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

## Affordance pass — small missing actions / dead buttons (2026-06-29)

A 3-agent CRUD-affordance audit (money/ops · secondary modules · config/client-facing) looking
specifically for missing add/edit/delete/duplicate/copy buttons, dead buttons, and missing empty
states. The codebase already had a reusable `ConfirmDialog`, `EmptyState`, and full-CRUD repos, so
most were wiring-only. Gates after: `tsc` clean, 172 tests, build OK, 40/40 routes crash-clean.

### FIXED this pass ✅
- [x] **CrewSuite toasts were broken** — Recruit/Edit/Retire/Call called `showToast({title,description,
      variant})` but the toast renders a string, so every crew action showed `[object Object]`/blank.
      Converted all 10 calls to `showToast(message, "success"|"error"|"info")`.
- [x] **Scheduler: no way to delete a job** — added a "Delete Job" button (with confirm) to the job
      modal (`VoiceMemoJobModal.tsx`) calling `jobsRepo.remove`. (The icon was already imported, unused.)
- [x] **CRM: dead "Quick Actions" (`⋮`) button** — wired it to open the customer detail panel.
- [x] **Inventory: misleading "Clear" activity-log button** — relabeled to "Hide" with an honest toast
      (it only blanks local state; the subscription re-pushes).
- [x] **Referrals: no copy-share-link/code button** — added copy buttons (table row + advocate flow);
      **plus a delete-referral row action** (ConfirmDialog).
- [x] **OwnerDigest / CustomerIntelligence: text could only be emailed** — added "Copy" buttons so
      owners/customers without an email on file can still grab the digest / save-play message.
- [x] **RouteOptimizer: stop addresses were dead text** — added per-stop "Open in Google Maps"
      (directions link) + copy-address.
- [x] **DesignStudio: saved visions couldn't be deleted** — added a per-chip delete (`designVisionsRepo.remove`).
- [x] **Compliance: chemical/EPA log was append-only** — added per-row delete (ConfirmDialog) so a
      mistyped regulatory entry can be corrected.
- [x] **Reviews: no "mark as handled"** — added a button so a review answered outside the app can
      leave "Pending".
- [x] **Settings: AI "style learning" textarea saved silently** — added a "Saved." toast + enforced the
      advertised `maxLength={1000}`.

### FIXED — tier 2 (2026-06-29)
- [x] **Search box on Contracts + Invoices** — case-insensitive search on name/number, combined with the
      existing tab/quarter filters.
- [x] **"Duplicate" for invoices / contracts / equipment / inspection forms** — invoices duplicate as a
      fresh draft (new number, no carried payments); contracts/equipment open a pre-filled create modal;
      forms deep-clone their fields.
- [x] **Inbox read/unread state + unread badge** — localStorage per-customer last-read map; unread dot +
      per-conversation count + header total; mark-read on open, plus a "Mark unread" affordance.
- [x] **CRM customer "Estimates" tab** — now queries the customer's draft invoices (by `customerId`, with a
      client-name fallback) and lists them; keeps the empty state when there are none.
- [x] **CRM "Magic Link" button relabeled "Copy Portal Link"** — it copies the portal URL; the real
      send-link action already lives in the detail footer ("Send/Resend Portal Link" → `handleSendMagicLink`).
- [x] **FormBuilder: delete now has a ConfirmDialog** (bonus, done with the duplicate work).

### DEFERRED (still open — bigger / judgment)
- [ ] **Equipment: no edit after create** (only meter/service); wrong interval/crew forces delete+recreate.
- [ ] **InstantEstimate / Closeout: created invoice is a dead-end** — no view/copy-link/navigate after create.
- [ ] **ClientPortal / Portfolio: no share/download** of a proposal or a before/after image.
- [ ] **Dashboard "Add Vendor" dead button** — left for the Dashboard redesign (see `DASHBOARD_PLAN.md`).

## Launch-readiness hardening (2026-06-30)

Knocked out the two highest-value pre-launch de-risking items.

### Container / production boot ✅
- [x] **Verified the prod bundle boots + serves.** `node dist/server.cjs` under `NODE_ENV=production`
      serves the SPA shell (`GET /` and `GET /admin` → 200 text/html) **and** the API
      (`GET /api/health` → 200 JSON), with honest startup degradation when Stripe/Supabase keys
      are absent. (No Docker daemon in-sandbox, so this is the boot+serve smoke; Dockerfile runner
      stage reviewed sound: non-root `appuser`, copies `dist/`, prod-only deps, system Chromium.)
- [x] **Fixed a real Cloud Run port bug.** Server hardcoded `PORT = 3000` and ignored `process.env.PORT`;
      Cloud Run injects `$PORT`. Now `PORT = Number(process.env.PORT) || 3000` (`server.ts`).

### Cross-tenant isolation — verified live + guarded ✅
- [x] **Proved isolation on the real Supabase project** (rolled-back, no persistent data):
      `get_advisors(security)` = **0 issues**; **all 35 public tables** RLS-enabled with policies;
      impersonating tenant A's owner sees only A (1 tenant / 1 customer, **0 rows leaked** from B);
      anonymous role sees **nothing** (0/0/0). Re-runnable script committed at `supabase/RLS_ISOLATION_TEST.sql`.
- [x] **Added a permanent regression guard** (`src/lib/repos/rlsCoverage.test.ts`, +26 tests → **198 total**):
      fails CI if any `makeRepo(...)` table lacks RLS wiring in the committed migrations, and asserts the
      private-schema SECURITY DEFINER helpers + tenant/`role <> client` policy shape.
- [x] **Caught + fixed migration drift.** The coverage test found `referrals`, `equipment`, and
      `compliance_logs` were live (with RLS) but in **no migration file** — a rebuild from
      `supabase/migrations/` would have been missing them (or recreated them world-open). Added
      `0010_referrals_equipment_compliance.sql` (idempotent `create table if not exists` + the standard
      tenant RLS block) so the committed migrations once again reproduce the live schema.

_Remaining engineering before flip-the-flags launch (see `LAUNCH_CHECKLIST.md` for the human config/deploy/verify runbook): offline syncService → Supabase, "Connect Google" buttons, SaaSOwnerGate hardcoded email, invited-employee onboarding UX._

## Firebase fully removed → all-Supabase stack (2026-06-30)

The app was already on **Supabase Auth** (the server verifies tokens with `supabase.auth.getUser()`;
no `firebase-admin` anywhere; RLS keys on the Supabase `auth.jwt()->>'sub'`). Firebase was vestigial;
now it's gone entirely.

- [x] **Gutted `src/lib/firebase.ts`** to a Firebase-free shim — keeps the helpers everything imports
      (`OperationType`, `handleFirestoreError`, `logSystemEvent`) and exports `auth`/`db`/`storage`/
      `analytics` as inert nulls (callers already optional-chain), with **zero** `firebase/*` imports.
- [x] **Migrated document uploads off Firebase Storage → Supabase Storage** (`repos/documents.ts`):
      private `documents` bucket, tenant-scoped by the `tenants/<tenantId>/...` path prefix; signed URLs
      for access. Bucket + storage RLS applied live and captured in `0011_documents_storage.sql`.
- [x] **Removed Firebase Analytics** page tracking (`PageTracker.tsx`, `usePageTracking.ts`).
- [x] **Hid the "Connect Google" (Calendar/Gmail/Keep/Drive/Contacts) buttons** across CRM, Dashboard,
      Invoices, CrewSuite, DesignStudio — the only functional Firebase use (OAuth scopes via
      `signInWithPopup`). They now show an honest "temporarily unavailable" toast. _Re-add later via
      native Google OAuth (no Firebase) — see backlog._
- [x] **Deleted** the dead `src/lib/seedDatabase.ts` (legacy Firestore seeder, unused).
- [x] **Dropped `firebase` + `firebase-admin`** from `package.json`.
- Gates: `tsc` clean, **full build OK** (no unresolved imports), **198 tests**, smoke crawl clean.

### Stack & uptime (decided)
- **Auth + DB + realtime + storage = Supabase** (managed, always-on). **Note:** Supabase **free tier
  pauses after ~7 days idle** — move to **Pro ($25/mo)** before launch so the backend never sleeps.
- **App server = Cloud Run**, kept **always-warm (`min-instances: 1`)** — no cold starts and the
  `/api/live` WebSocket stays alive (~$15-40/mo). Current `cloudbuild.yaml` already sets min 1.
- Add an external **/api/health** uptime check for alerting.

### Follow-up (deferred)
- [ ] **Re-implement Google Calendar/Gmail/Drive sync via native Google OAuth** (no Firebase) when wanted.
- [ ] Optional: delete root `firebase-blueprint.json` / `firebase-applet-config.json` (now unreferenced).

## Trust-bug batch + mapper data-loss fix (2026-06-30) — DONE (gated green, 216 tests)

Picked from the honesty + depth audits: the cluster where the UI claims more than the backend
delivers (the real "demo vs sellable" gap), plus the one confirmed silent data-corruption bug.

### A — Trust bugs (UI claims > backend delivers)
- [ ] **A1. "Autonomous Campaigns" / "Agentic Outreach" send nothing** — toast "Email Scheduled for
      Sending!" but only push to an in-memory outbox. Wire to the real `/api/email/send` (Resend) or
      report honestly (sent vs simulated). `AutonomousCampaigns.tsx`, `AgenticOutreachDrawer.tsx`,
      `WorkspaceOutboxContext.tsx`.
- [ ] **A2. Design Studio fabricates analysis with no mock flag** — `/api/design/process` +
      `/api/design/tiers` invent plants/volumes/ROI while showing "Gemini Analyzing Scene…". Add
      `mock:true` (server) + an honest "sample analysis — set GEMINI_API_KEY" banner (DesignStudio).
- [ ] **A3. RouteOptimizer always simulates** — server checks `GOOGLE_MAPS_API_KEY` but the documented
      var is `GOOGLE_MAPS_PLATFORM_KEY` (`server.ts` routing). Align it so the real Google optimizer runs.
- [ ] **A4. "Revenue Leak Detection" is fabricated** — `/api/revenue/audit` returns hardcoded fake
      clients. Compute real leaks from the tenant's invoices/jobs, or return an honest empty result.
- [ ] **A5. SOC security panel is theater** — inert lockout/owner-alert/circuit-breaker toggles +
      false copy, while the voice agent auto-executes `create_invoice`/`schedule_job` with no confirm.
      Make the panel honest AND add a confirmation gate for high-risk voice actions (`Agent.tsx`, `LiveEar.tsx`).
- [ ] **A6. Restore the invoice PDF path** — over-stubbed during Firebase removal; the Puppeteer PDF
      doesn't need Google. Keep PDF generation, drop only the Gmail-OAuth send (`Invoices.tsx`).

### B — Confirmed silent bug + test
- [ ] **B1. camel/snake key mapper isn't round-trip safe** for columns with a digit segment
      (`address_line_2` → `addressLine2` → `address_line2`). Sits under every repo write. Fix
      `toCamelKey`/`toSnakeKey` in `repos/base.ts` + add unit tests. Tighten the loose `rlsCoverage.test.ts` regex.

### Follow-ups queued (next, after this batch)
- [ ] AR-aging: extract Invoices' inline bucketing to the tested `payments.ts` and test it.
- [ ] Unit-test `agentActions.executeAgentAction`, JobCosting rollup, churn scorer, `timesheets.ts`.
- [ ] Expansion pick: **Reviews reputation loop** (ingest + post) and **card-on-file auto-charge**.
- [ ] `isPrivateIP` IPv4-mapped-IPv6 SSRF edge; `/api/inventory/forecast` drops the inventory array.

## Testing tier — extract + cover the money/decision logic (2026-06-30) — DONE

Pulled the business-critical math out of `@ts-nocheck` page components into pure, tested libs.
Test count 216 → **348** (all green), `tsc` clean, build OK, rewired pages render clean.

- [x] **AR aging** — extracted Invoices' inline bucketing into `payments.ts` `bucketInvoices(invoices, now)`
      (+`ArAging`/`startOfTodayMs`); page now calls it. Tests cover bucket boundaries (30/60/90),
      outstanding vs collected, exclusions (archived/void/draft/paid), no-dueDate fallback, empty input.
- [x] **timesheets.ts** — 34 tests (`minutesBetween`/`weekMinutes`/`startOfWeek`/`activeEntry`/`formatDuration`).
      Pinned two real quirks: cached `durationMins` is trusted over clock math; week membership keyed only on `clockIn` (no boundary proration).
- [x] **agentActions.ts** — 34 tests over the unified agent write path (`parseRules`, `toDateOrNull`,
      `prettyName`, name-split + amount/date dispatch). **Fixed a real money bug it surfaced:** amount
      coercion `Number("$1,200")` → NaN → **$0 invoice**; added `parseMoney()` (strips `$`/commas) + tests.
- [x] **JobCosting** — extracted the rollup into `lib/jobCosting.ts` (`rollupJobCosts`, `marginBand`, id
      resolvers, material costing); page wired to it. 24 tests (attribution, even-allocation fallback,
      margin bands, 60-job cap, NaN guards).
- [x] **Customer health/churn** — extracted into `lib/customerHealth.ts` (`customerHealth(signals)` +
      `healthBandLabel`); page wired to it. 36 tests (every penalty threshold, clamp [0,100], reasons).

### Follow-ups noted by the tests (not yet fixed)
- [ ] `weekMinutes` trusts a stale cached `durationMins` over clockIn→clockOut — consider recomputing.
- [ ] No week-boundary proration in `weekMinutes` (whole entry counts to the week it starts in).

### Next: expansion pick — Reviews reputation loop (ingest + post) · then card-on-file auto-charge.

## Expansion: Reviews reputation loop (2026-06-30) — partially shipped

The hollowest feature, made real where it can be without external API verification:
- [x] **`/api/reviews/reply` endpoint now exists** (was 404 → client always fell back to draft).
      Publishes the owner's reply to Google Business Profile when configured
      (`GOOGLE_BUSINESS_ACCESS_TOKEN` + the review's platform `name`/`externalId`); otherwise
      returns honest `{ posted:false, configured:false, reason }`. The Reviews page already
      reads `posted`/`configured` and shows an honest "posted" vs "saved as draft" badge.
- [x] **Review-request solicitation now includes a one-click review link** — added a
      "Google Review Link" field to Settings → Business Defaults; `solicitRecentJobs` appends it
      to the emailed request (omitted cleanly when unset). Sending was already real/honest.
- [ ] **Ingestion (the remaining half)** — pull live Google/Yelp reviews into the `reviews`
      table (needs Google Business Profile API + OAuth = human-config). Stopgap: add a manual
      "Log a review" entry so an operator can record reviews from any platform and run the
      AI-reply→post/track loop today without the integration.
- [ ] (config) document `GOOGLE_BUSINESS_ACCESS_TOKEN` in `.env.example` when the integration lands.

## 100-CONCURRENT-CUSTOMER BATTLE-READINESS SPRINT (2026-06-30) — IN PROGRESS

6-auditor deep pass (scale · design-studio · live-ear · agentic · walkthrough · client-perf).
Triaged into waves. [x] = already landed this sprint.

### Wave 0 — already fixed earlier this sprint
- [x] Shared Puppeteer renderer (one Chromium + semaphore) replacing 4 per-request launches.
- [x] Live Ear mock-mode demo actions flagged demo:true; client renders preview, never executes.
- [x] Agent persona/model/temperature wired into /api/agent/chat + /api/brain/query (allowlisted, clamped).
- [x] /api/brain/query: real tenant SNAPSHOT injected + honest prompt (no more "access to entire DB" lie).
- [x] CuttyChat honest loading copy (dropped "querying encrypted vectors").
- [x] /api/scheduler/optimize + /api/inventory/forecast mock flag / pass inventory through.
- [x] Invited-employee onboarding → agreements-only path (no owner wizard).

### Wave 1 — P0 scale/correctness holes (make 100-concurrent not fall over / not lie)
- [x] repos/base.ts: unique realtime channel topic per subscription (fix silent cross-component kill).
- [x] repos/base.ts: apply postgres_changes deltas by id + trailing-debounced refetch (kill refetch storm).
- [x] repos/base.ts: paginate list() past the 1000-row PostgREST cap (money screens truncate today).
- [x] server.ts: default 1mb JSON parser; 20mb only on image routes; scan string leaves not stringified body; word-boundary injection patterns.
- [x] cloudbuild.yaml: set REQUIRE_AUTH/NODE_ENV + secrets; server.ts fail-fast (exit) in prod without REQUIRE_AUTH+GEMINI_API_KEY.
- [x] server.ts: renderPdf residual — single-flight launch promise, while-loop semaphore, idle browser close.
- [x] server.ts: outbound timeouts — GoogleGenAI httpOptions.timeout (60s) bounds every AI + Live call (the dominant hang vector). _Residual: AbortSignal on the config-gated integration fetches (Google Docs/Sheets/Gmail/QuickBooks/Resend) — lower priority, a shared fetchWithTimeout helper. Tracked below._
- [x] Four AI routes call non-existent ai.models.get(...).generateContent → 500 w/ real key (onboarding-magic/scrape/vision + analyze-property?). Route through ai.models.generateContent. (6 sites fixed.)
- [x] CRM sample-data crash: company-only seeded customer → client.firstName[0] throws. Guard render + fix seed.
- [x] aiLimiter mounted on money paths (invoice PDF) → false "AI limit" 429. Dropped the /api/invoices/ (plural) mount — only route there is generate-pdf (pure Puppeteer); globalLimiter still protects it.

### Wave 2 — flagship P0/P1 (Design Studio, Live Ear, agentic) trust + wow
- [x] DesignStudio: judge-retry discards a paid successful render on retry error — keep best render.
- [x] DesignStudio: tier/credit gate → honest message (not "try again"/raw code); check before the work.
- [x] DesignStudio: re-finalize after Refine wipes running quote (materials/palette/tiers) — merge.
- [x] DesignStudio: HEIC/undecodable upload fails silently — detect + friendly message.
- [x] DesignStudio: staged narrated progress for 10-40s render (wow); catalog label chips + autosave (wow).
- [ ] DesignStudio: MarkupCanvas marker anchor offset (placements land down-right of the tap).
- [x] LiveEar: retire the double-write cutty-action listeners — executeAgentAction is the single writer; the event is now a post-execution NOTIFICATION and pages only reflect it (select/search/transcript), never re-write or re-open a create modal.
- [x] LiveEar: 24kHz output sample rate (voice replies are slow-mo garble at 16kHz).
- [x] LiveEar: mic-denial + WS-drop surfaced (not stuck "Connecting"); session onclose/onerror + 30s ws heartbeat server-side; client maps close codes (quota/auth/capacity) to actionable copy.
- [x] LiveEar/server: enforce AI quota on /api/live — checks the tenant's monthly wallet (same tiers as HTTP) BEFORE opening the paid session; over-quota closes 4003 → upgrade prompt.
- [x] CuttyChat: add the high-risk confirm gate to the TEXT agent too (parity with LiveEar); fix hair-trigger schedule keyword (interrogative guard so "what's on the schedule?" can't create a job) + follow-up suggestion chips.
- [x] CrewSuite: UPDATE_CREW_STATUS dictation persists (currently says "logged", saves nothing).
- [ ] Closeout: honest invoice delivery + link to customer; job picker (don't bill arbitrary active job).
- [x] server.ts: shared fetchWithTimeout(AbortSignal.timeout) helper wired into ALL ~30 raw outbound fetches (Google APIs, weather, QBO, Resend, GBP, webhook dispatch, video download w/ 180s budget). Replaced the leaky Promise.race timeout too.

### White-hot sellability wave (server + DB, solo lane)
- [x] Live Ear speaks as the TENANT's business (settings.businessName/tenants.name interpolated into the Live system prompt) — no more hardcoded legacy "Meridian Green" brand read aloud to customers.
- [x] /api/workflows/weather + /irrigation: city from request/DEFAULT_WEATHER_CITY (was hardcoded "Meridian" — every tenant got Mississippi weather).
- [x] /api/workflows/followup: real recipient required (was client@example.com), tenant identity + real review URL, escaped interpolation.
- [x] /api/workflows/generate-invoice-pdf: renders the CALLER's invoice under the tenant letterhead, all user data HTML-escaped before Puppeteer (was a fabricated $3,050 demo invoice from a fake letterhead emailed to client@example.com).
- [x] Demo seeder stamps data.isSample on every row (customers/jobs/crews/leads/vendors/inventory/invoices) so sample data is labeled + one-tap clearable.
- [x] Supabase Storage: private "photos" bucket + per-tenant folder RLS (select/insert/update/delete) — base64→Storage migration target.
- [x] Supabase perf migration: split all 28 "<t>_write" FOR ALL policies into insert/update/delete-only (SELECT now evaluates ONE policy), wrapped auth helpers in initplan subselects, scoped policies TO authenticated, indexed 11 unindexed FKs. Advisors: 0 security lints; 146 multiple-permissive + 4 initplan warns cleared. Verified with a live 2-tenant RLS simulation (6/6 isolation checks pass).
- [x] .env.example: DEFAULT_WEATHER_CITY, GEMINI_TIMEOUT_MS, LIVE_MAX_CONNECTIONS documented.

### Security audit remediation (10/10 confirmed findings, adversarially verified)
- [x] HIGH proposal-pdf XSS/SSRF: esc() now escapes quotes/&/'; images validated as data:image URIs; renderPdf hardened globally (JS disabled + only data: requests allowed) — protects every PDF template.
- [x] HIGH QuickBooks OAuth: callback derived tenant from a raw `state` (token-planting onto any tenant). Now HMAC-signed, short-TTL, tamper-proof state; verified with a 4-case test (valid/forged/tampered/expired).
- [x] MED webhook SSRF redirect: /api/automations/webhook fetch now redirect:"error" (a 3xx couldn't be bounced to an internal host after the initial URL check).
- [x] MED DNS-rebind/SSRF: validateSafeUrl checks ALL resolved addresses (was first-only); isPrivateIP now covers 100.64/10 CGNAT + IPv4-mapped IPv6 (::ffff:169.254.169.254).
- [x] MED cache PII bleed: cacheApiResponse emitted Cache-Control: public,s-maxage on authed tenant data. Now private,max-age + Vary — shared CDNs can't cross-serve tenants (in-process tenant-keyed cache keeps the speedup).
- [x] MED SMS toll-fraud: /api/sms/send accepted any `to`. Now requires E.164 + the number must belong to one of the caller's own customers (tenant-scoped).
- [x] LOW reviews/reply IDOR: review lookup scoped to the caller's tenant (was id-only service-role query → cross-tenant GBP reply).
- [x] LOW error leakage: swept ~45 catch blocks so 500s return a generic message (raw Supabase/Stripe/Gemini detail stays in server logs only).
- [x] MED CSV injection (CRM export + Reports export): new src/lib/csv.ts (csvCell neutralizes = + - @ formula leads + quote-escapes; tested); wired into both exports.
- [x] Supabase security advisors: 0 lints. RLS 2-tenant isolation simulation: 6/6 pass.

### Wave 3 — walkthrough "don't make me think" wow
- [x] Quick Create deep-links into prefilled open modals — `?create=client|job|invoice` opens the
      target page's modal on arrival and strips the param (CRM/Scheduler/Invoices). (Draft Quote still
      lands on CRM; wire a quote deep-link once the quote modal supports a standalone open.)
- [ ] Persistent "next best step" setup checklist on Dashboard (real tenant counts).
- [ ] Guided tour: fix/skip missing spotlight IDs; survive refresh; re-offer; mobile anchors.
- [ ] Sample data labeled + one-tap clear; demo mode survives refresh.
- [ ] Add-Client: relax required fields (name+phone only) + human error copy.
- [ ] Dashboard aggregates useMemo; CommandPalette server-search not full-table fetch.

### Wave 4 — offline/multi-tab hardening (larger; some L)
- [ ] base64 photos/renders → Supabase Storage (row bloat epicenter) + migration.
- [ ] Field-mode completion offline-safe via syncService; queue multi-tab lock + idempotency + dead-letter (poison pill).
- [ ] Offline empty-vs-error distinction + last-known snapshot; fix dead workbox /api GET rules.
- [ ] Inbox read-map storage-event merge across tabs.
- [ ] (wow/L) One shared refcounted per-table live store behind subscribe() — retires several P0s at once.
