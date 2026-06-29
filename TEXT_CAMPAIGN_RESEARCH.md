# YardWorx — Text (SMS/RCS) Campaign Feature: Research & Design Brief

_Research synthesis for building a first-class **Text Campaign** feature on top of the existing
YardWorx stack. Combines (a) a deep map of what already exists in this codebase, (b) external
best-practice + compliance research (Twilio, TCPA/CTIA, SMS marketing, RCS, conversational AI),
and (c) a phased build plan that leans on YardWorx's agentic logic as the differentiator._

_Generated 2026-06-29. **This is research, not shipped code.** Legal/compliance items below are
informational and must be reviewed by counsel before go-live (matches the `MARKET_RESEARCH.md`
caveat on compliance copy)._

---

## 0. Bottom line

Texting is **table-stakes** for field service (Jobber, Housecall, LMN all ship two-way SMS), and the
ROI is real: ~98% open rates, appointment reminders cut no-shows up to ~30%, and home-service
customers are ~4.5× more likely to act on an SMS promo than email. YardWorx already has a
**production-grade SMS foundation** — outbound send, signature-verified inbound webhook, CRM thread
persistence, Twilio wired-but-optional with graceful simulation. What's missing is the **campaign
layer** (bulk send, scheduling, segmentation, consent, delivery tracking, analytics) and the
**compliance scaffolding** (A2P 10DLC registration + TCPA consent), which is already flagged as
research item #4 in `TODO.md`.

The opportunity is **not** to ship a generic "text blast" tool — every competitor has one. It's to
make texting **agentic**: campaigns that target themselves from CRM signals, write themselves
(grounded in the tenant's catalog + each customer's history via the existing
`/api/outbound/draft-personalized-campaign` pattern), **reply for you** over two-way SMS using the
same Gemini function-calling executor that powers Live Ear, and book the job — all with a
human-in-the-loop approval gate. That is the same "close the job, don't just blast it" lane the
market research says is open.

> **One-line positioning:** _"Campaigns that text like your best salesperson — they know who to
> reach, what to say, and they book the job when the customer replies."_

---

## 1. What we already have (reuse map)

This is the single most important section: **the feature is ~70% an extension, not a greenfield
build.** Concrete anchors (all verified against the current tree):

| Capability | Where | State today | Reuse for campaigns |
|---|---|---|---|
| **Outbound SMS** | `server.ts:4750` `POST /api/sms/send` | Single SMS; persists to `customer_messages`; **simulates** (`simulated:true`) when Twilio keys unset | Wrap in a bulk/queued sender; reuse the simulate-gracefully pattern |
| **Inbound SMS webhook** | `server.ts:552` `POST /api/public/sms/inbound` | Form-encoded, **signature-verified** (`twilio.validateRequest`), resolves sender phone → customer, persists | The two-way / conversational-AI backbone; add tenant routing |
| **AI campaign drafting** | `server.ts:4387` `POST /api/outbound/draft-personalized-campaign` | Loops customers → personalized **email** drafts grounded in name/address/notes/tags/`aiScore` | Add an `channel:"sms"` mode + SMS system prompt (160-char, CTA, STOP footer) |
| **Campaign UI + human review** | `src/components/AutonomousCampaigns.tsx` | Segment (priority/lapsed/all) → service → AI drafts → approve/reject → Outbox | Clone for SMS with char counter + consent filter |
| **Template-driven outreach** | `src/components/AgenticOutreachDrawer.tsx` | Lead → customize → social proof → draft → Outbox | Template library pattern for SMS |
| **Draft tracking** | `src/contexts/WorkspaceOutboxContext.tsx` | Honest "drafted, not sent until approved" outbox | Campaign queue / send log |
| **CRM message thread** | `src/pages/CRM.tsx:221` (SMS tab) + `customer_messages` table | 1:1 SMS history per customer | Unified conversation view (already on roadmap) |
| **Voice agent w/ tools** | `server.ts:3361` `/api/live` (`load_client_data`, `schedule_job`, `create_invoice`…) | Gemini function-calling executes real RLS-scoped mutations | **The next-gen hook** — add a `send_sms` tool + an inbound-SMS agent loop |
| **Automation engine** | `src/lib/automations.ts` (triggers on `client_created`/`job_completed`/`invoice_paid`) | Executes tenant workflow rules with run metadata | Event-triggered texts (on-my-way, review request, win-back) |
| **AI metering / tiering** | AI credit wallet (402/429), tier gates | Meters expensive Gemini ops | Gate campaign AI drafting + conversational replies by tier/credits |
| **Mock mode + cache** | `isMockMode`, `parseGeminiJson`, SHA cache | Dev-safe without keys | Keep campaigns demoable with no Twilio/Gemini keys |

