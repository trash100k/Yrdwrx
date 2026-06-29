# YardWorx Dashboard — Redesign Build Plan

_Status: research-backed plan (not yet built). Grounded in a full code audit of
`src/pages/Dashboard.tsx` (2,863 lines) + sub-components, a competitor home-screen study
(Jobber, Housecall Pro, ServiceTitan, Workiz, SingleOps, Aspire, Yardbook, Service Autopilot,
LawnStarter), and NN/g progressive-disclosure / defaults research._

---

## 1. Diagnosis — why the front page "feels weird"

1. **It's two overlapping pages.** A top tab toggle renders **"Daily Workspace" (cockpit)** vs
   **"Metrics Grid" (analytics)** — and both re-render the *same* widgets (EarningsWidget, AlertsWidget,
   DesignStudioWidget, LiveInventoryFeed appear in both). The default tab is chosen by a hidden
   `viewStyle` preference, so users land on different "pages" they didn't knowingly pick. **This is the
   "second page to monitor."** NN/g: two competing screens with different IAs is the classic mode-confusion anti-pattern.
2. **~600 lines of dead, unreachable UI.** The camera **scanner** (`setIsScanning(true)` is never called),
   the **"Crews & Jobs Control Panel"** and **"CRM & Vendor Control"** drawers (`setActiveDrawer(...)` never
   called), and the **onboarding wizard** (`setShowOnboarding(true)` never called) are fully built but
   unreachable. `QuickActionMacros` is imported but never rendered. This scaffolding makes the file (and the
   mental model) incoherent.
3. **"Easy Mode" is a nav strip that lies about itself.** It renders **6 tiles** (Copilot/CRM/Schedule/
   Crews/Invoices/Settings) that just duplicate the sidebar. Its own onboarding copy promises **"3 big
   interactive buttons — Today's stops, AI dialer, inventory scanner."** Those three don't exist in the deck,
   and their implementations are exactly the dead/unreachable code above. So Easy Mode is both redundant
   (second nav) and a broken promise.
4. **The best block is buried.** The honest, all-live **KPI strip** (weekly earnings, crew on-site/total,
   open leads, outstanding billing) is stranded on tab 2, which many owners never open.
5. **Redundant invoice slices.** Alerts, Earnings, the analytics KPIs, and Top Services all re-slice the same
   invoice table four different ways.
6. **Missing the things owners actually open a home screen for** (see §4-ADD).

## 2. North star

> **One role-aware Home, action-first, progressively disclosed.** No second page. The "simple"
> experience IS the default Home; depth is revealed in place, not behind a competing screen.

Backed by the research: the universal field-service home answers four questions in order —
**(1) What needs my attention? (2) What's happening today? (3) How's the money? (4) How are we trending?** —
with every card a **doorway** (deep-links to a pre-filtered list), role-scoped rendering instead of a manual
"choose your experience," and **never an empty default**.

## 3. Target information architecture (single Home)

Kill the tab toggle. One scrollable Home, top-to-bottom, in priority order:

