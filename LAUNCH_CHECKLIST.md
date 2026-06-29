# YardWorx — Launch Checklist (path to first paying customer)

The app is **feature-complete and gated green** (lint + build + 123 tests; QA smoke crawl 18/19
routes crash-clean). What remains before you can sell is **human-only configuration**: secrets, the
network policy, Supabase auth settings, and flipping out of demo mode. This file is the ordered
runbook. Items are grouped; do them top to bottom.

> Context: the dev sandbox **blocks outbound egress to Gemini/Supabase/Stripe**, so the AI and
> real-data paths are built to the verified contract + are mock-safe, but their live behavior is
> **unverified until you run them with real keys + open egress**. The "Verify" steps below are how
> you confirm each once keys are in.

---

## 0. Accounts you need (one-time)
- [ ] **Supabase** project (already provisioned: `bzpxudpmksnawmaanxal`) — get the Service Role key.
- [ ] **Google AI (Gemini)** API key — powers the AI agent, Design Studio renders, closeout, digest, enrich.
- [ ] **Stripe** account (+ Connect if you take payments on behalf of tenants).
- [ ] **Twilio** account (SMS: On-My-Way, inbound replies, two-way inbox) — optional but recommended.
- [ ] **Resend** (or any SMTP) for outbound email — optional but recommended.
- [ ] **Google Maps Platform** key (route optimizer, customer/job maps, geocoding).

## 1. Environment variables (set in Cloud Run / `.env`, NOT committed)
Required to leave mock mode:
- [ ] `GEMINI_API_KEY` — **unset = mock mode** (canned AI, no real renders). Set it to go live.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — server-side privileged writes (inbound SMS persist, account delete, PDFs).
- [ ] `JWT_SECRET` — signs client-portal magic-link tokens.
- [ ] `NODE_ENV=production` — enables cluster mode + static serving from `dist/`.
- [ ] `WEB_CONCURRENCY=2` — worker count (matches Cloud Run 2 vCPU).

Payments / comms (set the ones you use; each degrades gracefully/simulates when unset):
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — checkout + webhook verification.
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS send/receive.
- [ ] `RESEND_API_KEY`, `EMAIL_FROM` — real outbound email (else email "simulates" → saved as draft).
- [ ] `GOOGLE_MAPS_PLATFORM_KEY` — maps + geocoding.

Optional:
- [ ] `MEASUREMENT_API_KEY` — survey-grade property measurement provider (else Instant Estimate uses a flagged AI estimate).
- [ ] `TELEMETRY_EXPORT_KEY` — guards the analytics export endpoint.

## 2. Network policy (the sandbox blocker)
- [ ] Allowlist outbound HTTPS to: `*.supabase.co`, `generativelanguage.googleapis.com` (Gemini),
      `api.stripe.com`, `api.twilio.com`, `api.resend.com`, `maps.googleapis.com`.
      Without this the server can't reach its dependencies even with keys set.

## 3. Supabase configuration
- [ ] **Auth → turn OFF "Confirm email"** (or wire an email confirmation flow) so new-tenant signup
      provisioning (`handle_new_user` trigger) completes without a manual step.
- [ ] Confirm RLS is on for all tables (it is — `get_advisors security` returns **0 issues**; re-run after any schema change).
- [ ] Set the auth redirect/site URL to your production domain.

## 4. Flip out of demo mode (currently auth is bypassed for testing)
- [ ] Set `VITE_REQUIRE_AUTH=true` (build-time, frontend) **and** `REQUIRE_AUTH=true` (server) so the
      real Supabase auth flow + tenant isolation engage instead of the mock admin.
- [ ] Rebuild the frontend after changing `VITE_*` (it's baked at build time).
- [ ] In `src/App.tsx` / `useRole`, confirm the mock-admin injection is gated behind the flag (it is) —
      no code edit needed, just the env flags.

## 5. Deploy
- [ ] `cloudbuild.yaml` builds the image (system Chromium for Puppeteer) → GCR → Cloud Run
      (`us-central1`, 2 vCPU / 1Gi, min 1, concurrency 80). Container runs `npm run start` → `node dist/server.cjs`.
- [ ] Set the Stripe webhook endpoint to `https://<your-domain>/api/stripe/webhook` (raw-body route,
      registered before `express.json()` — do not move it).
- [ ] Point your domain at the Cloud Run service.

## 6. Verify the live AI / money paths (do these once keys + egress are in)
- [ ] **AI agent / closeout / digest** respond with real (non-canned) output.
- [ ] **Design Studio render** — upload a yard photo, circle a spot, label it (e.g. "Japanese Maple"),
      Reveal. Confirm the object lands in the circle and the rest of the photo is unchanged
      (the client-side feathered composite). See `DESIGN_STUDIO_PLAN.md §8` for the must-test gates
      (seam invisibility, `MAX_REFS`, AR adherence, judge reliability).
- [ ] **Email**: send a design/invoice → arrives (not "simulated").
- [ ] **SMS**: On-My-Way + inbox send → delivered; inbound reply lands in the Inbox thread.
- [ ] **Stripe**: a test invoice checkout completes and the webhook marks it paid.
- [ ] **Set Business Defaults** (Settings): labor rate, $/sqft, USDA zone, owner email — so Job Costing,
      Instant Estimate, Owner Digest, and Design Studio plant-matching use your real numbers.

## 7. First-customer data
- [ ] Seed the tenant's **service pricing catalog** (Settings → pricing) — grounds quotes/estimates.
- [ ] Add the **design catalog** items (Design Studio → Catalog DB) — grounds plant placement + cost.
- [ ] Import/enter customers (CRM).

---

### Known follow-ups (not blockers to launch — see `TODO.md` / `DESIGN_STUDIO_PLAN.md`)
- Design Studio Phase 1 (segmentation surface-snap, VLM-judge auto-verify, edit history/undo) and
  Phase 2 (catalog data seed) — deepen the flagship; need a live Gemini key to tune.
- Server-side `sharp` composite hardening (flagged Cloud Run native-binary risk — verify the Docker build).
- Config-gated backlog: weather auto-reschedule (`OPENWEATHER`), card-on-file (Stripe SetupIntent),
  push notifications (FCM/VAPID), referral auto-credit on first paid invoice.

_Last updated: 2026-06-29._