**Adjacent features that should plug into the same engine** (avoid building parallel pipes):
On-My-Way ETA, Referrals engine, Reviews solicitation, branded invoice-on-completion (all in
`TODO.md`), and the **unified two-way inbox** (`TODO.md` line ~1014).

### What's genuinely missing (the build list)
1. **Bulk/queued send** — `/api/sms/send` is 1-by-1; no batching, throttling, or campaign grouping.
2. **Scheduling** — drafts sit in Outbox; no "send Tuesday 10am local" queue.
3. **Consent state** — `Customer` (`src/types.ts:60`) has `phone`/`tags`/`aiScore` but **no
   `sms_consent`** field. No opt-in capture, no STOP/opt-out ledger. **This is the #1 blocker.**
4. **Delivery tracking** — `customer_messages` has no `status`/`twilio_sid`/`error_code`; no
   status-callback webhook.
5. **Analytics** — no per-campaign sent/delivered/replied/opted-out/booked metrics.
6. **Compliance plumbing** — no A2P 10DLC registration helper, no auto opt-out footer, no
   quiet-hours guard, no STOP/HELP auto-responder.
7. **Multi-tenant inbound routing** — inbound matches on `From` only; needs a `To`-number→tenant
   registry so multiple tenants can share the platform (`TODO.md` line ~823).

---

## 2. Compliance — the gating constraint (do this first or not at all)

US business texting is heavily regulated. Carriers **filter/block** unregistered traffic, and TCPA
penalties are **$500/message** ($1,500 willful). This section is the hard floor; everything else is
polish. _(Informational — confirm with counsel.)_

### 2a. A2P 10DLC registration (carrier-level, via The Campaign Registry)
Any app→person SMS over a standard 10-digit US long code must be registered. Two objects:

- **Brand** — the business identity. Types:
  - **Standard** (has an EIN/tax ID) → higher throughput, scales with **Trust Score** from TCR.
  - **Low-Volume Standard** — best for **< ~6,000 message segments/day**; lower throughput.
  - **Sole Proprietor** — individuals without a tax ID (lowest throughput).
- **Campaign** — the use case (e.g. "marketing," "customer care," "appointment reminders"). A brand
  can hold up to **~5 campaigns**. Each campaign needs a **Messaging Service** with ≥1 10DLC number
  in its sender pool. Reviews currently run **~10–15 days**.
- **Throughput (MPS)** is a function of **brand type × campaign type × trust score** — accurate
  registration data → higher trust → higher send rate + daily caps. Garbage data → throttling/blocks.

**Product implication for a multi-tenant SaaS:** YardWorx must decide its 10DLC model:
- **(A) ISV/sub-account model** — each tenant registers their own brand/campaign under YardWorx's
  Twilio account (most compliant, scales, but adds onboarding friction). _Recommended for launch._
- **(B) Shared YardWorx campaign** — simpler, but carrier rules increasingly disallow commingling
  unrelated businesses on one campaign; risks platform-wide filtering. Avoid for marketing traffic.

This is a **human/config + onboarding-UX** task, not just code — it belongs in `LAUNCH_CHECKLIST.md`
alongside the Stripe/keys gates. Build a guided "Register your texting number" onboarding step that
collects EIN, business info, sample messages, and opt-in description, then calls Twilio's
brand/campaign registration APIs.

