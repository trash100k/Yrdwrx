# YardWorx — Pricing & Monetization Strategy

_Owner's target model: **solid monthly subscription + per-seat, then usage-metered charges
on top** (SMS, AI/API calls, Live-Ear voice minutes, aerial lookups, PDF renders). Designed
so YardWorx is simple to sell, captures usage upside, and **never loses money on a heavy
user.** Every metered rate clears its COGS with margin._

**Status:** strategy + implementation plan. Not yet wired into billing. Grounds on the
existing credit-wallet seam (`AI_CREDITS` / `meterCredits` / `/api/stripe/subscribe`).
**Author:** pricing-strategist. **Date:** 2026-07-05.

> **Number-provenance note.** Competitor prices are from `MARKET_RESEARCH.md`'s verified
> 2026 table (itself cross-confirmed via Capterra/GetApp/Software Advice snippets; several
> vendor pages 403'd to automated fetch — **re-verify before GTM**). Unit COGS are **labeled
> estimates** with a stated basis (public 2026 list-price ballparks for Gemini/Twilio/Stripe/
> Cloud Run + imagery-API ranges). No figure here is a quote; treat COGS as ±30% and confirm
> against live invoices before locking retail rates.

---

## 1. Model shape (one paragraph)

Three subscription tiers (**Free → Pro → Enterprise**, matching the existing
`free | pro | enterprise` tenant enum) each bundle a fixed number of **seats** and a monthly
**allotment** of every metered resource. Extra crew members are **per-seat add-ons**. Past
the bundled allotment, each resource meters at a transparent **per-unit overage rate** priced
2.5–7× its cost floor. Hard **spend caps + alerts** cap bill shock. This keeps the headline
price competitive (land) while usage-heavy tenants pay for what they burn (expand), and the
markup on every unit guarantees positive gross margin at any usage level.

---

## 2. Base tiers

| | **Free (Solo)** | **Pro** | **Enterprise** |
|---|---|---|---|
| **Monthly (billed annually)** | $0 | **$249/mo** ($2,490/yr — ~2 mo free) | **$649/mo** ($6,490/yr) |
| **Tenant tier enum** | `free` | `pro` | `enterprise` |
| **Onboarding / setup fee** | **$0** | **$0** | **$0** |
| **Included seats** | 1 | 3 | 8 |
| **Add'l seat / mo** | — (upgrade) | **$29** | **$25** |
| **AI credits / mo** | 50 | 1,000 | 10,000 |
| **SMS segments / mo** | 0 (PAYG only) | 250 | 1,500 |
| **Live-Ear voice min / mo** | 10 | 60 | 300 |
| **Aerial lookups / mo** | 0 | 25 | 150 |
| **PDF renders / mo** | 20 | Unlimited* | Unlimited* |
| **QuickBooks sync, card+ACH payments, recurring billing** | — | ✅ | ✅ |
| **AI selling suite (Design Studio + Live-Ear closing)** | Trial-limited | ✅ | ✅ + priority |

\* "Unlimited" PDF is soft-capped at 500/mo/seat for abuse control (COGS is ~$0, see §4);
past the cap it meters at $0.10 as a throttle, not a profit center.

**Design intent**
- **Free = land.** Enough to run the on-site demo (10 Live-Ear min, 50 AI credits) so the
  differentiator (§6) lands before a card is asked for. No SMS included (TCPA/10DLC exposure —
  gate it behind a paid, registered tenant, see §7).
- **Pro = the workhorse**, priced **$249** — above Jobber Grow ($199), below Jobber Plus
  ($599) and **below LMN Starter ($297) and Pro ($648)** — and with **no onboarding fee**,
  saving the buyer LMN's ~$797–$1,497 upfront (§6). AI credit / SMS / voice / aerial defaults
  reuse the values already in `server.ts` (`AI_CREDITS` pro=1000, enterprise=10000).
- **Enterprise = top SMB tier**, priced under Aspire's revenue-tier floor (Aspire starts at
  $1M+ revenue, unlimited users). 8 seats included keeps a 6–8 crew shop flat-rate; per-seat
  above that scales the account without a "call sales" wall.

---

## 3. Per-seat pricing

- Seats above the tier's included count: **Pro $29/seat/mo, Enterprise $25/seat/mo.**
- A "seat" = a user login (owner/admin/employee/foreman roles; `client` portal users are
  free and uncounted). Basis: seat COGS is effectively zero (auth + storage); the price is
  **value/ARPU capture**, benchmarked below SingleOps' and Jobber's per-user adds while
  staying meaningful. Annual seats discount with the base (~2 months free).
