The Settings section in the input JSON is truncated mid-sentence (cut off at "owner email field exists but there is no SMTP/Resend-backed verifi"). I'll include the Settings section faithfully with the substance that's present, noting it was the last section. Here is the master audit document.

# YardWorx Deep-Dive App Audit

YardWorx is an AI-native, multi-tenant field-service / landscaping operations SaaS ("Operational Cockpit") built as a React 19 + Vite PWA frontend over a single large Express backend (`server.ts`) that proxies Google Gemini, renders PDFs with Puppeteer, runs a WebSocket "Live" voice endpoint, and serves the SPA; data and auth run on Supabase (with a legacy Firebase shim still referenced in places). This document is a section-by-section, state-of-the-app audit: for each major screen/feature it records the intended purpose, what genuinely works today, what is missing or stubbed, and what needs external research before further investment. A recurring finding across the app is a "graceful fallback to success" pattern (showing "Synced!"/"Sent!" when an integration actually failed or only simulated), alongside a strong core of real Supabase CRUD and honest mock-mode degradation in the better-built sections.

---

## BUSINESS

### Dashboard
**Purpose:** The owner/admin landing "Operational Cockpit" — a configurable widget grid (briefing, weather, active crews, inventory, earnings, alerts, Google Workspace, design), three "Easy Mode" big buttons (today's stops, AI dialer, inventory scanner), an onboarding wizard, an AI layout calibrator, and quick-add-client. The owner/foreman daily home screen.

**What works:** Live data subscriptions to crews/leads/vendors/invoices via Supabase repos, with real derived analytics computed only from PAID invoices (`computeEarnings`, `computeAnalytics`, `computeAlerts`, `computeTopServices`) that return null/empty so widgets honestly fall back to clearly-labeled samples. Quick-add-client really calls `customersRepo.create` (with an 8s timeout race). Onboarding/widget config persists to localStorage.

**What's missing:**
- Delete the duplicate mock `/api/weather` route (server.ts:2869); wire the Dashboard to the real `{configured,temp,condition,delayRisk}` shape with a geolocation/city setting — today a real key and a coin-flip mock answer the same path, and the frontend ignores the `configured:false` shape.
- Kill the "graceful fallback to success" pattern across all Workspace/integration handlers — showing "Synced!"/"Dispatched!" when the API failed or was cancelled is dishonest and will burn a paying landscaper.
- Make the Morning Briefing email/calendar sync use REAL crew+job data instead of hardcoded Alpha/Beta/Gamma crews and "Schmidt Residence" placeholders.
- Real server-side Google OAuth token storage/refresh (tokens live only in React state + a localStorage flag; lost on reload, never refreshed).
- Wire the three "Easy Mode" buttons/drawers to real Scheduler/CRM/Inventory data instead of simulation endpoints.
- Persist widget layout per-user server-side (localStorage only; lost across devices).
- A real "today's stops / route" summary (crews are shown, but no real schedule-for-today join).

**Needs research:**
- Which integrations a solo/small landscaper actually wants day one (Google Calendar + QuickBooks vs Jobber-style native scheduling) before investing in the faked 10-app Google surface.
- Whether Google Workspace API scopes (gmail.send, calendar, drive, chat, keep) can be approved for a SaaS without Google's restricted-scope security assessment (CASA audit $$$) — this gates whether the Workspace widget can ever be real.
- Competitor dashboards (Jobber, Yardbook, LawnStarter) — which KPIs landscapers expect on a home screen to define a credible default layout.

### CRM
**Purpose:** The core customer/lead hub: directory with search/segments, add/edit/delete, bulk tag/delete, CSV + Google Contacts import, per-customer detail with AI briefing/property analysis/proposal drafting/enrichment, HOA bylaws + gate code, SMS, magic-link portal invite, and tabs for Dashboard/Pipeline/Map/Tasks/Documents/Notes/Campaigns. The primary screen the owner lives in.

**What works:** The most genuinely functional section in this cluster. Real Supabase CRUD: realtime subscribe, create with deterministic lead scoring (`computeLeadScore`), update, soft-delete, bulk delete, bulk tag. A careful jsonb adapter layer (`adaptCustomer`/`toRow`) flattens `data`/`customFields` and fixes `isHoa` casing per read/write. Zod validation on add/edit; CSV import via Papaparse with header aliasing behind an admin/owner gate. Magic-link generation calls a real owner-scoped JWT endpoint that verifies the client belongs to the caller's tenant. AI endpoints are real Gemini calls that degrade honestly — `/api/crm/enrich` returns a null value + "Connect a Gemini key" in mock mode.

**What's missing:**
- An honest SMS path: don't claim "sent securely via Twilio" when the server simulated it — surface `simulated:true` to the user (the portal already does this).
- Remove or implement the dead `/api/crm/clients` stub (returns `{status:'ok'}`).
- Server-side role enforcement for destructive ops — the CSV gate is client-side only and bypassable; rely on RLS/server.
- De-dupe/merge on CSV + Google import (re-importing currently creates duplicate clients).
- A real per-customer activity timeline (the briefing passes `interactions:[]` hardcoded; no real history feeds the AI).
- Replace the fabricated property-value growth chart with real enrichment data or remove it (invented numbers shown to a paying user).
- Persist SMS/message history per customer (currently local-only; a `customer_messages` table exists and should back it).
- Confirm the Estimates/Jobs detail tabs are wired to real data, not placeholders.

**Needs research:**
- Whether AI lead scoring + property enrichment is a real differentiator or noise for landscapers (the deterministic score is defensible; "property value/soil/upsell probability" may read as made-up to skeptics).
- Google restricted-scope verification (contacts.readonly / gmail.readonly / keep) — same CASA gate as the Dashboard.
- What CRM export formats incumbents (Jobber, LMN, Yardbook) produce, so CSV import maps their columns out-of-the-box (today only generic name/email aliases).

### Client Portal
**Purpose:** The end-client-facing portal (the landscaper's customer): token-gated, no app login. Tabs for Dashboard, Jobs (service history), Invoices (view/pay/download PDF), Design (approve AI proposals), Messages (two-way thread). A real sellable self-service feature.

**What works:** A sound capability-token security model: the only credential is a signed JWT `{clientId,tenantId,scope:'portal'}` minted owner-only after verifying client ownership. `verifyPortalToken` ignores any client id in the body and scopes every query to the token's `clientId`; every endpoint re-checks ownership ("Not your invoice"/"Not your proposal") plus a tenant scope-mismatch check. Reads use service-role with explicit field whitelists (no raw row leakage). End-to-end flows work (given JWT_SECRET + service role + Supabase): aggregated portal data, client→business messages, proposal approval (flips `approved` and drops a thread note), and a real Puppeteer invoice PDF with XSS-escaped fields. The frontend is honest — payment explicitly detects the Stripe simulated/mock response and tells the client "Online payments aren't enabled yet" rather than faking success.

**What's missing:**
- Token revocation/invalidation (a leaked 7-day link can't be killed — add a per-client token version or server-side allowlist).
- Email/SMS notification to the client on new invoice/message/design (the portal is passive; clients won't return unless pinged).
- Realtime or polling for the Messages thread (currently reload-only).
- Actual email delivery of the magic link itself — today it's only dropped into the WorkspaceOutbox log for manual copy.
- Verify the full Stripe Connect portal-payment flow against a real connected account (application_fee logic unproven).
- A "request service / request cleanup" action (the DataMap page promises it; the portal has no such button).
- Per-tenant branding (logo/colors) — only tenant name is shown.

**Needs research:**
- Whether end-clients of small landscapers will use a portal vs just texting (compare Jobber client-hub adoption).
- Stripe Connect requirements and platform-fee legality (KYC flow; Express vs Standard accounts for "pay your invoice").
- Notification channel preferences (email vs SMS) and deliverability/compliance (TCPA/10DLC) before building the notification layer.

### Customer Intelligence
**Purpose:** Owner analytics fusing a churn-risk radar (who's leaving + why + a one-click AI "save play") with per-customer profitability/LTV (revenue vs estimated cost, margin %, and a keep/raise-price/drop verdict).

**What works:** Strong, mostly-real client-side analytics. Loads 8 repos in parallel with per-repo fallbacks; computes LTV from invoices matched by customer id OR name, estimates cost from timesheet labor (configurable hourly rate, default $35) plus job-linked materials/expenses, derives margin and an explainable 0-100 health score (stale last job, overdue invoices, weak reviews, declined jobs, at-risk contracts), and HONESTLY tags figures "est." when cost can't be resolved. Save play posts to `/api/agent/save-play` returning structured `{channel,subject,message,offer,reasoning}` (sensible canned play in mock mode); send-play email reports sent vs simulated honestly.

**What's missing:**
- Persist computed scores + save-play history (sent_at, channel, outcome) so intervention is tracked, not fire-and-forget.
- Move the heavy multi-table computation server-side / to a materialized view for scale and cross-device consistency.
- Save play via SMS/call-task in addition to email, plus an in-app task when there's no email.
- Better revenue attribution than fuzzy name matching, and surfacing of data-quality gaps ("cost is est. because no timesheets linked").
- Configurable/validated health-score weights and stated margin assumptions (the $35/hr fallback is a guess).
- Trend-over-time deltas and proactive at-risk alerts instead of on-demand recompute only.

**Needs research:**
- Validated churn signals/weights for recurring home-services customers to replace hardcoded heuristics.
- Standard LTV and gross-margin definitions/benchmarks for landscaping (whether to include overhead).
- Which "save play" offers actually retain landscaping customers, and whether competitors expose per-customer profitability at all (differentiation opportunity).

---

## OPERATIONS

### Scheduler
**Purpose:** The dispatcher/owner job board and calendar: create ("Deploy Unit") jobs, view as a status board or month calendar, change status, reschedule, auto-generate a linked invoice on create, and text customers an arrival window via OnMyWayButton.

**What works:** Real Supabase plumbing — realtime job list, board + calendar views, add-job with a camelCase→row adapter, status change firing `runAutomations` on COMPLETED, inline reschedule, a real (non-blocking) HOA quiet-hours guardrail, and real auto-invoice on create. OnMyWayButton is genuinely wired: resolves phone from job/customer, posts `/api/sms/send` (which self-persists and cleanly simulates when Twilio is unset), and distinguishes simulated vs sent.

**What's missing:**
- Recurring/visit-series jobs (weekly/biweekly mow) — table stakes; today every visit is a one-off.
- Job↔crew assignment in create/edit (the `assignedTo` column exists but nothing sets it), plus per-crew calendar lanes.
- Fix the date-format mismatch: the board buckets on a `YYYY-MM-DD` string, but Closeout writes a full ISO timestamp, so AI-scheduled follow-ups land in the wrong cell. Normalize everywhere.
- A real availability/capacity model (job durations, crew hours, double-booking warnings) instead of a static 08:00–17:00 slot list.
- Drag-and-drop reschedule and a day/week agenda view (month-only today).
- Geocoding on job create so addresses become routable (directly blocks Route Optimizer).
- Customer/address autocomplete linking the free-text "Client Name" to a real record (the HOA check silently no-ops for free-text clients).
- A crew-facing mobile job view (start/complete, checklist, photos).
- Make the voice `schedule_job` path actually persist the date (currently dropped by `toJobRow`, which only maps date/time).

**Needs research:**
- Recurrence model used by Jobber/ServiceTitan/Yardbook (per-visit vs contract-driven) and how users edit a single occurrence vs the series.
- Typical job-duration defaults by service type (and whether crew-size multipliers are needed) for capacity planning.
- SMS volume/compliance for "On My Way" texts (TCPA consent, opt-out) before enabling real Twilio sends.
- How competitors handle HOA/quiet-hours and gate codes — warning vs hard block + surfaced gate code at dispatch.

### Field & Crew
**Purpose:** Enterprise-tier crew command center: recruit/configure/retire crews, filter by status, view crew cards or a resource timeline, assign equipment, run a TimeClock, capture field notes, and a Daily Field Logs feed.

**What works:** Real data plumbing — crews via `crewsRepo.subscribe` with read/write jsonb adapters; recruit/edit/retire hit Supabase via a shared ConfirmDialog; the Daily Field Logs feed is now driven by REAL recent jobs (not hardcoded); the field-note modal persists to the WorkspaceOutbox feed; TimeClock writes to `timesheetsRepo`. Gated behind `SubscriptionGuard` (enterprise).

**What's missing:**
- Live crew GPS / last-known location — the UI declares lat/lng/pingTime/battery/eta but nothing populates them; there is NO tracking backend. The headline "where are my crews" value prop is absent.
- Real geofenced clock-in tied to a job site (the "Check-In (Geofence)" button just reads geolocation once and writes a text log — no geofence math).
- Crew↔job assignment that links to the jobs table and reflects on the Scheduler.
- Replace the hardcoded "Dispatch to Owner" fake summary (literal "Alpha Squadron"/"114 Maple Street") with a real generated report sent server-side — not browser→Gmail with a localStorage token.
- Drive efficiency/incidents from real signals (completed jobs, time-on-site, photos) instead of static seed constants (efficiency:95, incidents:0).
- Fix the `showToast` call-signature mismatch (object args vs `(msg, type)`) so crew CRUD feedback renders.
- Source equipment/resource lists from the inventory/equipment repos, not hardcoded arrays.
- Per-employee roster (individual workers, roles, pay rates) for labor-cost rollups / job costing.
- Reconsider the enterprise-tier gate — basic crew tracking is table stakes a solo/small landscaper expects, not an upsell.

**Needs research:**
- GPS/tracking approach used by competitors (native background location vs telematics like Azuga/Samsara) and battery/privacy/consent implications.
- Labor-law constraints on geofenced time tracking and storing employee location (state-by-state US consent).
- Whether small landscapers use Google Chat/Gmail dispatch or expect SMS/WhatsApp/push.
- Crew-productivity metrics owners actually care about (jobs/day, revenue/crew-hour, drive-time ratio) to replace the placeholder efficiency score.

### Tailgate Closeout
**Purpose:** The flagship voice-first field workflow: a crew member dictates what happened ("finished the Johnson mow, bill the usual, come back Tuesday, used two bags of mulch") and the app turns it into one-tap confirmation cards (close job, invoice, schedule follow-up, flag inventory, save note) with a Gmail-style undo.

**What works:** The most complete feature in this cluster. Speech capture with live transcript ribbon and example chips; active-job resolution; a well-designed Gemini prompt with strict JSON, risk tiers, and a "NEVER invent a price; if implied set `fromCatalog:true`" rule. Mock mode returns a sensible default plan flagged `simulated`, so the flow is testable keyless. Action hydration fills line-items from the catalog. Execution is REAL and writes to Supabase (close_job→COMPLETED with undo, invoice→create with void undo, schedule→create with remove undo, inventory→flag LOW_STOCK, note→knowledge create with undo), wired through an Undo chip.

**What's missing:**
- **Enforce the high-risk confirm gate** — the code intends explicit confirm before sending an invoice, but `sel[a.id]` is set true for all risks and `doAll()` executes every selected action regardless of `confirmed[]`. The "requires confirm before sending money" safety is bypassable (a real money risk).
- Link the generated invoice to the customer (`customerId`) so it appears in the CRM thread and portal, not just a free-text name.
- Normalize follow-up dates to the Scheduler's `YYYY-MM-DD` so they appear on the board (same bug as Scheduler).
- Fire automations (review request, follow-up) on close_job, matching the Scheduler completion path.
- Before/after photo capture at close (core proof-of-service expectation).
- Material/quantity capture that decrements real inventory counts, not just flags LOW_STOCK.
- Offline support — `syncService` exists but isn't used here; the dictation+execute flow should queue.
- Editable/confirmable line items with tax and the tenant's real pricing rules before invoice creation.

**Needs research:**
- Speech-recognition reliability in noisy outdoor/truck environments and across accents — is the browser Web Speech API enough, or is server-side transcription (Whisper/Gemini audio) needed?
- How much human confirmation contractors want before an AI sends an invoice (liability/UX).
- How competitors (Jobber/Workiz) handle field job-close + invoice-on-site, and whether crews or owners close out.
- Tax/jurisdiction handling for on-site invoice totals (sales tax on services varies by US state).

### Route Optimizer
**Purpose:** Optimize the driving order of the day's scheduled stops to cut drive time/mileage: shows today's SCHEDULED jobs on a Google Map, runs the Google Routes API for optimal waypoint order, and shows the ordered stop list plus total drive time/distance.

**What works:** The optimization plumbing is real — pulls today's SCHEDULED jobs with an address, fetches the Maps key from `/api/config/maps`, renders the `@vis.gl/react-google-maps` map, POSTs waypoints to `/api/workflows/routing` (calls `computeRoutes` with `optimizeWaypointOrder:true` and a proper FieldMask), parses `optimizedIntermediateWaypointIndex` to reorder, formats duration/miles, and handles the simulated/soft-failure path with a UI banner.

**What's missing:**
- **A geocoding step (address→lat/lng) on job create/edit — the single blocking gap.** A job is only routable if it already carries coords, but nothing in the app ever geocodes (zero geocode endpoints in `server.ts`), so `waypoints` is almost always empty and the optimizer cannot be exercised with normal data.
- A real per-tenant depot/HQ start+end instead of using the first/last job as origin/destination.
- Draw the optimized polyline (fetched in the FieldMask but never rendered) and number stops in true visiting order.
- Multi-vehicle/multi-crew routing and assignment of routes back to crews.
- "Open in Google/Apple Maps" turn-by-turn handoff and a crew-facing route view.
- Date selector / multi-day planning (hardcoded to today).
- Persist the optimized order back onto the jobs (sequence number) so Scheduler and crews see it.
- Account for service/on-site time per stop and time windows, not just drive time.

**Needs research:**
- Best geocoding provider + cost/quota at small-landscaper scale (Google vs Mapbox vs Nominatim) and caching strategy.
- Whether to use Google's Route Optimization API (true VRP, multi-vehicle, time windows) instead of `computeRoutes optimizeWaypointOrder`, and its pricing.
- How competitors price/position routing (premium vs table stakes for route-density mowing businesses).
- Driver handoff expectations (in-app nav vs deep link) and offline route availability.

### Equipment & Fleet
**Purpose:** Maintenance/service tracker for mowers, trucks, trimmers, blowers: per asset a meter (hours or miles), service interval, and last-service baseline, computing DUE / DUE SOON / OK / UNKNOWN so crews service gear before it fails mid-route.

**What works:** The most complete and honest of the operations trio. `serviceStatus` is a clean pure function with correct color bands and progress bars. Full CRUD through `equipmentRepo` with live subscribe: inline meter update by meter type, one-tap Log Service (stamps today + carries the reading into the baseline to reset usage), delete with confirm, add-equipment with jsonb flatten. Real summary rollups (asset count, due count, fleet value from purchaseCost), due-first sorting, crew dropdown with free-text fallback, and proper empty/loading states. No stubs or fake AI.

**What's missing:**
- Service HISTORY/log — Log Service only overwrites the baseline; no record of past services, costs, or what was done (no maintenance audit trail or cost-per-asset).
- Maintenance cost tracking & TCO (only purchaseCost is captured; "Fleet Value" is purchase-only with no run-cost insight).
- Notifications/reminders — DUE is passive; no push/email/SMS or dashboard nag (the whole point is "don't grenade mid-route").
- Multiple service types per asset (oil vs blade vs belt vs inspection) — today a single global interval per meter.
- Calendar/time-based intervals (annual inspection, registration) in addition to meter-based.
- Job/route integration (accrue engine-hours from completed jobs; block scheduling an overdue asset; link `assignedCrew` to real crews).
- Document/photo attachments (receipts, manuals, warranty, VIN) and warranty-expiry tracking.
- Depreciation / replacement-planning view for capital decisions.

**Needs research:**
- Competitor fleet/maintenance features (LMN, Jobber, Fleetio, Aspire) — especially whether buyers expect telematics/GPS hour-meter auto-sync.
- Standard OEM service intervals for common equipment (Exmark/Scag/Toro, Stihl) to ship sensible defaults.
- Whether small landscapers want telematics integration (Samsara/Fleetio/OEM APIs) or manual entry is acceptable for the beachhead.
- DOT/inspection and registration-renewal tracking a fleet tool should surface for trucks/trailers.

### Form Builder / Inspections
**Purpose:** Lets an admin define custom per-job-type inspection checklists (label, type: text/checkbox/number/photo, required flag); crews complete them in Field Mode on matching jobs, producing a per-job QA record.

**What works:** End-to-end as a basic template builder, genuinely wired to the field flow. Builder CRUD is solid (subscribe maps column→`jobType`; create/update/remove via `inspectionFormsRepo`; fields persist as jsonb with `status:'active'`). The CONSUMER exists: `FieldModeInterface` subscribes to the same repo, renders matching forms by fuzzy job-title match, enforces required fields before completion, and saves answers as `inspectionResponses` in the completion payload.

**What's missing:**
- Replace fuzzy title-substring matching with an explicit job-type/service association (link forms to the service catalog, not "title contains").
- Verify and complete the "Photo Upload" field type — capture, compress, upload to storage, store the URL; today it's a selectable type with unclear capture support.
- Inspection report output: a per-job completed-inspection view + PDF/share for client and QA (responses currently buried in the job's jsonb).
- More field types + validation (dropdown with options, min/max, signature, date, multi-photo, conditional fields).
- Template versioning so editing a form doesn't retroactively change past submissions.
- Remove the leftover Firestore shim import (`handleFirestoreError`/`OperationType` from `lib/firebase`) in this Supabase-only app (note: this file is not `@ts-nocheck`).
- Required-field UX in the builder and a pass/fail or scoring concept for QA.
- Assign forms by crew/role and make completion more visibly gate clock-out/sign-off.

**Needs research:**
- What competitors (Jobber, Aspire, SingleOps, FieldRoutes) offer for custom inspection/checklist forms, and whether photo-required QA is a differentiator or table stakes.
- Whether landscapers want inspections for internal QA, client proof-of-service, or insurance/liability evidence (drives report/photo emphasis).
- Standard starter templates landscapers expect (pre/post-job, equipment safety, irrigation check, hardscape punch list).
- Photo-evidence storage/retention expectations and cost (photos/month per crew) for storage sizing.

### Compliance
**Purpose:** Safety & regulatory module (admin/owner): (1) EPA Logging — quick chemical-application entry with an AI weather/drift "safety check" and a typed human signature; (2) Chemical Log — a structured pesticide/herbicide/fertilizer ledger for state+EPA recordkeeping; (3) Enterprise Audit Trail from `audit_logs`.

**What works:** The Chemical Log tab is the strongest piece — validates required fields and writes via `complianceLogsRepo.create` (snake-izes keys, stamps `tenant_id`), renders the ledger live, and links applications to customers. The EPA-tab `submitLog` writes a structured record into `audit_logs` with meta (chemical/amount/signedBy/weatherSafe); signature gating keys off `tenant.settings.subFeatures.requireSignature`. The Audit tab reads `audit_logs` and adapts rows for `AuditTrail`.

**What's missing:**
- Fix mock-mode for `/api/compliance/check` (no `getMockText` branch matches its system instruction, so it returns the plain "I'm a mock AI response…" string; `parseGeminiJson` then yields a non-object and the panel shows "undefined mph / undefined% Rain"). Add a branch returning `{safe,message,wind,precipitation}`.
- Replace the simulated random weather for "Meridian, MS" with a real geocoded weather/wind/precip lookup tied to the job site — the current "safety check" is theater, not a real drift/runoff guardrail.
- Unify the EPA-tab and Chemical-tab stores (one writes `audit_logs`, the other `compliance_logs`) into a single compliant ledger.
- Captured-signature UX (today a typed name only; regulators/disputes need a signed, time/location-stamped record).
- Export: state-format application reports / annual recordkeeping (PDF/CSV) — there is no way to hand records to an inspector.
- Per-product compliance metadata (REI, PHI, max annual rate, applicator-license expiry) validated against the label.
- Edit/void/correction workflow with audit on the immutable ledger (currently create-only).
- Attachments (product label / SDS photo) and PPE checklist capture.
- Wire chemical use back to inventory (decrement the matching item).
- Remove or properly wire the orphaned hardcoded Google Sheets `/api/workflows/chemical-log` endpoint.

**Needs research:**
- State-by-state pesticide recordkeeping mandates (CA DPR, FL, TX, …): required fields, retention, submission formats; which states landscapers actually get audited in.
- What competitors (Jobber, Aspire, RealGreen, SingleOps) provide for chemical/EPA logging and whether it's a paid add-on or table stakes.
- Whether a real drift-risk model (wind speed/direction, Delta-T, inversion) is expected by certified applicators or a basic wind+rain check suffices.
- Legal weight of a typed-name signature vs captured signature (ESIGN/UETA) for application logs.
- Best parcel-level weather source (NWS, OpenWeather, Tomorrow.io) and cost at field-crew scale.

### Inventory
**Purpose:** Material/supply tracking: catalog by category (Bulk/Consumables/Fuel/Hardware), stock levels + low-stock thresholds, in/out movement logging, AI image-based item ID, barcode scanning, a cubic-yard calculator, and an AI demand "forecast." Surfaces ROI/"leakage" metrics.

**What works:** Solid core CRUD/usage. Live item list + recent logs via subscribe; `adaptItem` merges jsonb up; `logUsage` updates quantity, writes a `material_logs` row, fires audit/system events, and on crossing the threshold ingests a knowledge "low stock" note + logs LOW_STOCK_ALERT. Add/restock, edit, soft-delete (ConfirmDialog), and a knowledge "REORDER REQUEST" note all work. Manual barcode entry + BarcodeScanner match by barcode/partNumber. The cubic-yard calculator is real arithmetic. Voice "cutty-action" events drive check/log usage and queue a billable expense. Category filter + search work. `/api/inventory/check-and-alert` is a real low-stock Supabase query.

**What's missing:**
- Replace fabricated ROI/leakage metrics — flat $65/unit "Recovered Assets," a $65/unit valuation fallback, an invented 4.2% "Leakage Index" nudged 0.1 per log with a hardcoded "Benchmark Variance 0.8%," static "Usage Intensity" bars, and "Audit Integrity 100% SECURE" — with real per-item cost and real consumption analytics.
- Fix `process-image` mock to return a valid category + suggestedUnit/vendor/barcode (mock currently returns `category:'Supplies'`, which isn't a valid UI category).
- Real reorder workflow: turn "Initiate Recovery"/reorder from a knowledge note into an actual PO / vendor email / reorder list with quantities and cost.
- Normalize per-item cost/unit-price naming (`unitCost` vs `unitPrice`) so valuation is real, not a $65 placeholder.
- Explicit job/material attribution in the UI (usage can carry a `jobId` but only the voice path sets it) for true material-to-job costing and billing.
- Vendor management + price history (`vendorsRepo` exists but isn't wired here).
- Real low-stock notifications (email/SMS/push) surfaced to the owner, not just a knowledge note.
- Bulk CSV import so a landscaper can onboard a catalog without scanning each item.
- Unit-of-measure consistency and conversions (gallons/bags/tons/yards).
- Verify StockDepletionChart / InventoryForecast read real history vs placeholder.

**Needs research:**
- Realistic material-shrinkage/leakage benchmarks for landscaping (the 4.2%/0.8% figures are invented) — find cited data before showing any leakage index.
- What inventory features landscapers pay for (Aspire, SingleOps, Arborgold): job-cost material attribution, vendor PO integration (SiteOne/Ewing), or simple counts.
- Barcode/UPC coverage for landscaping consumables (STIHL parts, chemicals) — is camera scan useful, or are most items un-barcoded bulk?
- Vendor API/auto-reorder feasibility (SiteOne, Ewing, John Deere Landscapes) and whether buyers expect punch-out/PO sync.
- Accuracy of AI image ID for bulk piles (mulch vs gravel) vs packaged goods.
- Whether crews will reliably log material usage at all (adoption risk) — field-usability patterns (voice vs tap vs scan).

---

## FINANCE

### Invoices
**Purpose:** The contractor's billing ledger: create/send invoices (manual, AI-from-transcript, or voice), track Expenses (OCR receipt scan), manage Service Rates, mark paid/sent, generate a PDF + Gmail draft, set up recurring/seasonal Stripe billing, and convert an estimate into a recurring contract.

**What works:** Genuine invoice/expense CRUD via Supabase repos with realtime subscribe and camelCase↔jsonb adapters; quarter filter; soft-delete archive; mark paid/sent with an offline `syncService` queue; an `invoice_paid` automation that fires exactly once on the paid transition (first-snapshot guard); print-to-PDF; and a manual + AI-draft modal with editable line items pulling rates from the tenant catalog. **Server-side Stripe is genuinely hardened:** `/api/stripe/checkout` derives amount + connected account from Supabase by invoiceId and refuses client-supplied amounts; the webhook is raw-body-before-json, idempotent, and marks invoice paid + sets tenant tier; recurring checkout builds subscription-mode sessions with a platform fee; portal invoice-PDF is portal-token-scoped with an ownership check.

**What's missing:**
- **Tax** — invoices have no tax field anywhere; most US states require sales tax on landscaping. Total is a naive `rate*qty` sum.
- Real invoice numbering (today `INV-` + 6 chars of a UUID; no per-tenant sequential counter accountants expect).
- One-click "send" that actually delivers — today "Send Invoice" only flips status; real delivery needs a Gmail OAuth popup + manual Gmail send, and the PDF is attached to a DRAFT, not sent. Need server-side email send (no popup) with an embedded Stripe pay link.
- Due dates / payment terms / late fees + overdue aging and reminders (`dueDate` is mapped but never set).
- Deposits / partial payments / payment plans (server supports a "deposit" type the UI never uses; no balance tracking).
- Discounts, line-item notes, and a real client/billing address block on the PDF (PDF has no company info/logo/remit-to/terms; hardcoded to old "Cutty" brand).
- Branded/configurable PDF (tenant logo/colors/footer).
- Better recurring UX (replace `window.prompt` for interval; view/cancel active subscriptions).
- Expense categories/tax deductibility/mileage and an expense→job link (expenses have no `jobId`, which is why Job Costing falls back to even allocation).
- A richer status model (only sent/paid/draft; no overdue/partially-paid/void/refunded; mark-paid records no method/date/amount).
- QuickBooks export from this screen (QBO scaffold exists server-side but is OAuth-only and unverified).

**Needs research:**
- US sales-tax handling for landscaping (which states tax mowing/maintenance vs installation) and tax-engine buy-decision (Avalara/TaxJar/Stripe Tax vs flat per-tenant rate).
- Competitor invoice parity (Jobber, ServiceTitan, LawnStarter, Yardbook, Service Autopilot): fields, numbering, deposits, financing (Wisetack), ACH/card fee pass-through.
- Stripe Connect economics (platform application-fee model, ACH vs card, whether contractors accept a platform cut).
- Email-deliverability strategy (Gmail-draft won't scale; evaluate Resend/SendGrid/Postmark + DKIM/SPF per tenant).
- Whether QuickBooks/Xero one-way sync is a real purchase driver vs a CSV export for accountants.

### Job Costing
**Purpose:** Real-time estimate-vs-actual gross margin per job: Revenue (linked invoice else job quote) minus Labor (timesheet hours × rate) and Material/Other (material logs × unit cost + linked expenses). Surfaces lowest-margin jobs first.

**What works:** A genuine read-only analytics view. Pulls real rows from jobs/invoices/expenses/timesheets/materialLogs/inventory in parallel with per-repo fallbacks; computes labor from duration or clock-in/out delta, material from inventory unit-cost lookup, revenue from job-linked invoices else the job quote; margin bands with at-risk-first sort; honest "est." tagging when a cost can't be resolved, with a methodology footnote. Summary rollups + blended margin. Honesty is real — it does NOT fabricate per-job costs (it even-allocates unresolved pools and flags them).

**What's missing:**
- **Per-job cost attribution at the source** — timesheets, expenses, and material logs rarely carry a `jobId`, so in practice MOST figures are "est." even allocations, not actuals. Need clock-in-against-a-job, expense-to-job, materials-against-a-job.
- Per-employee/per-crew loaded labor rates (wage + payroll burden + overhead), not a single $35/hr default.
- An overhead allocation model (truck, fuel, insurance, equipment depreciation) — gross margin overstates true profit.
- Equipment/fuel cost per job (`equipmentRepo` exists but isn't used here).
- Drill-down per job (which timesheets/materials/expenses rolled up) and the ability to fix mis-allocations.
- True estimate-accuracy tracking (store the original estimate distinct from `job.revenue` and compare to actuals over time).
- Date-range filtering and export (caps at 60 most-recent jobs; no CSV here unlike Reports).
- Crew/employee productivity and revenue-per-man-hour metrics.

**Needs research:**
- How competitors (Jobber, Aspire, SingleOps, Service Autopilot) model labor burden and overhead allocation.
- Whether owners cost jobs on gross margin or fully-burdened net margin, and the standard overhead recovery method in green-industry costing.
- Default labor-burden multipliers and equipment-hour rates by region/service type (to replace $35/hr).
- Whether crews will reliably clock in against specific jobs on mobile (adoption risk that determines if "actual" costing is achievable).

### Instant Estimate
**Purpose:** Address-in / quote-out instant estimating: type a property address, get a lawn-area measurement (or honest "no provider" fallback), compute a suggested price from tenant `ratePerSqft`, override it, and create a DRAFT invoice in one click.

**What works:** A strong honesty model end-to-end. `/api/measure/property` has three modes — provider mode returns `source:'provider'` but `lawnSqft:null` ("vendor takeoff integration pending"), mock mode returns `source:'unavailable'`, otherwise a Gemini GUESS badged "Rough AI Estimate" with a confidence dot. The component renders all three truthfully and never invents a number. Suggested price = `lawnSqft × ratePerSqft` (default $0.02) with an editable override; `createEstimate` writes a real draft invoice with origin/source/confidence metadata.

**What's missing:**
- **A real property measurement integration (aerial/satellite/GIS)** — provider mode returns null; this is the make-or-break feature.
- Map preview / parcel visualization to see and adjust the measured area (no map at all; just an address field).
- Tiered/area-based pricing beyond a single $/sqft (mowing vs mulch vs cleanup; minimum charge; drive-time/zone; bed vs turf area).
- Service-type selection (the estimate hardcodes "Lawn service" mowing).
- A convert-to-proposal flow (estimate → send to client for acceptance/e-sign → schedule); today it only creates a draft invoice.
- Customer linkage (clientName is free text in jsonb, not tied to a customers row).
- Confidence-to-price guardrails (require manual review when AI confidence is low before sending a quote).

**Needs research:**
- Which measurement provider to integrate and its economics (Nearmap, Regrid/parcel, EagleView, Google Solar/Building Insights, LawnStarter-style proprietary) — accuracy, coverage, per-lookup cost.
- Competitor instant-quote tools (LawnStarter, Sunday, GreenPal, Yardbook, Service Autopilot aerial measurement): accuracy expectations and area-based pricing.
- Acceptable measurement error for binding quotes and the liability of quoting off an AI guess.
- Regional $/sqft and minimum-charge norms (mowing vs installs) to seed defaults and tiered pricing.

### Contracts
**Purpose:** Track recurring service agreements (HOAs, maintenance plans) and their MRR: create/edit/delete with status, billing cycle, MRR, dates, services, optional customer link; surface total MRR, active count, at-risk/renewing-soon.

**What works:** Genuine CRUD + metrics tracker — realtime subscribe, customer picker, create/edit/delete via `contractsRepo`, live MRR/active/at-risk metrics, renewing-soon detection within 30 days, status-ordered filtering, ConfirmDialog-gated delete. The data shape matches the Invoices "convert to contract" path.

**What's missing:**
- **Link contracts to actual recurring billing** — creating a contract here does NOT create a Stripe subscription or generate invoices; the real recurring billing lives separately on the Invoices page and isn't linked to a contract row.
- Auto-generate the periodic invoice/job from the contract each cycle (no scheduler/cron creating work from active contracts).
- Auto status transitions (active→pending_renewal as end_date nears; →at_risk on missed/declined payment; →cancelled on subscription-deletion webhook).
- Contract documents/terms + e-signature (no PDF, no signed agreement, only a free notes field).
- Renewal reminders/notifications (renewing-soon is computed for a badge but nothing notifies).
- Soft-delete/audit (currently hard delete, inconsistent with the rest of the app).
- Per-contract history (visits delivered, invoices billed, payment status, LTV).
- Proration, price escalation/annual increases, and seasonal pause.

**Needs research:**
- How landscaping maintenance contracts are billed in practice (12-month even-spread vs per-visit vs seasonal) — drives the billing-engine design.
- Competitor recurring-contract handling (Jobber recurring jobs, Service Autopilot packages, Aspire contracts) — expected auto-invoicing/auto-scheduling.
- E-signature requirements/integration (DocuSign/Dropbox Sign/native) for HOA/commercial deals.
- Legal/enforceability of auto-renew clauses and required cancellation notice by state.

---

## MARKETING / GROWTH

### Design Studio
**Purpose:** The flagship AI feature: upload a yard photo, mark regions, dictate intent, and YardWorx (a) analyzes the scene into areas + materials + ROI, (b) photorealistically places/removes objects in marked regions while keeping the rest pixel-identical, and (c) packages a before/after slider, Good/Better/Best tiers, a branded proposal PDF, and a save/send-to-client flow. The primary "AI-native" differentiator.

**What works (code-verified; sandbox blocks live Gemini so model OUTPUT is unverified):** The full pipeline is wired end-to-end and degrades honestly. (1) A real region-aware placement engine builds numbered per-region instructions from normalized coords; mock mode echoes the photo. (2) The "rest of scene unchanged" guarantee is implemented client-side as a feathered alpha composite over the byte-identical original — the load-bearing trick. (3) Smart-Snap segmentation, a VLM judge with bounded retry, precise crop-and-paste-back, undo/redo via `designSession`, and refine-on-render all exist and fall back gracefully. (4) The money path is real and DETERMINISTIC — `plantIntelligence.selectPlants` (hard/soft filters, `noCrowdQuantity`, `estimateLineItems` reconciling to the penny), `resolveZone`, and priced palette apply. (5) Proposal PDF via Puppeteer with an AI-viz disclaimer, save-vision with provenance, send-to-client honest about simulated/sent. (6) A solid before/after slider.

**What's missing:**
- **Wire the catalog-image grounding the plan promises** — the server's "reference catalog photo FIRST" path never fires because the client never sends `refImage` (zero matches in `src`). Every placement is instruction-only text, so the picked plant's appearance is whatever Gemini imagines; the headline "place THAT specific plant" claim is unmet.
- **Make tier pricing deterministic** — `/api/design/tiers` uses a TEXT model (`gemini-2.0-flash`) to free-generate cost estimates, contradicting `plantIntelligence`'s deterministic pricing; Good/Better/Best totals are hallucinated. Replace with `estimateLineItems`/`noCrowdQuantity`.
- Fix the `/api/integration/drive` multipart join (`'\r\n'` literal bug) or the blueprint backup silently fails.
- Persist `DesignSession` + placement-layer snapshots to Supabase Storage with tenant-scoped RLS so sessions/undo survive reload; add a per-tenant image-generation budget on top of `aiLimiter` (~$0.039/render).
- Server-side composite hardening (sharp) with a server-enforced SCENE_PRESERVED diff so the "unchanged background" guarantee isn't client-trust-only.
- HEIC/EXIF intake normalization server-side (iOS Capacitor photos are often HEIC/rotated; client `compressImage` may not handle orientation, causing mask/composite misalignment).
- Replace the placeholder `Design3D` (generic primitives in a golden-angle spiral on a fixed house box, not the actual yard) with a real photo-grounded 3D/depth view or remove the tab.
- Confirm the seeded plant catalog reaches contractors out-of-box (studio reads `designCatalogRepo` rows).
- Per-jurisdiction AI-disclosure review for the "after" visualization (legal blocker) before client-facing delivery.
- Expand zone resolution beyond the ~17-entry ZIP3 sample / coarse state ranges so most US addresses resolve a real zone.

**Needs research:**
- Live `GEMINI_API_KEY` validation on Cloud Run of every UNVERIFIED item (sandbox blocks egress): feather seam-invisibility on real photos, Developer-API max images/prompt (MAX_REFS), `gemini-2.5-flash-image` returning image inlineData + AR adherence, segmentation quality on yard surfaces, judge reliability vs a hand-labeled set.
- Competitive benchmark vs Yardzen, iScape, Uvision/PRO Landscape, Apple/Home AI visualizers, and DALL-E/SD-inpaint: do landscapers expect mask-true inpainting, and is instruction-only Gemini placement good enough to sell?
- Commercial plant-data licensing (Perenual / USDA-PLANTS / Monrovia) terms, zone-data vintage, and reference-image rights to ground placements on real cultivars.
- `gemini-2.5-flash-image` EOL Oct 2 2026 → 3.1-flash-image migration: field-name parity and whether a mask-capable first-party path emerges.
- Whether a self-hosted depth model (Depth Anything V2) + shadow harmonization is worth the GPU cost, or instruction+composite suffices for the beachhead.
- Pricing/quota model: per-render cost × retries × tiers vs tenant tier limits — sustainable image budget on free/pro/enterprise.

### Portfolio
**Purpose:** Auto-built marketing showcase of completed work, sourced from Field Mode photos: a fullscreen client-presentation slideshow and a before/after gallery grouped by property, each with a one-tap "Ask for a Review" email. No manual curation required.

**What works:** Genuinely working and notably honest. Subscribes to `jobsRepo`, filters to COMPLETED jobs with a `departurePhotoUrl`, reads photos from the job's jsonb, and groups by customer (newest-first). Before/after cards use the real slider when both photos exist, else show the single "after." "Ask for a Review" is deliberately honest — it drafts a templated email via `/api/email/send` (with a code comment explaining why it doesn't use `/api/reviews/process`) and disables when no email is on file. Loading skeletons, empty states, fullscreen, autoplay all work.

**What's missing:**
- Insert an actual review destination link (tenant's Google Business/Yelp URL) into the email — currently it requests a review but gives the customer nowhere to click.
- A public/shareable tenant-branded gallery URL or embeddable website widget (the #1 marketing ask) — today it's internal-only.
- Manual curation/ordering, hide-bad-photos, captions, and featured-project selection (every completed-with-photo job auto-appears with no editorial control).
- Consent/privacy gating (a per-customer "OK to showcase" flag) before any public sharing.
- Tie review requests to the Reviews module and track sent/opened/converted (not fire-and-forget).
- Social-export (IG/FB before/after with logo overlay) and PDF/case-study export for sales decks.

**Needs research:**
- Which review platforms landscapers care about (Google Business dominant?) and the correct deep-link format to pre-fill a review.
- Legal/consent norms for publishing residential property photos in marketing (state variation).
- Competitor portfolio/showcase features (Jobber, Yardbook, LMN, Arborgold) for table stakes vs differentiation.
- Whether review-gating (inviting only happy customers) crosses FTC/Google review-gating policy.

### Reviews
**Purpose:** Reputation management: read incoming reviews, AI-analyze sentiment and draft a reply, deploy/edit the reply, view a sentiment breakdown, and solicit reviews from recently completed jobs.

**What works:** AI-reply drafting genuinely works — `reviewsRepo` live subscribe, filters, real-derived sentiment stats (with star fallback), real platform tags. `analyzeReview` posts `/api/reviews/process` (canned in mock mode) returning `{sentiment, autoReplyDraft, summary}` and persists sentiment as a column + draft/summary into jsonb. `confirmReply` persists the edited reply with `isReplied`/`repliedAt` and logs an event.

**What's missing:**
- **No review ingestion at all** — there is no `/api/reviews/import` or Google/Yelp/Facebook sync anywhere; reviews must be seed/manual, so the feed is empty for a real customer.
- **Real reply publishing** — "Deploy Response" only sets `isReplied=true`; the reply is never posted to Google/Yelp or emailed, yet the UI says "Review Sent • Sentiment Stabilized."
- Working review solicitation — "Solicit Recent Jobs" only adds a WorkspaceOutbox log entry, while the copy claims it dispatches Gmail; nothing is sent. Send via SMS/email with a deep link to the customer's Google review page, plus follow-up cadence and (compliant) gating.
- A review-request link generator (per-location Google "write a review" URL) and request→review conversion tracking.
- Fix the Negative-filter to use the same star-inference as the stats (it currently under-counts un-analyzed 1–2 star reviews); drop the Firestore `{seconds}` date handling.
- Per-platform connection status UI and rating/volume trend over time.

**Needs research:**
- Google Business Profile API access/approval, rate limits, and whether programmatic replies are permitted; same for Yelp (which restricts API review access) and Facebook.
- Review-gating legality (FTC rules; Google's "review funnel" policy) — allowed vs bannable.
- What review tools landscapers actually use (Podium, Birdeye, NiceJob, Signpost) and expected request-channel mix + conversion benchmarks.

### Referrals
**Purpose:** Growth tool to turn happy customers into new jobs: summarize the referral pipeline, surface "advocates" (review rating ≥ 4) with one-click "ask for referral," log word-of-mouth referrals, and walk each through invited→clicked→signed_up→converted→rewarded.

**What works:** Mostly real CRUD via `referralsRepo` with live subscribe — manual create, inline status update, mark-rewarded, summary rollups, advocate derivation from reviews. "Ask for referral" records a row then calls `/api/email/send` and reports sent vs simulated honestly (real only if `RESEND_API_KEY` is set).

**What's missing:**
- **Server-side referral attribution** — the share link is the crux and it's a dead end: `makeShareCode` builds `/book/{tenantId}?ref=...`, but BookingIntake never reads `ref` and `/api/public/lead-intake` never accepts/stores it. A referred prospect is NOT attributed; status can't advance past "invited" automatically.
- Auto-advance lifecycle linking converted referrals to the actual new customer/job/first-paid-invoice so "converted" and "rewards owed" are computed, not hand-set.
- Actual reward redemption — when marked rewarded, apply the credit/discount to the referrer's next invoice or Stripe balance instead of only flipping a flag.
- SMS as an ask channel and a copy-link/share-sheet button for the no-email path.
- Double-sided reward config, per-tenant program defaults, and a redemption/expiry policy.
- Dedupe/abuse guards (double-referral, self-referral) and a referrer-facing reward status.

**Needs research:**
- What referral mechanics convert for home-services SMBs (cash vs credit vs gift card; one- vs double-sided; typical reward sizes).
- How incumbents attribute referrals (Jobber/Housecall Pro add-ons, Referral Factory, Mention Me) and whether landscapers expect deep-linked codes vs simple promo codes.
- Legal/tax constraints on referral rewards (cash rewards, 1099 thresholds) in target US markets.

### Booking Intake
**Purpose:** Public, no-auth online booking / instant-quote request at `/book/:tenantId` for anonymous prospects; submissions create a NEW lead. The top-of-funnel capture surface a landscaper shares on site/ads/QR.

**What works:** The most production-ready section in the cluster. A self-contained branded shell independent of app shell/auth/repos; tenant-name fetch via plain fetch; client validation (name + email-or-phone); and graceful, distinct status handling for 200/400/404/429/503. `/api/public/lead-intake` is genuinely solid — validates name+contact, caps/sanitizes fields, requires a real existing tenant UUID before inserting (prevents lead-spraying at garbage tenants), folds preferred date into the message, stamps `source:'online_booking'`/`status:'NEW'`, and returns 503 when service role is missing rather than faking success.

**What's missing:**
- Referral/UTM/source capture — read `ref` and campaign params and persist on the lead (the growth loop is broken here, see Referrals).
- Spam protection beyond rate limiting (CAPTCHA/honeypot + stricter per-IP/per-tenant throttle) — a known tenant UUID can be flooded with junk leads.
- Auto-acknowledgement to the prospect (email/SMS) and instant owner notification on new lead.
- Structured fields (preferred date/time, property size, service-specific questions) with real columns to feed scheduling/quoting.
- An optional instant/ballpark quote (tie into the catalog / property-measurement stub) to deliver on "instant quote" positioning.
- A configurable per-tenant form (services, branding/logo, required fields) instead of the hardcoded SERVICES array.

**Needs research:**
- Conversion-optimal booking-form design for home services (field count, multi-step vs single, photo upload, address autocomplete) and benchmark abandon rates.
- Which captcha/anti-spam approach balances conversion vs abuse for public SMB forms.
- Whether prospects expect real-time self-scheduling vs request-and-callback (and what Jobber/Housecall Pro online booking offer).

---

## PLATFORM / ADMIN

### YardPilot Agent
**Purpose:** The owner/admin AI workspace ("Copilot Studio"): a chat copilot, a workflow builder, an editable knowledge base, agent persona/model settings, Deep Research and Veo video labs, an AI-security (SOC) panel, and the flagship hands-free "Live Ear" voice/vision agent (WS `/api/live`) that fires CRM/scheduling/invoice tool-calls.

**What works:** Largely real and wired. The Knowledge Base is genuinely backed by the `knowledge` table (real CRUD). Agent Settings and SOC toggles persist to `tenant.settings`. The SOC "Threats Blocked" reads the real in-memory threat log. The Chat tab's `CuttyChat` is substantial — regex intent detection routes high-confidence verbs through real CRM/invoice/schedule writes and falls back to `/api/brain/query` for Q&A. `/api/agent/*` endpoints (hands-free-dictation, tts, closeout, save-play, owner-digest) are real, metered, and `aiLimiter`'d. Deep Research / Video Marketing poll real endpoints with timeout caps and clean mock messaging. The Live Ear WS bridge is real (connects to `ai.live.connect`, forwards audio/transcription/tool-calls, defines ~18 tools, has a mock-mode demo stream); the client streams 16kHz PCM + 1 frame/3s.

**What's missing:**
- **Authentication + tenant scoping on the `/api/live` WebSocket upgrade** — `wss.on('connection')` never verifies a token, the client opens a bare credential-less socket, and HTTP auth middleware doesn't run on WS upgrades. Anyone reachable gets a full Gemini Live session (cost abuse) and tool-calls run client-side against whatever tenant the browser is in. The single biggest blocker.
- Per-tenant metering/quota on Live Ear minutes (the WS never touches `meterCredits`, so voice usage is free, uncounted, and invisible in AI Usage).
- Real enforcement behind the SOC toggles (session lockout on injection, a real tool-call circuit breaker, owner SMS/email alerts), or relabel them as preferences — today they only persist a boolean; selling them as active controls is misleading.
- Replace the 100% hardcoded "Runtime Stats" panel ("1.2m tokens", "Normal", "4 Modules") with real numbers or remove it.
- Server-side execution + confirmation of Live Ear tool-calls (the model is told "Action queued" but nothing is verified server-side; all real writes happen optimistically client-side; server tool-calls always return a dummy success).
- Role-gate the SOC/model-config/labs tabs (they assume an owner; foremen/employees need an appropriate view).
- A WS horizontal-scaling story (sticky sessions or a shared broker) before multi-instance Cloud Run — per the author's own FIXME that native WS "crashes under heavy client multiplexing."
- Brand cleanup in the Live system prompt ("Meridian Green" → YardWorx) so the assistant doesn't name the wrong company on a customer call.

**Needs research:**
- Gemini Live API production cost per voice-minute and realistic concurrency limits — to price a "Live Ear" tier and decide pro/enterprise gating.
- Whether always-on listening + 1 frame/3s camera capture during customer phone calls is legally defensible (two-party consent / wiretap states, recording disclosure) — a go/no-go compliance question for the flagship feature.
- Competitor benchmark: do Jobber/ServiceTitan/Aspire offer any voice-driven field agent?
- Accuracy/latency of Gemini Live tool-calling on noisy field/phone audio vs a push-to-talk model.
- How to enforce a real AI "circuit breaker" on agent tool-calls (rate + destructive-action 2FA) without crippling legitimate bulk operations.

### Reports
**Purpose:** Owner analytics & audit hub: Analytics (AI predictive maintenance, AI inventory forecast, real revenue-by-service), Loss-Leader Analysis, and an Activity Log from `system_logs`, with CSV export of the active view.

**What works:** Revenue breakdown is real — computed client-side from actual completed jobs grouped by service, with tolerant "completed" synonyms, a real Recharts chart, and an empty state. The Activity Log reads real `system_logs` via subscribe (capped at 25). CSV export is a real client-side Blob download. Predictive-maintenance and inventory-forecast tabs are real Gemini calls (canned in mock mode).

**What's missing:**
- Real predictive maintenance driven by actual equipment hours/mileage/service history (`equipmentRepo` exists) instead of a Gemini guess over customer rows.
- Real inventory forecast based on actual `material_logs` consumption and reorder points, not an AI projection.
- Date-range/period filtering across all analytics (everything is all-time).
- Core financial reports landscapers expect (P&L summary, AR aging, revenue trend, jobs completed, average ticket, customer LTV) — only revenue-by-service exists.
- Fix revenue counting — it reads `job.amount/revenue` (which may be a quote, not billed) for completed/paid/closed jobs, so it can overstate revenue vs actual invoices.
- Audit-log pagination/search/filter (hard cap 25) and verified server-enforced append-only immutability to back the "cannot be edited" claim.
- Server-side/scheduled report generation + email (no scheduling on this page).
- Remove the dead `StaffRow` component (orphaned, light-mode classes) or implement crew-performance reporting.

**Needs research:**
- Which standard reports green-industry owners use to run the business (benchmark Jobber/Aspire/ServiceTitan reporting) to prioritize the backlog.
- Whether "predictive maintenance" as an AI feature is a real buying driver and what inputs (equipment telemetry, service intervals) make it credible.
- Audit-log compliance expectations (tamper-evident/exportable trails for SOC2, insurance, commercial clients).
- Inventory-forecasting methodology landscapers trust (consumption-based reorder points, seasonality) vs AI projection.

### Owner Digest
**Purpose:** An AI "state of your business" brief: aggregates the tenant's own data (revenue, cost, margin, jobs done, overdue AR, new leads, at-risk customers, est. crew utilization) over This Week/This Month, then has Gemini turn the numbers into a narrative with prioritized recommendations and an "Email me this" action.

**What works:** One of the more genuinely complete features. All metrics are computed client-side from real subscribed repos with careful, honest aggregation (period windows, paid/sent/pending revenue in-window, point-in-time overdue AR, in-window jobs/leads, review-based at-risk, and crew utilization that is OMITTED unless real timesheet minutes exist and is flagged "est."). `/api/agent/owner-digest` is real and mock-safe (deterministic templated digest with `simulated:true` keyless; validated Gemini JSON with a 502 on failure when keyed; metered + `aiLimiter`'d). The UI auto-generates on load and period change, shows a "Simulated brief" badge, supports Regenerate, and handles empty/error states. "Email Me This" posts to `/api/email/send` (which simulates when email is unconfigured) and handles sent/simulated/generic.

**What's missing:**
- **Scheduled delivery** (a Monday-morning email/SMS digest via cron) — the value prop is a recurring brief, but today it's manual-pull only.
- An inline way to set/confirm `ownerEmail` (the email button is correctly disabled when missing, but there's no inline capture).
- A verified, configured email/SMS delivery path (it likely simulates unless prod email is set up).
- A stronger churn/at-risk signal than negative-reviews-only (lapsed-service interval, declining frequency, unpaid balance).
- Confidence/disclaimers tied to data completeness (warn when expenses are sparse so margin isn't trusted blindly).
- Optional WoW/MoM period comparison to make the brief actionable rather than a snapshot.

**Needs research:**
- What owners actually want in a weekly brief (benchmark Jobber/ServiceTitan owner reports) — must-have KPIs vs noise.
- Best at-risk/churn heuristic for recurring landscaping accounts (missed renewal, seasonal drop-off) to replace the review-only proxy.
- Delivery-channel preference (email vs SMS vs push) and cadence for SMB owners.
- Whether to weight the AI digest into the credit meter and at what model (Flash vs Pro) the narrative quality is worth the spend.

### Unified Inbox
**Purpose:** A "messenger" surface: every SMS + portal message with a customer in one chronological thread, with reply-by-SMS and reply-by-email. A table-stakes feature competitors lead with.

**What works:** Solid for internal/portal threads. Loads + groups `customer_messages` by customer into conversations, live re-group, search, new-conversation picker, chat-bubble thread with inbound/outbound alignment, auto-scroll, empty states. Send SMS posts `/api/sms/send` which persists the outbound only when a `customerId` is given and the customer belongs to the caller's tenant (good tenant scoping). Send Email optimistically persists then calls `/api/email/send` and toasts honestly. Honesty-correct: SMS/email simulate unless creds are set.

**What's missing:**
- **Reliable inbound routing** — the inbound webhook only attributes a message when EXACTLY ONE customer matches the sender's last-10 digits, otherwise it DROPS it; multi-tenant routing by the Twilio "To" number is not wired, so with more than one tenant or a phone collision inbound replies silently vanish. Provision a per-tenant number / messaging service and route by "To."
- Inbound email ingestion (Resend/Postmark inbound webhook or shared mailbox) so email replies land in the thread — required to honestly call it "unified."
- Per-message delivery state persisted on `customer_messages` (queued/sent/delivered/failed) surfaced as status ticks.
- Unread/read state, per-conversation badges, and a notification on new inbound (operators won't sit on the page).
- Templates/canned replies, attachments/MMS and photos (huge for quotes), and consent/STOP opt-out handling (TCPA).
- Assignment/ownership for multi-user teams and conversation status (open/closed) for a real shared inbox.

**Needs research:**
- 10DLC / A2P registration requirements and cost for SMS at SMB scale, and how competitors onboard a number per tenant.
- TCPA/consent and STOP/HELP handling for proactive landscaper texting in the US.
- What "unified inbox" means competitively (Jobber, Housecall Pro, Thryv, Podium) — which channels (SMS, email, web chat, Google Business messages, FB/IG) are table stakes vs differentiators.

### Data Map (Public Legal Page + CustomerMap)
**Purpose:** Two unrelated things share the name. (A) `DataMap.tsx` is a PUBLIC legal/transparency page (data-processing "map" explaining tenant isolation, threat blocking, portability, anonymized-data sale) with a Copilot-Notes/Legalese dual reader at `/data-map`. (B) `CustomerMap.tsx` is the CRM "Map" tab plotting customers geographically.

**What works:** (A) `DataMap.tsx` is a static marketing/legal page that fully renders (two hardcoded content arrays with a summary/verbatim/both toggle) — prose, not data-driven. (B) `CustomerMap.tsx` is genuinely functional and honest — fetches the Maps key from `/api/config/maps`, shows distinct honest empty states for "no addresses" and "no Maps key," reads stored coords first then geocodes addresses client-side (skipping unresolvable ones rather than fabricating), and fits bounds to real points.

**What's missing:**
- DataMap: reconcile factual claims with the real stack — it says data is stored in "Firebase" but data is on Supabase (a misrepresentation in a quasi-legal document).
- DataMap: the "we may sell anonymized data" clause needs explicit owner opt-in/legal review before shipping (a trust landmine for B2B SaaS).
- DataMap: fix brand naming ("Gaelworx AI" vs YardWorx) and the broken `viewMode` ternary styling (operator-precedence bug; cosmetic).
- CustomerMap: persist geocoded coordinates back to the customer record (it re-geocodes every visit — wasteful of Maps quota and slow at scale).
- CustomerMap: resolve the env-var name mismatch — UI says `GOOGLE_MAPS_API_KEY`, docs say `GOOGLE_MAPS_PLATFORM_KEY`, server reads `GOOGLE_MAPS_API_KEY`. Pick one and document it.
- CustomerMap: `/api/config/maps` hands the raw browser Maps key to any authenticated client — enforce HTTP-referrer + API restrictions or it can be scraped/abused (billing risk).
- CustomerMap: clustering and a route/territory overlay (the map's value is route density, not just pins) + a "plan route from here" link to Route Optimizer.

**Needs research:**
- Legal review of the data-sale and "enterprise lineage / threat exclusion" claims, and which US state privacy laws (CCPA/CPRA) the "sell anonymized data" clause triggers, before publishing.
- Google Maps Platform pricing (geocoding + dynamic-map per-load) at scale — client-side geocoding-on-every-view could become costly; research caching/static-map tradeoffs.
- Whether territory/route-density mapping (not just pins) is the feature landscapers pay for (compare LawnStarter/Jobber routing maps).

### AI Features Playground
**Purpose:** An internal AI capabilities showcase (Chat, Search/Maps grounding, image/video gen, audio transcription/music, and a Firebase infra test) — reads as a developer/sales demo tool proving the Gemini suite works, not an end-user landscaping feature.

**What works (with a key):** `/api/playground/chat` supports Flash/Flash-Lite/Pro-thinking and Search/Maps grounding; transcribe/analyze-media pass inline base64 to Gemini (canned in mock mode). The playground IS metered and rate-limited server-side, and the injection scanner explicitly skips it.

**What's missing:**
- **Switch all calls to `fetchApi`** — the page uses raw `fetch` with no auth header, while `routeAuth` marks playground auth-REQUIRED; it only works because demo mode bypasses auth, and would 401 the moment `REQUIRE_AUTH=true`.
- Decide whether this page ships to customers at all. If yes, reframe to landscaping use-cases (yard photo analysis, before/after renders, voice job notes); if no, gate behind a SaaS-admin/dev role.
- Remove or rebuild the Firebase "Infrastructure" test — it tests an abandoned backend (Supabase is canonical) and will mislead with false "Not Authenticated" failures.
- Result polling/preview for generated video (today it dumps an operation name on the user and dead-ends).
- Clear keyless-mode messaging for image/video/music tabs (they always error in the default dev setup but the page presents them as ready).

**Needs research:**
- Product decision: is an in-product "AI playground" something landscapers want, or sales/demo scaffolding? Do peers expose raw model playgrounds in-product?
- Cost exposure of image/video/music generation per click and whether to gate behind pro/enterprise (Veo, Imagen are expensive).
- Which capabilities map to a real landscaper job-to-be-done (yard vision renders clearly do; music/general chat likely don't).

### AI Usage
**Purpose:** A public-style acceptable-AI-use / ethics page with a dual reader (Copilot Notes vs Legalese) PLUS a live per-tenant AI credit/usage panel. Serves owners (transparency, trust) and doubles as a quota dashboard.

**What works:** Mostly real and honest. The live usage panel fetches `/api/usage/credits` via `fetchApi` with loading/error states — real endpoint (demo mode returns unmetered enterprise; authed returns tier-based limit/used/remaining/period from the tenants row). `meterCredits` actually increments `ai_credits_used` per AI call, so "Used This Period" reflects real consumption for metered route groups. Defensive number/date formatting and a graceful error card. The ethics content is intentional static copy.

**What's missing:**
- Token/cost-weighted metering (or per-feature credit weights) — `meterCredits` charges +1 per request, so a cheap Flash chat and an expensive Veo video cost the same, under-representing real cost.
- Count Live Ear / WebSocket usage somewhere it surfaces here (Live Ear minutes never hit the counter, so heavy voice users see artificially low usage).
- Reconcile the operating-entity name ("Gaelworx AI" vs YardWorx vs Meridian) before presenting a "legally binding" verbatim contract.
- A usage history/trend (only current-period single numbers exist) so owners can anticipate overage.
- Verification that the privacy/no-training claims actually hold under the configured Gemini terms before publishing them as binding.

**Needs research:**
- Legal review of the verbatim "legally binding" AI terms and the correct operating entity name (human/legal, not technical).
- Confirm Google Gemini API data-use/retention terms to back the "never used to train / data isolation" claims, and whether the on-disk prompt cache complies.
- Market norm for AI usage metering in SMB SaaS (credits vs tokens vs flat-rate) — drives whether to show a credit counter and how to price overages.

### Settings
**Purpose:** The owner/admin control panel for a tenant: toggle product modules and sub-features, set business defaults (labor rate, mowing $/sqft, USDA zone, owner email), manage the service pricing catalog, connect Stripe/QuickBooks/integrations, build workflows, manage team members, review legal agreements, and irreversibly delete the account. (Note: the source audit for this section was truncated; the items below reflect the captured portion.)

**What works:** Mostly genuinely wired to Supabase via `tenantsRepo`, with honest degradation when the service key is missing. Feature/sub-feature toggles do a real read-merge-write of the `tenants.settings` JSONB (deep-merge, RLS-scoped; demo-mode blocked). Business Defaults and `customInstallRules` save-on-blur. The booking link is a valid client-side `${origin}/book/${tenantId}` string matching a real route. TeamManagement is fully wired — GET `/api/team` lists profiles by tenant; owner-gated POST `/api/team/invite` tries `inviteUserByEmail` then falls back to a shareable invite link when SMTP is absent; POST `/api/team/remove` deletes profile + auth user; all three return 503 `PROVISION_UNAVAILABLE` when the service role is unset, surfaced in the UI. Account delete is real and owner-gated (cascades tenant deletion, removes settings/profiles, deletes auth users; UI requires typing DELETE and only claims success on 2xx).

**What's missing:**
- QuickBooks: actually run the OAuth + customer/invoice push against a real Intuit sandbox then production company — today it's code-complete but explicitly "wired, not yet run against a real Intuit company," so a landscaper can't trust it. It's also one-way customer push only; invoice/payment sync (the real accounting value) is not implemented despite the copy promising "push customers + invoices."
- QuickBooks bidirectional/invoice sync, item/service mapping, and duplicate-customer detection (current sync blindly POSTs every customer, creating dupes on re-run).
- Team management: no way to CHANGE an existing member's role (only invite + remove); no pending-invite list/resend/revoke; the Role Privileges card is static marketing copy not enforced anywhere shown.
- Booking link: no per-tenant on/off, no custom slug/branding, and no verification that `/book/:tenantId` creates leads scoped to that tenant.
- Business Defaults are minimal (4 fields). Real landscapers need tax rate, default markup, multiple labor rates by service, business address, logo, currency, timezone, and notification preferences.
- Clean up the advertised sub-features (`requireBlueprintDeposit`, `semanticStyleLearning`) that aren't in the `subFeatures` default object (they default `true` via `?? true` — harmless but sloppy).
- Verify the frontend route-gating actually reads `tenant.settings.features` to hide/disable modules (toggling currently only flips a JSONB flag; not confirmed).
- Owner email: there is no SMTP/Resend-backed verification of the address. *(Source audit truncated here.)*

**Needs research:** *(Not captured — the source audit for this section was truncated before its `needsResearch` items.)* Carry forward from adjacent sections: QuickBooks/Xero sync as a real purchase driver vs CSV export (see Invoices); team role/permission models expected by SMB field-service tools; and which business-default fields (tax, markup, multi-rate) are table stakes.

---

## Cross-cutting themes

These patterns recur across many sections and are higher-leverage to fix once than to patch per-screen:

- **"Graceful fallback to success" dishonesty.** Multiple handlers (Dashboard Workspace/integration, CRM SMS, Field & Crew dispatch, Reviews "Deploy/Solicit") show "Synced!"/"Sent!"/"Review Sent" when the API failed, was cancelled, or only simulated. The well-built sections (Client Portal, Booking Intake, Owner Digest, Inbox, Scheduler's OnMyWay) prove the right pattern: surface `simulated:true` / honest status. This should become a global convention.

- **Config/key blockers gate "real" behavior almost everywhere.** Genuine functionality is contingent on env keys that are unset/blocked in the sandbox: `GEMINI_API_KEY` (all AI), `SUPABASE_SERVICE_ROLE_KEY` (portal, team, public intake), `JWT_SECRET` (portal), Stripe, Twilio, `RESEND_API_KEY`, `GOOGLE_MAPS_API_KEY`, `OPENWEATHER_API_KEY`, `QBO_CLIENT_ID/SECRET`, `MEASUREMENT_API_KEY`. A clean "what's configured" matrix + first-run setup flow would de-risk go-live.

- **Live-AI verification debt.** Sandbox blocks Gemini/Maps/Stripe/Twilio/Resend egress, so the most important AI claims are code-verified but output-unverified: Design Studio's whole pipeline, Live Ear transcription/tool-calls, CRM/Closeout/Reviews/Inventory Gemini quality, and every payment/email/SMS delivery. A scripted live-key validation pass on Cloud Run is a recurring prerequisite.

- **The missing geocoding layer.** No address→lat/lng step exists anywhere, which (a) makes Route Optimizer effectively unusable, (b) forces CustomerMap to re-geocode on every view, and (c) leaves Scheduler jobs non-routable. One server-side geocode-on-write (cached on the record) unblocks routing, maps, and dispatch.

- **Weak per-job data linkage undermines costing & costing-derived features.** Timesheets, expenses, material logs, and invoices rarely carry a `jobId`/`customerId`, so Job Costing, Customer Intelligence profitability, and Closeout invoices fall back to estimates/free-text. Required job/customer links at the source (clock-in-against-job, log-to-job, invoice-with-customerId) would make several "analytics" features actually true.

- **Real-time / offline / notifications are largely absent.** Portal Messages and Inbox are reload-only; Equipment/Contracts/Reviews/Booking have no notifications; `syncService` exists but Closeout (the field flow most likely to lose signal) doesn't use it. Push/email/SMS on key events and realtime threads recur as needs.

- **Data-seeding & ingestion needs.** Several sections are empty for a real customer without import/ingestion: Reviews (no Google/Yelp ingestion), Inbox (no inbound email), Inventory/CRM (no bulk CSV import / dedupe), and starter templates for Form Builder/Compliance.

- **Mobile / field UX gaps.** Crew-facing job view (start/complete, checklist, photos), before/after photo capture at closeout, geofenced clock-in, HEIC/EXIF intake, and offline queueing all surface as field-readiness gaps for the people who actually do the work.

- **Trust / compliance / legal exposure.** The DataMap "sell anonymized data" + "Firebase" claims, AI Usage's "legally binding" terms and operating-entity name, Live Ear's always-on recording (two-party consent), SMS TCPA/10DLC, review-gating (FTC/Google), sales tax, and pesticide recordkeeping all need legal review before client-facing shipping.

- **Brand/naming and legacy-stack debt.** Multiple brands coexist in user/legal copy (YardWorx, Cutty, Meridian Green, Gaelworx AI), and Firestore-era code/strings/shims persist in a Supabase app (Inventory/Reviews/CRM error strings, Form Builder's Firebase import, the AI Playground infra test). Cosmetic individually, corrosive to trust in aggregate.

- **Security & cost-abuse hot spots.** The unauthenticated `/api/live` WebSocket (open, unmetered Gemini + client-side tool execution), client-side-only role gates (CRM CSV), the raw browser Maps key handed to any client, public lead-intake without CAPTCHA, and the un-enforced Closeout high-risk invoice gate are the most acute.

- **Fabricated "metrics theater."** Invented numbers shown to paying users recur: Inventory's $65/unit valuation + 4.2% leakage index + "100% SECURE," CRM's property-value growth chart, the Agent "Runtime Stats" panel, and SOC toggles that enforce nothing. These should be made real or removed.

---

## Prioritized research agenda

Ordered by leverage (how many sections each unblocks / how decisive it is for go-live):

1. **Property-measurement provider selection + economics** (Nearmap/Regrid/EagleView/Google Solar/proprietary): accuracy, coverage, per-lookup cost, and binding-quote liability. *Unblocks:* Instant Estimate (make-or-break), and feeds Booking Intake's "instant quote" and CRM property analysis.

2. **Geocoding provider + caching strategy at SMB scale** (Google vs Mapbox vs Nominatim) plus whether to adopt Google Route Optimization API (true VRP) over `computeRoutes`. *Unblocks:* Route Optimizer (the blocking gap), Scheduler routability, CustomerMap cost, Compliance/weather lookups.

3. **Google restricted-scope / CASA security-assessment requirements** for gmail.send, calendar, drive, chat, keep, contacts.readonly, gmail.readonly. *Unblocks:* Dashboard Workspace widget, CRM Contacts/Keep import — determines whether the entire faked Google surface can ever be real.

4. **SMS/voice compliance: 10DLC / A2P registration + TCPA consent/STOP-HELP**, per-tenant number provisioning, and two-party-consent/wiretap rules for always-on recording. *Unblocks:* Unified Inbox (inbound routing), Scheduler "On My Way," CRM SMS, Portal/Owner-Digest notifications, and the Live Ear go/no-go compliance question.

5. **Stripe Connect economics & onboarding** (Express vs Standard, KYC, platform application-fee legality, ACH vs card, deposits/financing). *Unblocks:* Invoices, Client Portal payments, Contracts billing-engine — the entire money path.

6. **US sales-tax handling for landscaping services** (which states tax mowing/maintenance vs installation) and the tax-engine buy-decision (Avalara/TaxJar/Stripe Tax vs flat rate). *Unblocks:* Invoices, Closeout on-site invoicing, Instant Estimate, Contracts.

7. **Live-key validation pass of Gemini-dependent features on Cloud Run** — Design Studio's full pipeline (feather seam-invisibility, image inlineData/AR adherence, segmentation/judge quality, MAX_REFS), Live Ear transcription/tool-calling accuracy and per-minute cost, plus model-migration parity (2.5→3.1-flash-image). *Unblocks:* Design Studio (flagship), YardPilot/Live Ear, and the credibility of every AI claim.

8. **Competitor feature-parity benchmark across the suite** (Jobber, ServiceTitan, Aspire, Housecall Pro, LawnStarter, SingleOps): recurring-job/contract model, invoice fields/numbering/deposits, unified-inbox channels, dashboard KPIs, owner reports, routing positioning, inspection/QA forms. *Unblocks:* prioritization for Scheduler, Contracts, Invoices, Inbox, Dashboard, Reports, Owner Digest, Form Builder.

9. **Legal review of trust/compliance copy and claims**: DataMap "sell anonymized data" (+ "Firebase" misstatement) and CCPA/CPRA triggers, AI Usage "legally binding" terms + operating-entity name, no-training/data-isolation claims under Gemini terms, and review-gating (FTC/Google). *Unblocks:* DataMap, AI Usage, Reviews, Portfolio — anything client- or public-facing.

10. **Validated churn/at-risk signals and labor-burden/overhead model for green-industry** (which behaviors predict cancellation; standard LTV/gross-vs-net-margin definitions; default burden multipliers and equipment-hour rates by region). *Unblocks:* Customer Intelligence, Job Costing, Owner Digest — replacing hardcoded heuristics with numbers owners trust.

(Adjacent but lower on the list, each tied to one section: pesticide recordkeeping mandates by state → Compliance; review-platform API access → Reviews; referral mechanics that convert → Referrals; AI-metering norms → AI Usage; property-measurement vs measurement-provider overlaps with #1.)