### 2b. TCPA / CTIA consent (the legal layer, on top of carrier registration)
- **Marketing texts require prior express written consent (PEWC)**: an affirmative, documented
  opt-in (checkbox/web form/keyword) that names the business, describes message type + frequency
  ("msg & data rates may apply"), and states **consent is not a condition of purchase**.
- **Transactional/informational** texts (appointment confirmations, on-my-way, invoice receipts) sit
  under a lower bar (prior express consent) **but only if the customer gave the number for that
  purpose and the content is non-promotional.** Don't let marketing ride a transactional opt-in.
- **Legal flux to track** (don't hard-code assumptions): the FCC **one-to-one consent rule was
  vacated (Jan 2025)**; *Bradford v. Sovereign Pest* (Feb 2026, 5th Cir.) held only "prior express
  consent" (not *written*) is required **in TX/LA/MS** — but the FCC rules + other circuits still
  require written. **Build to the strictest standard (PEWC) so you're compliant everywhere.**
- **Opt-out** (since **April 2025**): honor revocation via **any reasonable method** (not just
  "STOP" — also email, call, web form, a reply in words), processed within **10 business days**. One
  final confirmation message after STOP is allowed; nothing after.
- **Quiet hours:** send only during the recipient's local **business hours** (industry norm: avoid
  before 8am / after 9pm local). Store/derive customer timezone (you already geocode addresses on the
  roadmap — reuse it).
- **Prohibited content (SHAFT + carrier rules):** no Sex, Hate, Alcohol, Firearms, Tobacco; no
  unapproved cannabis/CBD, loans, or content that triggers filtering. (Low risk for landscaping, but
  the platform should enforce it since tenants write their own copy.)

### 2c. Deliverability hygiene (keeps you off carrier blocklists)
- Keep **opt-out rate < 1–2%**; monitor and auto-pause a campaign that spikes.
- Clean lists (no purchased numbers), consistent sending patterns, quality opt-in.
- Be cautious with **public URL shorteners** (bit.ly etc.) — carriers filter shared shorteners; use a
  **branded/dedicated link domain** for proposal/portal links.
- Identify the sender in the **first message** of any program and include opt-out language.

### 2d. Minimum compliance scaffolding to build
- `customers.sms_consent` (`none|transactional|marketing`), `sms_consent_at`, `sms_consent_source`,
  `sms_opt_out_at` — with a small **consent audit log** (immutable; proof for TCPA defense).
- **Opt-in capture** wherever a phone is collected: online booking widget, client portal, lead
  intake, manual CRM add → checkbox + disclosure text, written to the audit log.
- **Auto opt-out handling** in `/api/public/sms/inbound`: detect STOP/UNSUBSCRIBE/CANCEL/QUIT (and
  fuzzy "stop texting me") → set `sms_opt_out_at`, send one confirmation, suppress globally. HELP →
  auto-reply with business name + opt-out instructions.
- **Send-time guards**: refuse to send marketing to `consent != marketing` or opted-out numbers;
  enforce quiet hours; auto-append "Reply STOP to opt out" to marketing messages (and brand name in
  the first message).

---

## 3. SMS marketing best practices (engagement)

From 2026 benchmarks (sources §11). Encode these as **product defaults/guardrails**, not just docs:

- **Timing:** weekdays **9am–12pm and 5–9pm** convert best; **always respect local timezone** (10am
  EST = 7am PST — too early). Make timezone-aware send the default.
- **Frequency:** **1–2 marketing messages/week** max; enforce a per-customer frequency cap +
  post-contact cooldown across all campaigns. Fatigue → opt-outs → carrier filtering.
- **Personalization:** name, last service, property/zone, season, loyalty status. Brands using
  segment-based personalization see ~10–15% higher revenue. YardWorx already has the signals
  (`aiScore`, `tags`, `notes`, service history) — the AI drafter should *use* them.