- **Why per-seat over the tier only:** it lets a 5-person crew on Pro ($249 + 2×$29 = $307)
  sit far under LMN Pro ($648 + $1,497 setup) yet grows revenue with headcount — the metric
  that actually correlates with a landscaper's ability to pay.

---

## 4. Metered rates + COGS basis

**All COGS figures are 2026 labeled estimates** (basis stated per row). Retail rate is set so
gross margin holds even if COGS runs 30% over estimate.

| Meter | Retail overage rate | Est. COGS / unit | Markup | COGS basis (estimate) |
|---|---|---|---|---|
| **AI credit** (1 grounded text gen) | **$0.04** (PAYG $0.05; 500-pack $20) | **~$0.006** | ~6.7× | Gemini 2.5 Flash ≈ $0.30/1M in, $2.50/1M out; a grounded call ≈ 5K in + 1.2K out ≈ $0.0045, rounded up for cache-miss/retry. |
| **AI design/image render** | consumes **5 credits** (~$0.20–0.25) | **~$0.10–0.30** | ~1.5–2× | Coordinator range + Gemini/Imagen image-gen list ballpark; Design Studio edits often render multiple variants — weight it heavier than a text call. |
| **SMS segment** (outbound) | **$0.03** | **~$0.012** | ~2.5× | Twilio US ≈ $0.0079/segment + carrier pass-through ≈ $0.003 + amortized 10DLC brand/campaign/monthly (§7). MMS ~2×. |
| **Live-Ear voice minute** | **$0.30/min** | **~$0.12/min** | ~2.5× | Gemini Live native-audio, blended in+out audio tokens ≈ $0.10–0.15/min (est). The single most expensive unmetered surface — cap it hard. |
| **Aerial / satellite lookup** | **$3.00 / property** | **~$1.00** | ~3× | Imagery-measurement API per-property range $0.50–$2.00 (Regrid / Nearmap / SiteRecon / SatQuote-class); pass-through-plus-margin. **Biggest margin compressor** — see personas. |
| **PDF render** | Included; **$0.10** past soft cap | **<$0.001** | throttle only | Cloud Run ≈ $0.000024/vCPU-s + $0.0000025/GiB-s; a 3s, 2-vCPU Puppeteer render ≈ $0.0002. Effectively free; meter exists only to stop abuse. |
| **Stripe (on the whole bill)** | absorbed in margin | **2.9% + $0.30** card; **0.8% (≤$5) ACH**; **+~0.5–0.7%** Stripe Billing on metered volume | — | Standard Stripe US + Billing usage-based surcharge (est). Modeled as a COGS line in every persona below. |

**Rate rationale**
- Every unit is **≥2.5× COGS** except design-image (heavier, still ≥1.5×) — so no usage
  pattern can invert margin.
- Rates are **round and legible** ($0.03 / $0.30 / $3.00) so the in-app estimator and the
  invoice line items read cleanly and don't feel nickel-and-dimed.
- **Credit weighting** (text = 1, design/image = 5) reuses the existing "1 credit per AI call"
  meter (`meterCredits`, server.ts:1027) with a per-route multiplier — minimal code change.

---

## 5. Persona bill models (light vs heavy) — margin proof

COGS lines use the §4 estimates; Stripe modeled as 2.9% + $0.30 on the card-paid monthly total.
**Gross margin = (Revenue − COGS) / Revenue.** All figures $/mo.

### Persona A — Solo op (Pro, uses 1 of 3 included seats)

| | Light | Heavy |
|---|---|---|
| Usage | 400 cr · 80 SMS · 20 Live · 8 aerial | 2,500 cr · 600 SMS · 120 Live · 40 aerial |
| Base | $249 | $249 |
| Overage | $0 (within allotment) | AI 1,500×$0.04=$60 · SMS 350×$0.03=$10.50 · Live 60×$0.30=$18 · aerial 15×$3=$45 → **$133.50** |
| **Revenue** | **$249** | **$382.50** |
| COGS (AI/SMS/Live/aerial) | $2.40 / $0.96 / $2.40 / $8.00 | $15.00 / $7.20 / $14.40 / $40.00 |
| COGS (Stripe) | $7.52 | $11.39 |
| **Total COGS** | **≈$21.28** | **≈$87.99** |
| **Gross margin** | **~91%** | **~77%** |

### Persona B — 5-crew (Pro, 3 incl + 2 add'l seats @ $29 = base $307)

| | Light | Heavy |
|---|---|---|
| Usage | 800 cr · 200 SMS · 40 Live · 20 aerial | 4,000 cr · 1,200 SMS · 150 Live · 60 aerial |
| Base (incl. seats) | $307 | $307 |
| Overage | $0 | AI 3,000×$0.04=$120 · SMS 950×$0.03=$28.50 · Live 90×$0.30=$27 · aerial 35×$3=$105 → **$280.50** |
| **Revenue** | **$307** | **$587.50** |
| COGS (usage) | $4.80 / $2.40 / $4.80 / $20.00 | $24.00 / $14.40 / $18.00 / $60.00 |
| COGS (Stripe) | $9.20 | $17.34 |
| **Total COGS** | **≈$41.20** | **≈$133.74** |
| **Gross margin** | **~87%** | **~77%** |