1. **Action Queue (hero).** A prioritized, clickable "what needs you now" list derived from workflow state,
   each as **count + $**, deep-linking to the filtered view:
   - Estimates/drafts to send · approved quotes → schedule · jobs **ready to invoice** ($ unbilled) ·
     **past-due invoices** (oldest first, $) · unscheduled jobs · jobs with no crew · unread customer messages.
   - **Beat-them:** rank + explain via the existing Gemini/agent layer ("3 jobs ready to invoice = $5,800 you
     haven't billed"). This turns Jobber's static "recommended actions" into an AI cockpit.
2. **Today.** Today's job list **+ map** (we now geocode → coords exist), ordered "Up Next," **crew/clock-in
   status** (timesheets), a **late** flag (end-time passed, not complete), and an **Unassigned** callout.
   The real "Today's stops" the onboarding always promised.
3. **Money.** A cash row: **outstanding A/R** + **past-due (oldest first)** + **today's expected revenue**
   (from today's visits) + collected. (We already built **AR aging** on the Invoices page — reuse that
   computation.) Each tile actions: "Send reminders," "Collect."
4. **Pulse (KPIs).** A compact, **grouped** KPI strip (Revenue / Operations / Pipeline) with **trend arrows**,
   **plain-language tooltips**, and a **period selector (default: this week)** with period-over-period delta.
   This is the *elevated* version of today's buried analytics strip.
5. **Customize (power users).** A single "Customize" affordance to add/remove/reorder optional widgets
   (weather, design promo, reviews pulse, top services, workspace) — progressive disclosure within one IA,
   **not** a second page. Ship a **smart default layout** so it's useful with zero config.

**Field/crew Home (role-scoped):** for foreman/employee roles the same Home renders the *simple* variant —
**next job + route + my tasks + clock-in + (optional) my hours** — never the KPI wall. Split by **role**,
not a manual mode toggle (NN/g + Jobber model).

## 4. Widget matrix — keep / merge / elevate / cut / add

| Action | Widget | Rationale |
|---|---|---|
| **ELEVATE** | Analytics KPI strip (earnings / crew / leads / **outstanding billing**) | Most useful + honest; move from buried tab 2 to the Home "Pulse" + "Money" rows. |
| **ELEVATE** | Weather → **weather-driven action** | Keep the forecast but add "rain at 2pm → reschedule these N jobs" (logic already exists in the dead drawer). |
| **KEEP** | DailyBriefing | Real AI, honest. But **wire its dead buttons** ("Start Your Day"/"Email") and drop the redundant double header. |
| **KEEP** | EarningsWidget, LiveInventoryFeed (low-stock) | Real + honest; render **once** (not in two tabs); fix fresh-account sample to a teaching empty state. |
| **MERGE** | Crew "Sites Monitor" widget **+** dead "Crews & Jobs" drawer | One crew/today surface in §3.2; delete the unreachable drawer. |
| **MERGE** | Alerts widget **→** Action Queue | Overdue/open-invoice + hot-lead alerts become rows of the new Action Queue (count+$, deep-linked). |
| **CUT** | The whole **"Metrics Grid" 2nd tab** | Duplicate widgets; fold its unique KPI strip into Home. |
| **CUT** | **"Easy Mode" 6-tile nav** | Duplicates the sidebar; replaced by the action-first Home (the real "easy mode"). |
| **CUT (dead code)** | Camera scanner modal, "CRM & Vendor Control" drawer, never-launched onboarding wizard, unused `QuickActionMacros` import | ~600 lines unreachable; remove or wire intentionally (scanner → Inventory page; onboarding → first-run). |
| **CUT/repurpose** | DesignStudioWidget (decorative promo) | Demote to an optional/customize widget; not default real-estate. |
| **ADD** | **Action Queue** (hero) | The single most universal, highest-value element across all competitors. |
| **ADD** | **Today's schedule + map** | jobsRepo exists but Dashboard never subscribes to jobs today. |
| **ADD** | **Cash/AR snapshot with actions** | Reuse the AR-aging engine from Invoices; add "remind/collect." |
| **ADD** | **Unread customer messages** | `customerMessagesRepo` exists, never surfaced. |
| **ADD** | **Today's revenue + jobs done vs. goal** | Simple "today" number, not just a 14-day trend. |
| **ADD (differentiator)** | **Margin per crew-hour** + **earned-vs-invoiced** | Green-industry KPIs generic FSM tools bury; we have timesheets + job costing to compute them. |
| **ADD (optional)** | **Reviews/reputation pulse** | reviewsRepo exists. |

## 5. The new "Easy Mode" (done right)

- **Delete the 6-tile nav.** The default action-first Home *is* the simple mode — focused, do-something cards,
  no chart wall (NN/g: don't make "easy mode" a dead-end toy; make defaults excellent).
- **Progressive disclosure, not two pages.** A single **density/Advanced** in-place toggle (or "Customize")
  reveals the optional KPI/widget depth — same IA, more detail. No `viewStyle`-driven second page.
- **Honor the 3 promised actions or drop them honestly:** "Today's stops" → the real Today block (build);
  "AI dialer" → either wire the existing Gemini call-prep into a CRM follow-up action or remove the promise;
  "Inventory scanner" → move the (already-built) scanner to the Inventory page where it belongs.
- **Role-aware default**: owner → action+money+pulse; foreman/employee → field Home. Never an empty screen.

## 6. Phased build plan

**Phase 0 — De-clutter (low risk, high clarity).** Remove the dead/unreachable blocks (scanner, both drawers,
never-launched onboarding, unused import) **or** intentionally relocate them; collapse the two tabs into one
Home; delete the 6-tile Easy Mode. _Net: a big readability + coherence win, mostly deletions._

**Phase 1 — Action-first Home (the core).** Build the **Action Queue** (from jobs/invoices/messages state,
count+$, deep-linked), the **Today** block (jobs subscribe + map + crew status + Up Next), and the **Money**
row (reuse AR aging). Elevate the KPI strip into a grouped **Pulse** with trend + period selector. Wire the
DailyBriefing actions. _All from existing live repos; no new keys._

**Phase 2 — Smart + landscaping-native.** AI-ranked/explained Action Queue (Gemini), **margin-per-crew-hour**
+ **earned-vs-invoiced** cards, weather-driven reschedule action, **Customize** (add/remove/reorder optional
widgets) over a smart default layout, teaching empty states (no fresh-account fiction).

**Phase 3 — Field/crew Home + polish.** Role-scoped simple Home for foreman/employee (next job + route + my
tasks + clock-in + hours); a conversational "ask the home screen" box (existing Gemini layer); reviews pulse.

## 7. Data sources (all already present)
`jobsRepo` (today/route, now geocoded), `invoicesRepo` (+`amountPaid`/AR aging already built), `crewsRepo`,
`timesheetsRepo` (clock-in/hours/margin-per-hour), `customerMessagesRepo` (unread), `leadsRepo`, `reviewsRepo`,
`/api/weather`, DailyBriefing (`/api/daily-briefing`). The redesign is mostly **re-arranging + surfacing live
data we already have**, plus deletions — not new infrastructure.

_Last updated: 2026-06-29._