- **Segmentation:** by lifecycle (lead/active/lapsed), value, service-history, geography. Batch-and-
  blast is the anti-pattern; the existing `segment` filter is the seed.
- **Automated flows >> one-off blasts:** triggered/automated SMS reportedly generates **~30× more
  revenue** than one-off campaigns. **Lead with automations, not blasts** (ties directly to
  `automations.ts`).
- **Message craft:** ≤160 chars where possible (1 segment = cheaper + better delivery), one clear CTA,
  identify the business, conversational tone. Show a **segment counter** in the composer.
- **Conversion context:** SMS campaigns convert ~21–32%; CTR ~19–35%. Two-way/conversational beats
  one-way. **Speed matters:** replying to an inbound lead within ~5 min ≈ 21× the conversion vs 30 min
  — which is exactly the case for an **always-on AI responder** (§5).

---

## 4. Field-service / landscaping playbook (campaign types that map to the revenue cycle)

Landscaping revenue is **seasonal + recurring**, which is ideal for SMS. The feature should ship with
these as **pre-built, AI-fillable templates** (not a blank box), each wired to a trigger and a segment:

**Triggered automations (highest ROI — build first):**
1. **Appointment confirm + reminder** (24h / morning-of) — cuts no-shows up to ~30%. (transactional)
2. **On-my-way / ETA** — tech en route (already a YardWorx feature; route SMS through this engine).
3. **Quote/lead fast-response** — inbound lead → instant AI text within seconds (the 21× window).
4. **Review request** — fires on `job_completed` (+ delay), with a Google review link. (transactional-ish; keep light)
5. **Invoice / payment** — branded invoice + Stripe pay link on completion (already roadmapped).
6. **Referral ask** — after a 5-star review or N completed jobs (feeds the Referrals engine).

**Scheduled marketing campaigns (need PEWC consent):**
7. **Seasonal offers** — spring aeration/cleanup, summer mowing plans, fall leaf/gutter, winter snow/
   salt. Target customers who used *that exact service last year* (service-history segment).
8. **Win-back / reactivation** — lapsed customers (no job in N months; `aiScore` low or `status:lapsed`).
9. **Recurring-plan upsell** — one-off customers → seasonal contract (ties to recurring billing).
10. **Weather-triggered** — storm cleanup, pre-freeze, drought reseed (you already have a weather workflow).
11. **Capacity-fill** — text nearby customers to fill a route gap / cancellation same-day.

These map cleanly onto existing triggers (`job_completed`, `invoice_paid`, weather workflow) and the
segmentation already in `AutonomousCampaigns.tsx`.

---

## 5. Next-gen agentic features (the moat — this is where YardWorx wins)

Generic text-blast tools are commodities. YardWorx's differentiator is the **agent layer it already
has** (Gemini function-calling executor behind Live Ear, `automations.ts`, catalog grounding,
long-context customer history). Apply it to texting:

1. **Self-writing campaigns (grounded).** Extend `/api/outbound/draft-personalized-campaign` with an
   SMS channel: per-customer message grounded in their history + the tenant's service catalog (the
   same non-hallucinated-pricing principle as Design Studio). Human approves a batch in one screen.
2. **Conversational AI auto-reply (the headline feature).** When a customer replies, run the inbound
   text through the **same tool-calling agent** that Live Ear uses. It can: answer FAQs (hours,
   pricing from catalog), reschedule, **book a job** (`schedule_job`), create a lead, send a quote
   link, or **hand off to a human** when unsure or when policy requires. Always-on, sub-minute
   response = the 21× lead-conversion window, captured automatically. _This is the feature no
   commodity SMS tool has and that your architecture already supports._
3. **Audience that targets itself.** Instead of the operator building a segment, an agent proposes
   one: "47 lapsed customers who bought fall cleanup last year and live in ZIP 9xxxx — draft a
   win-back?" Powered by `aiScore` + history + (roadmapped) embeddings semantic search.
4. **`send_sms` as a Live Ear tool.** During an on-site voice session, the rep says "text her the
   proposal link" → agent sends it immediately. Closes the loop between voice selling and follow-up.