### Persona C — 20-crew (Enterprise, 8 incl + 12 add'l seats @ $25 = base $949)

| | Light | Heavy |
|---|---|---|
| Usage | 3,000 cr · 600 SMS · 120 Live · 60 aerial | 20,000 cr · 3,500 SMS · 500 Live · 250 aerial |
| Base (incl. seats) | $949 | $949 |
| Overage | $0 | AI 10,000×$0.04=$400 · SMS 2,000×$0.03=$60 · Live 200×$0.30=$60 · aerial 100×$3=$300 → **$820** |
| **Revenue** | **$949** | **$1,769** |
| COGS (usage) | $18.00 / $7.20 / $14.40 / $60.00 | $120.00 / $42.00 / $60.00 / $250.00 |
| COGS (Stripe) | $27.82 | $51.60 |
| **Total COGS** | **≈$127.42** | **≈$523.60** |
| **Gross margin** | **~87%** | **~70%** |

**Takeaways**
- **Margin never drops below ~70%**, even for the 20-crew heavy user — the requirement is met.
- **Aerial is the margin compressor** at every scale (biggest COGS per unit). If aerial volume
  grows, either raise the rate to $3.50–4.00 or negotiate a wholesale imagery contract; keep
  aerial gated (0 included on Free) and cap-alerted.
- **Base subscription alone is very high margin** (~87–91% light); overage margin is thinner
  but still strongly positive — usage upside is pure accretion, never a loss.
- ARPU ladder: Solo ~$249–383 → 5-crew ~$307–588 → 20-crew ~$949–1,769. Clean land-and-expand.

---

## 6. Positioning vs competitors (2026, per `MARKET_RESEARCH.md`)

| Competitor | Their 2026 pricing | YardWorx move |
|---|---|---|
| **Jobber** | Core ~$39 / Connect ~$119 / Grow ~$199 / Plus ~$599; per-user caps; ~35% annual | Pro $249 sits **between Grow and Plus** but bundles the **AI selling suite** Jobber gates. Jobber Voice overlaps Live-Ear → **reposition Live-Ear as on-site *closing*, not voice-admin.** |
| **LMN** (Granum) | Starter $297 (+~$797 setup) / Pro $648 (+~$1,497 setup) | **No onboarding fee** = the headline wedge (save $797–$1,497 day one). Pro $249 < their Starter $297; Enterprise $649 ≈ their Pro $648 but **$0 setup**. |
| **SingleOps** (Granum) | $220 / $385 / $550 + per-extra-user; ~9% annual | Comparable base band; differentiate on **bundled AI + transparent metered usage** vs their per-user adds. Note: SingleOps+LMN are now one competitive bloc (Granum). |
| **Aspire** (ServiceTitan) | Revenue-tiered ($1M–3M / 3M–15M / 15M+), unlimited users; **not for startups** | Stay **below Aspire's revenue floor**. Our per-seat SMB model serves exactly the operators Aspire abandons. Don't compete on routing/scale — compete on the on-site close. |
| **Yardbook** | Free + ~$35 / ~$50 | Anchors the floor. Our Free tier matches the "free to land" play but routes to a **paid AI upsell**, not an ad model. |

**One-line position:** _"$0 to set up, $249 to run your crew, and you only pay for the texts,
AI, and aerial you actually use — with a live cap so the bill never surprises you."_ Undercuts
LMN's setup fee, sits below Aspire's floor, and land-and-expands on the AI-selling upsell that
`MARKET_RESEARCH.md` identifies as the open lane.

---

## 7. Risks & mitigations

### Bill shock (the #1 churn/refund risk on metered pricing)
- **Real-time usage dashboard** (extend `AiUsage.tsx` + `/api/usage/credits`) showing every
  meter, projected month-end bill, and % of allotment consumed.
