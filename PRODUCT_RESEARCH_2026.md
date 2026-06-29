# YardWorx — Product Research & Design Direction (2026–2027)

_Compiled 2026-06-29 from a parallel market + design research sweep (competitor feature
gap analysis, SaaS UI/UX trends, and an AI-native UX case study). Companion to
`MARKET_RESEARCH.md` (the US market study) and `TODO.md` (the actionable backlog)._

## Executive summary

YardWorx's defensible wedge is its **AI-native, voice-first action layer** (the "Live Ear"
voice agent + "Cutty" copilot that perform real actions). The research says two things:

1. **To stop getting disqualified** in head-to-head evals vs Jobber / Aspire / LMN, we must
   close a short list of **table-stakes gaps** — led by real **outbound email**, **aerial
   property measurement → instant estimate**, **real-time job costing**, and **QuickBooks sync**.
2. **To win on our moat**, the design direction is **"Tell it, don't drive it"** — an
   intent-first, ambient-AI, generative-defaults experience — and the single flagship build
   that proves it is **"The Tailgate Closeout"** (talk once at the truck → invoice sent, job
   closed, next visit booked, inventory flagged).

---

## 1. Competitive feature-gap analysis

### Where we're LACKING (competitors do it better)
| Gap | Who leads | Impact | Effort |
|---|---|---|---|
| AI inbound call answering / receptionist | Jobber, Housecall, Workiz ("Jessica") | Differentiator → becoming table-stakes | L |
| Real-time job costing (estimate-vs-actual margins) | Aspire, LMN, ServiceTitan | **Table-stakes** for serious landscapers | M |
| Budget-based estimating w/ overhead recovery | LMN, Aspire | Differentiator | M |
| GPS crew/fleet tracking + geofenced auto clock-in | Service Autopilot, telematics | Table-stakes (multi-crew) | M |
| Deep QuickBooks 2-way sync + payroll export | Jobber, Aspire, Service Autopilot | **Table-stakes** | L |
| Online booking from website/Google | Housecall Pro, ServiceTitan | Table-stakes lead capture | M |
| Review-request automation (post-job cadence) | Housecall Pro, RealGreen | Table-stakes (blocked by missing email) | S |
| Automated multi-touch marketing (renewals/prepay/upsell) | RealGreen (AMA), Service Autopilot | Differentiator (blocked by missing email) | M |
| Chemical/pesticide application tracking + compliance logs | Yardbook, Arborgold, SingleOps, RealGreen | Table-stakes for lawn/turf/tree | S |
| Map-based asset/tree inventory w/ per-asset history | SingleOps, Arborgold | Differentiator (arbor niche) | M |
| Spanish-language crew mobile app | LMN | Table-stakes (bilingual workforce) | S |

### What's MISSING ALTOGETHER
| Missing | Impact | Effort |
|---|---|---|
| **Aerial/satellite property measurement + auto-takeoff → instant estimate** | **#1 landscaping table-stake** (Aspire PropertyIntel, RealGreen, SiteRecon) | L |
| **Real outbound email delivery** | Foundational blocker (gates reviews, marketing, invoices, portal) | S–M |
| Consumer financing (Wisetack-style, text-to-apply) | Wins bigger install/hardscape jobs | M |
| GPS fleet/vehicle telematics | Table-stakes multi-crew | L (or M via integration) |
| Online booking widget (website + Google) | Table-stakes lead capture | M |
| QuickBooks / accounting export | Table-stakes | L |
| Native payroll / timesheet export from time clock | Table-stakes | M |
| Snow/seasonal weather-triggered dispatch | Differentiator (northern markets) | M |
| Bulk/batch invoicing for recurring maintenance | Table-stakes for mow routes | S |
| AI flat-rate pricebook (market-aware pricing) | Differentiator (ServiceTitan Pricebook Pro analog) | M |

### Top 8 to win the landscaping beachhead (impact ÷ effort)
1. **Real outbound email delivery** (S–M) — foundational; unlocks reviews, marketing, invoice/portal notifications.
2. **Aerial property measurement → instant estimate** (L) — #1 landscaping table-stake; pairs with voice ("measure this address and quote it"). Our biggest differentiator opportunity.
3. **Real-time job costing** (M) — the metric serious landscapers buy for; we already have estimates + time clock + expenses + material logs to wire into a live margin view.
4. **AI inbound receptionist** (L) — on-brand for voice-first; extend Live Ear to answer the phone 24/7.
5. **Chemical/pesticide compliance logs** (S) — cheap, mandatory for turf/tree; quick credibility win.
6. **GPS crew tracking + geofenced clock-in** (M) — ties hours-claimed to hours-worked.
7. **QuickBooks 2-way sync + payroll export** (L) — removes the top adoption objection from established shops.
8. **Consumer financing + online booking widget** (M) — revenue-multiplying, mostly integration-level.

> Strategy: items 2 & 4 lean into the AI/voice moat; items 1, 3, 5, 6, 7 close the table-stakes
> gaps that otherwise disqualify us against Jobber/Aspire/LMN.

---

## 2. SaaS UI/UX trends 2026–2027 → our design north star

**The big shift: intent-first replaces dashboard-first.** State intent → review what the system
did → a small dashboard aggregates patterns (a *support* surface, not the headliner).