5. **AI-suggested replies in the unified inbox.** Even when a human stays in the loop, draft the reply
   (grounded in the thread + customer record) for one-tap send — the assistive middle ground.
6. **Reply-intent routing.** Classify each inbound ("interested" / "reschedule" / "complaint" /
   "STOP" / "question") → auto-handle, escalate, or suppress. Complaints route to a human + flag the
   account.
7. **Batch API overnight runs.** `TODO.md` already calls this out: nightly, draft seasonal/win-back
   SMS for the whole book at low cost, queued for operator approval in the morning.
8. **Outcome-aware optimization.** Because sends, replies, bookings, and revenue all live in the same
   DB, the agent can learn which message/time/segment actually books jobs and bias future drafts —
   a real feedback loop, not vanity open-rates.

**Guardrails (carry over the existing patterns):** human-in-the-loop approval for marketing batches;
agentic auto-reply gated by tier + AI credit wallet; never auto-send to non-consented/opted-out
numbers; confidence threshold → human handoff; full audit log of every agent action (reuse the
Live Ear executor's logging).

---

## 6. Making it a "big, inviting" feature (product/UX)

To feel like a flagship, not a buried CRM tab:

- **A dedicated "Campaigns" / "Messages" surface** in the nav (not just the per-customer SMS tab),
  matching the forest/zinc, dense-uppercase aesthetic.
- **Start from a goal, not a blank box** ("Fill my Tuesday route," "Win back fall-cleanup customers,"
  "Get more reviews") → agent proposes audience + draft → operator tweaks → approve. This is the
  "tell it, don't drive it" north star from the product research.
- **Live preview** with phone mockup, segment counter (1/2/3 SMS), and cost-per-send estimate.
- **One-screen batch review** of per-customer personalized drafts (approve all / edit individually) —
  reuse the `AutonomousCampaigns` review UI.
- **Honest status everywhere** (the P0 trust theme in `TODO.md`): show `simulated` vs real send,
  delivered/failed/opted-out per recipient — never fake "Sent!".
- **Compliance built into the UX, invisibly:** consent state shown per contact; opted-out contacts
  auto-excluded with a count ("12 excluded: no marketing consent"); STOP footer auto-added; quiet-
  hours auto-deferred ("scheduled for 9am their time").
- **Two-way inbox** as the daily-driver: one chronological thread per customer (SMS + portal + email),
  AI-suggested replies, unread badges — the surface Jobber/Housecall make central.
- **Templates + a results dashboard** (sent → delivered → replied → booked → revenue) so the value is
  legible to a non-technical owner.

---

## 7. Proposed architecture & phased build plan

Lean on what exists; gate by tier + credits; keep it demoable in mock mode.

**Phase 0 — Compliance foundation (blocker; mostly schema + guards)**
- Add consent fields + audit log to `customers` (Supabase migration, RLS-scoped like existing tables).
- Opt-in capture in booking widget / portal / lead intake / manual add.
- STOP/HELP auto-handling + global suppression in `/api/public/sms/inbound`.
- 10DLC onboarding step (collect brand/campaign info; call Twilio registration APIs) + a
  `LAUNCH_CHECKLIST.md` gate. Decide ISV sub-account model (§2a).

**Phase 1 — Campaign send infrastructure**
- `customer_messages` (or a new `campaign_sends`) gains `campaign_id`, `channel`, `status`,
  `twilio_sid`, `error_code`, `direction`.
- `POST /api/sms/send-bulk` — batched, throttled (respect MPS), consent-filtered, quiet-hours-aware,
  STOP-footer-appending; simulate without keys.
- Twilio **status-callback** webhook → update delivery status (queued/sent/delivered/failed/undelivered).
- `campaigns` table (name, segment def, template, schedule, channel, status, metrics) + a simple
  scheduler/queue (cron-style or a `scheduled_for` poller) — wire into `automations.ts`.

**Phase 2 — Agentic drafting + UI**
- Extend `/api/outbound/draft-personalized-campaign` with `channel:"sms"` + SMS system prompt
  (≤160 char, CTA, brand, STOP footer, no fabricated prices).
- Build the Campaigns surface: goal-first builder, segment counter, batch review, results dashboard
  (clone/extend `AutonomousCampaigns.tsx`).
- Pre-built templates for the §4 playbook; wire triggered automations (reminder/on-my-way/review/win-back).

**Phase 3 — Conversational AI + two-way inbox (the differentiator)**
- Inbound-SMS agent loop reusing the Live Ear tool executor (answer/reschedule/book/quote/handoff),
  tier+credit gated, with confidence→human handoff and full audit logging.
- Unified two-way inbox with AI-suggested replies; reply-intent routing.
- `send_sms` Live Ear tool.

**Phase 4 — Next-gen channels & optimization**
- **RCS Business Messaging** via Twilio (branded/verified sender, rich cards/buttons, read receipts;
  ~+32% engagement, big trust lift; iOS 18.1+ & Android) with **automatic SMS fallback**. Use
  Twilio's Content API templates so the same campaign renders as RCS-or-SMS.
- Self-targeting audiences (embeddings), Batch-API nightly drafting, outcome-aware optimization.

**Cross-cutting:** every AI/send op rides the existing **AI credit wallet + tier gates**; everything
**simulates** cleanly with no Twilio/Gemini keys (preserve mock mode); reuse `parseGeminiJson` +
structured output (`responseSchema`) so AI→DB writes can't be malformed.

---

## 8. Data model changes (summary)

- **`customers`** (+): `sms_consent` enum, `sms_consent_at`, `sms_consent_source`, `sms_opt_out_at`,
  `timezone` (or derive from geocode).
- **`customer_messages`** (+): `campaign_id`, `channel` (`sms|rcs|email`), `direction`,
  `status`, `twilio_sid`, `error_code` — so SMS/email stop being commingled untyped rows.
- **`campaigns`** (new): `id`, `tenant_id`, `name`, `channel`, `segment_definition` (jsonb),
  `template`/`body`, `schedule`/`scheduled_for`, `status`, metrics counters.
- **`sms_consent_log`** (new, append-only): per-event consent/opt-out proof (TCPA defense).
- **`phone_number_registry`** (new): `To`-number → `tenant_id` for multi-tenant inbound routing.

All RLS tenant-scoped via the existing `private.*` helpers; additive + idempotent migrations like
`0006`.

---

## 9. Risks & open questions

1. **10DLC model decision** (ISV sub-accounts vs shared) — affects onboarding UX, deliverability, and
   liability. **Needs a decision before Phase 1.** _Lean: per-tenant sub-account brand/campaign._
2. **Registration latency** (~10–15 day campaign review) means tenants can't text on day one — design
   onboarding to set expectations + start registration early.
3. **Consent provenance for migrated contacts** — a tenant importing an old customer list does **not**
   automatically have texting consent. Default imported contacts to `transactional`-only (or none) and
   require explicit opt-in before marketing. Don't let CSV import create TCPA liability.
4. **Cost & metering** — Twilio per-segment + carrier fees + Gemini drafting/reply cost. Must ride the
   credit wallet and be visible to the operator. RCS pricing differs from SMS.
5. **Auto-reply autonomy boundary** — how far the agent acts without a human (booking yes? quoting a
   price? refunds no). Define a risk-tier policy (reuse the closeout ActionCard risk tiers).
6. **Quiet hours / timezone accuracy** depends on geocoding (roadmapped but not done) — gate
   timezone-aware send on that.
7. **Two-party-consent recording** (already flagged for Live Ear) is adjacent if calls get added.
8. **Legal review** of all consent/opt-in/disclosure copy before launch (per `MARKET_RESEARCH.md`).

---

## 10. Recommended immediate next steps

1. **Decide the 10DLC model** (§9.1) — product/founder call; unblocks everything.
2. **Ship Phase 0 (consent + STOP handling + opt-in capture)** — small, high-leverage, removes the
   legal blocker and is buildable now.
3. **Prototype the agentic auto-reply** on the existing inbound webhook + Live Ear executor — this is
   the demo that differentiates and validates the architecture bet.
4. Fold this into `TODO.md` research item #4 (already references SMS 10DLC/A2P + TCPA) and add a
   `LAUNCH_CHECKLIST.md` line for 10DLC registration.

---

## 11. Sources

Compliance / Twilio:
- [Twilio — Programmable Messaging & A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)
- [Twilio Help — A2P 10DLC Campaign Approval Requirements](https://help.twilio.com/articles/11847054539547-A2P-10DLC-Campaign-Approval-Requirements)
- [Twilio Help — Message throughput (MPS) & Trust Scores](https://help.twilio.com/articles/1260803225669-Message-throughput-MPS-and-Trust-Scores-for-A2P-10DLC-in-the-US)
- [Twilio — US SMS Guidelines](https://www.twilio.com/en-us/guidelines/us/sms) · [Twilio Messaging Policy](https://www.twilio.com/en-us/legal/messaging-policy) · [Compliance Toolkit](https://www.twilio.com/docs/messaging/features/compliance-toolkit)
- [A2P 10DLC Registration: Developer's Guide (2026)](https://www.pingram.io/blog/a2p-10dlc-registration-the-complete-developer-s-guide-2026)

TCPA / consent:
- [Holland & Knight — Fifth Circuit Rejects "Prior Express Written Consent" (Mar 2026)](https://www.hklaw.com/en/insights/publications/2026/03/tcpa-reset-fifth-circuit-rejects-prior-express-written-consent-rule)
- [Nelson Mullins — FCC's PEWC Rule changes](https://www.nelsonmullins.com/insights/alerts/fcc-download/all/the-fcc-s-prior-express-written-consent-rule-is-changing-this-month-what-marketers-need-to-know)
- [ActiveProspect — TCPA text rules 2026](https://activeprospect.com/blog/tcpa-text-messages/) · [Infobip — 2026 TCPA guide](https://www.infobip.com/blog/tcpa-compliance-sms) · [Salesmsg — SMS compliance 2026](https://www.salesmessage.com/blog/sms-marketing-compliance)

SMS marketing / benchmarks:
- [Mailchimp — SMS best practices 2026](https://mailchimp.com/resources/sms-best-practices/) · [Braze — SMS marketing guide](https://www.braze.com/resources/articles/a-complete-guide-to-sms-marketing)
- [InsiderOne — 10 SMS best practices 2026](https://insiderone.com/sms-marketing-best-practices/) · [MessageFlow — SMS benchmarks 2026](https://messageflow.com/blog/sms-marketing-benchmarks/)

Home-services SMS:
- [PitchPrfct — SMS for home services playbook](https://www.pitchprfct.com/blog/sms-marketing-for-home-services/) · [EZ Texting — construction & home services](https://www.eztexting.com/industries/construction-home-services) · [SimpleTexting — home services](https://simpletexting.com/industry/text-message-marketing-tool-for-home-services/)

RCS / next-gen:
- [Twilio — RCS Business Messaging](https://www.twilio.com/en-us/messaging/channels/rcs) · [Twilio — RCS GA announcement](https://www.twilio.com/en-us/press/releases/rcs-general-availability) · [Twilio — RCS vs iMessage 2026](https://www.twilio.com/en-us/blog/insights/rcs-vs-imessage)

Conversational AI SMS:
- [Twilio — Conversational AI](https://www.twilio.com/en-us/products/conversational-ai) · [Salesmsg — Conversational AI SMS](https://www.salesmessage.com/blog/conversational-ai-sms)

_Several Twilio doc pages return HTTP 403 to automated fetch; figures cross-confirmed via Twilio
help-center search snippets + the aggregators above. Verify time-sensitive pricing, throughput, and
legal details against primary sources / counsel before GTM or go-live._