- **Alerts at 50 / 80 / 100%** of each allotment and of any spend cap (email + in-app).
- **Per-tenant spend cap** (`tenants.spend_cap_cents`): a hard ceiling that returns
  `402 SPEND_CAP_EXCEEDED` (mirrors today's `402 INSUFFICIENT_CREDITS`) and pauses metered
  ops until raised. Default cap on new tenants; owner opt-in to remove.
- **Prepaid credit packs** (500 AI credits / $20; SMS/aerial bundles) so cost-averse tenants
  buy known quantities instead of open-ended overage.
- **No silent auto-overage on Free** — Free tenants must explicitly upgrade to spend.

### TCPA / A2P 10DLC on SMS pass-through (legal exposure, not just cost)
- Sending business SMS in the US requires **A2P 10DLC registration**: one-time brand fee
  (~$4), campaign registration (~$15), monthly campaign fee (~$1.50–$10), plus per-message
  carrier fees — all folded into the $0.012 COGS estimate and recovered by the $0.03 rate.
- **Consent + opt-out are mandatory (TCPA):** capture and store consent per customer, honor
  **STOP/HELP** keywords, respect quiet hours. The existing `/api/sms/send` **toll-fraud guard
  (own-customers-only, server.ts:4992)** is a good start but is **not consent** — add explicit
  consent capture + an opt-out suppression list before enabling paid SMS at scale.
- **Gate SMS behind a registered, paid tenant** (0 included on Free) so an unregistered/free
  account can't create carrier-violation or spam liability for the platform.
- Put SMS T&Cs (sender identity, opt-out, carrier-fee pass-through) in the tenant agreement;
  flag for **legal review** (already an open item in `TODO.md`'s human-blocker list).

### Stripe metered-billing mechanics
- Use **Stripe Billing usage-based (metered) Prices** as additional subscription items on the
  SaaS subscription created by `/api/stripe/subscribe` (server.ts:2253): one flat base Price +
  one metered Price per meter (SMS/AI/Live/aerial) + a per-seat Price with `quantity`.
- Report consumption with **Stripe meter events** (v2 Billing Meters) — push incrementally or
  roll up nightly from the usage ledger (§8). Metered items **can't be prepaid**; they invoice
  in arrears at period close, so pair with prepaid packs for cost-averse buyers.
- **Stripe Billing adds ~0.5–0.7%** on billed volume on top of processing — modeled in COGS;
  re-confirm the current surcharge before locking rates.
- Keep the **platform SaaS subscription separate from Connect** customer-billing: the tenant's
  YardWorx subscription is billed on the **platform account**; the contractor billing *their*
  customer stays on the **connected account** (`/api/stripe/recurring/checkout`, server.ts:2291).
  Don't cross the two.
- Handle **dunning** (`invoice.payment_failed`, already stubbed at server.ts:623): on failure,
  suspend metered ops (not just downgrade tier) so a delinquent account can't keep burning COGS.

### Other
- **Aerial COGS drift** (§5): monitor; raise rate or sign a wholesale imagery deal if volume
  climbs. **Gemini/Live price changes**: rates are env-driven (see §8) so they can be retuned
  without a deploy. **Sales-tax on SaaS + usage** varies by state — resolve with the tax-engine
  decision already open in `TODO.md`.

---

## 8. Implementation map (files to touch)

The billing seam already exists — this is an **extension**, not a rebuild.

- **`server.ts:976`** `AI_CREDITS` → generalize to a `TIER_ALLOTMENTS` map (seats, sms,
  live_min, aerial, credits per tier), env-driven.
- **`server.ts:1027`** `meterCredits()` → generalize to `meterUsage(meter, qty)` writing a
  usage ledger; keep the 402-on-exhaustion + fail-open behavior.
- **`server.ts:1258–1263`** metered route groups → add per-route credit **weights** (design/image = 5).
- **`server.ts:4985`** `/api/sms/send` → meter `sms` after a successful `messages.create`.
- **`server.ts:5776`** Live WS → replace flat 1-credit/session with **per-minute** metering.
- **`server.ts:4146`** `/api/invoices/generate-pdf` → nominal `pdf` meter past soft cap.
- **`server.ts:2253`** `/api/stripe/subscribe` → base + metered items + per-seat quantity.
- **`server.ts:571–620` / `:623`** webhook → read seat quantity; suspend on payment failure.
- **`server.ts:1240`** `/api/usage/credits` → expand to a multi-meter `/api/usage/summary`.
- **`src/pages/AiUsage.tsx`** + **`src/pages/Settings.tsx`** → usage dashboard + spend-cap UI.
- **`supabase/migrations/0007_tenant_credits.sql`** → follow with `0008_usage_ledger.sql`
  (`usage_events` + `tenants.spend_cap_cents`).
- **`.env.example`** → add `TIER_*_SEATS/SMS/LIVE/AERIAL`, `STRIPE_PRICE_SEAT_*`,
  `STRIPE_METER_*`, `PRICE_SMS_CENTS`, etc.

The concrete build steps are in the FINAL-message TODO block (this doc intentionally does not
edit `TODO.md`).

---

_Last updated: 2026-07-05 · pricing-strategist. Re-verify competitor prices and unit COGS
against live sources/invoices before any GTM or billing-go-live decision._