Key trends:
- **Ambient copilots beat chat-first ~4:1** — surface AI in-context (ghost-fill, inline cards), not in a separate chat window.
- **Generative defaults** — forms/records open pre-filled; users *edit rather than write* (40–60% faster). Hard rule: pre-fills must be ~80%+ accurate or they erode trust.
- **Trust is the core design problem** — confidence affordances (mute/label low-confidence output), everything reviewable + undoable; protect the "trust half-life."
- **Calm minimalism** ("it feels like Linear"); **AI as invisible infrastructure**, not a badged feature.
- **Bento dashboards** where tile size = importance; **dark-first with one restrained accent**; **adaptive theming** (favor bright/high-contrast outdoors).
- **Accessibility is baseline** (WCAG 2.2 target sizes reinforce big tap targets); **onboarding in-the-moment**, not tours.
- **Mobile/field**: big spaced tap targets (>44pt, larger for gloves), bottom-anchored actions, sunlight contrast, glanceable rows, offline-first, **voice/hands-free** (Gartner: ~75% of field-service firms on voice+mobile by 2026).

### Design north star: **"Tell it, don't drive it."**
YardWorx is a voice-first AI foreman in your pocket. A contractor with muddy hands should *say or
tap one thing* and the app does the rest — surfacing only the next action, in plain language,
glanceable in sunlight, working with no signal.

**7 principles:** (1) voice + one-tap are the front door, dashboard is the fallback; (2) ambient
AI, not a chatbot; (3) generative defaults held to ~80% accuracy; (4) confidence + undo mandatory,
in plain language; (5) calm/glanceable/sunlight-readable/big-target; (6) onboarding that doesn't
feel like onboarding; (7) offline-first, fast, forgiving (trade vocabulary, fuzzy matching).
Aesthetic guardrails: keep the `forest` accent, borders over shadows, luminance hierarchy,
whitespace; bento summary for the owner web view, radically simpler "next action" view for the field.

---

## 3. The flagship UI/UX case to build: **"The Tailgate Closeout"**

**One screen, one gesture, the whole day's admin gone.** A crew finishes a job; the foreman stands
at the tailgate, holds one big button and talks: _"Job's done at the Hendersons. Mowed, trimmed the
hedges, hauled two yards of mulch, about an hour and a half. Bill 'em the usual plus eighty for the
mulch, and remind me we're low on mulch."_ He drives off. By the next stop: invoice sent, job
closed, next visit booked, low-mulch alert waiting.

Why it wins: hits the persona's #1 pain (after-hours/in-truck invoicing) at the right moment (before
leaving the property), needs zero typing, and shows the agent doing **multiple real actions from one
natural utterance** — which no incumbent does.

### Flow (3 states)
- **A — Listen (Live Ear):** giant mic (hold-to-talk or tap-toggle for gloves), waveform + live
  transcript ribbon (audible+visual "I heard you"), barge-in, VAD tuned for outdoor noise,
  example chips, Field-Mode high-contrast styling. Reuses `useSpeechRecognition` + `/api/live`.
- **B — Closeout Review (the money screen):** a scrollable stack of typed **Action Cards** (not a
  chat log) — Close Job (low, pre-checked), **Invoice (high → explicit confirm)**, Schedule next
  (medium), Inventory reorder (low), Photos. Each card: plain language, **confidence dot**, inline
  edit. Bottom triad: **Do All · Review Each · Cancel** (tiered execution).
- **C — Done + Undo:** compact activity feed; each line carries a **Gmail-style timed Undo**
  (~10–15s for the invoice) + a permanent audit entry; one spoken confirmation.

### Risk-tiered confirmation (anti-fatigue)
| Action | Risk | Confirm | Undo |
|---|---|---|---|
| Close job / log time | Low | auto on "Do All" | reopen from audit |
| Schedule next visit | Medium | one-tap | undo chip |
| Inventory reorder | Low | auto | undo chip |
| **Send invoice** | **High** | **explicit + spoken confirm** | **timed undo + audit** |
| Charge saved card | High | explicit + amount restated | timed undo + refund |

The owner makes **one** real decision (the invoice); everything else just happens and stays reversible.

### Build spec (components / changes)
- **New components:** `LiveEarCloseout/` (State A), `ActionCard.tsx` (typed, risk-tiered, confidence
  dot, inline edit — the reusable primitive), `ActionCardStack.tsx` (State B + Do All/Review/Cancel),
  `ConfidenceDot.tsx`, `UndoChip.tsx` (timed revert), `CloseoutDoneStrip.tsx` (State C), and thin
  card variants (`CloseJobCard`, `InvoiceCard`, `ScheduleCard`, `InventoryCard`, `PhotosCard`).
- **Page/routing:** `pages/Closeout.tsx` (or a Field-Mode tab), reachable as a giant CTA from the
  job detail screen + Field Mode.
- **Backend (`server.ts`):** `/api/agent/closeout` — takes transcript + job context, returns a
  **structured plan of typed actions** (via `parseGeminiJson()`, honors mock mode); it *proposes*,
  never auto-executes. Approved cards run through the existing `/api/invoices|scheduler|crm|inventory`
  handlers in risk order; ensure each exposes a reverse op (void/draft, unbook, reopen) for the undo
  window.
- **Reuse:** `WorkspaceOutbox`/`syncService` (offline queue), `TenantContext` service catalog
  (invoice line-item inference), `FieldMode` styling. Add an **Autonomy Dial** in Settings
  (per-action-type: auto-send vs always review) for progressive delegation.
- **Tokens:** Field-Mode-scale tap targets (≥56px), sunlight contrast, large type; risk-tier color
  tokens (low/medium/high).

---

## Sources
Competitor research, design-trend research, and the UX-case research each carry full source lists in
the session record; primary references include getjobber.com, youraspire.com, granum.com (LMN/SingleOps),
servicetitan.com, housecallpro.com, realgreen.com, smashingmagazine.com (agentic UX patterns),
copilotkit.ai (generative UI), skedulo.com (field UX), and the 2026 SaaS design-trend roundups
(saasui.design, orbix.studio, designstudiouiux.com, Clockwise/technology.org).
