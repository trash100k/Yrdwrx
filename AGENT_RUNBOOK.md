# YardWorx — Autonomous Agent Runbook (one-shot, looped, unsupervised)

**You are an autonomous engineer.** Your mission: take **YardWorx** (an AI-first, multi-tenant
landscaping SaaS) to **production-ready for its first set of US landscaping clients**, working in a
loop, unsupervised, using your **best judgment**. No one is watching each step — so decide, act,
verify, and document. Don't stall waiting for permission; only stop for the human-only blockers
listed below (build around them).

---

## 0. Read these first, every loop (sources of truth)
1. **`TODO.md`** — the living backlog (Parts A/B/C/D + the Gemini roadmap). **This is what to do.**
2. **`MARKET_RESEARCH.md`** — why; what landscapers actually buy on (table-stakes vs differentiators).
3. **`CLAUDE.md`** — repo conventions (read it; obey it).
4. **`/root/.claude/plans/greedy-orbiting-squid.md`** if present — the rolling design decisions.
Update `TODO.md` (check items off, add discoveries, bump `_Last updated_`) as you go — it's how the
next loop iteration (or a human) knows the state.

## 1. The loop
```
while not (Definition of Done met):
  1. Re-read TODO.md; pick the HIGHEST-VALUE unblocked item on the critical path (§4).
  2. Implement it (smallest coherent slice). Reuse existing code/patterns; don't rebuild.
  3. Verify (§5 gates) — build + test must pass; advisors clean after schema changes.
  4. Commit (conventional message + trailers, §6), push, open + MERGE the PR.
  5. Update TODO.md (check off, note follow-ups). 
  6. If blocked by a human-only item (§7): stub/flag it, write the exact 2-min human step into
     TODO.md + README, and move to the next unblocked item. Never fake a human-only step.
  repeat
```
Bias to **shippable increments** that keep `main` green. Prefer net-new/additive work (low risk) and
finish vertical slices over half-touching many files. When two paths exist, pick the one that gets a
real landscaper to value fastest (quote → job → invoice → paid), and write down the assumption.

## 2. Current state (DONE — do not redo)
- **Backend (hybrid, decided):** Firebase Auth + Cloud Run + **Vertex Gemini** + **Supabase Postgres
  for data** (bridged via Supabase Third-Party Auth → Firebase; RLS keys on `auth.jwt()->>'sub'`).
- **Supabase project `bzpxudpmksnawmaanxal`** (org GaelWorx `tsfrkcrubwmcokeeziys`): full schema +
  RLS **live & verified** (cross-tenant isolation proven; `get_advisors` security = 0). Migrations in
  `supabase/migrations/0001..0005`. Tables incl. customers/jobs/invoices/tasks/documents/etc.
- **Build/boot fixed:** `npm run build` emits frontend **and** `dist/server.cjs`; it boots + serves.
- **Auth-bypass fixed:** `verifyFirebaseToken` matches the full path, enforced behind **`REQUIRE_AUTH`**
  (default off so the mock-admin demo runs; flip on with real auth).
- **Repo layer** (`src/lib/repos/*`) over Supabase with **transparent camelCase↔snake_case mapping** in
  `makeRepo` — the frontend's camelCase works against Supabase with near-zero churn. Repos exist for all
  domains (`customersRepo`, `jobsRepo`, `invoicesRepo`, …).
- **CRM** components (Tasks/Jobs/Documents/CustomFields/Notifications/Contracts) built; **Design Studio**
  reliable + catalog-grounded pricing + 3D preview; **Live Ear** dev-safe + executes tools for real.
- **Branch:** all work on **`claude/claude-md-docs-pl7crd`**; PRs merged to `main` as we go.
- **Known follow-up:** the 4 components built before the camelCase mapping (CRMTasks/Jobs/Documents/
  NotificationsCenter) still use snake_case field names — update them to camelCase (they don't run live
  until keys land, so no current breakage).

## 3. Definition of Done — "production-ready for first clients"
Ship when ALL are true (and verified, not assumed):
- [ ] App **builds, boots, and deploys to Cloud Run**; SPA + `/api/*` served; no crash loop.
- [ ] **Real auth on:** `REQUIRE_AUTH=true`, real `onAuthStateChanged` restored, `useRole`/
  `TenantContext` read the real `profiles` row; **onboarding mints a unique tenant** (no `genesis-1`/
  `demo-tenant-1` collisions); demo bypass removed/flagged-off in prod.
- [ ] **Core flows run on Supabase** end-to-end for a real signed-in tenant: CRM, Scheduler, Invoices,
  Inventory, Dashboard read/write via repos (no Firestore on those paths); realtime works; tenant
  isolation holds (re-verify A≠B).
- [ ] **Money:** online card/ACH payment on invoices (Stripe Connect) **with the platform
  `application_fee` spread**; subscription tiers enforced (free/pro) + the AI **credit wallet** meters
  the expensive Gemini ops (402 at $0).
- [ ] **Table-stakes (per `MARKET_RESEARCH.md`):** QuickBooks sync (one-way min) OR Sheets export;
  estimates/quotes with e-sign → convert to job+invoice; online booking/instant-quote; two-way SMS.
- [ ] **Design Studio** reliably produces a grounded, priced good/better/best on a real photo.
- [ ] **Security:** `get_advisors` (security) = 0; no open `/api/playground/*` in prod; threat log
  admin-only; no secrets in the repo; CSP `frameAncestors` tightened.
- [ ] **Quality:** `npm run build` + `npm run test` green; CI workflow runs them on PRs; the
  `security_spec.md` "Dirty Dozen" + a cross-tenant test pass; **README rewritten** (real features,
  env, deploy, roles).
- [ ] **`.env.example`** complete; a documented runbook for the human's one-time setup (§7) exists.

## 4. Priority order (the critical path — build in this order)
1. **Make it real, not demo:** finish the Supabase **page cutover** (CRM, Scheduler, Invoices,
   Inventory, Dashboard → repos; fix the 4 snake_case components), restore **real auth + tenant
   provisioning**, flip `REQUIRE_AUTH=true`. (TODO Wave-2 Phase B + Part A2.)
2. **Get paid:** Stripe online payments + **`application_fee` spread**; tier enforcement + **credit
   wallet** (TODO A5). 
3. **Table-stakes to be credible:** estimates+e-sign, online booking, QuickBooks/Sheets export, two-way
   SMS (TODO Wave-2 Phase C + A7).
4. **Differentiators sharpened:** Design Studio native iterative image-editing; Live Ear on-site flow;
   the Gemini-3.x quick wins (thinking-mode estimates, code-execution measurement math) (TODO Gemini roadmap).
5. **Harden + document:** security items, tests + CI, README, de-uglify pass.
Within each, prefer the slice that unlocks the most downstream value. Use judgment; record deviations.

## 5. Verification gates (run before every commit)
- `npm run build` → frontend **and** `dist/server.cjs` must succeed.
- `npm run test` → green (currently 8/8).
- After any Supabase migration: `get_advisors` (security) must be **0**; spot-check RLS on new tables
  (seed two tenants, confirm A can't read/write B, then clean up).
- Grep the pages you cut over for leftover `firebase/firestore` imports — there should be none.
- Optionally boot `NODE_ENV=production node dist/server.cjs` and curl `/` + an `/api/*` route.
Never commit on a red gate. If you can't make it green, revert the slice and pick another item.

## 6. Commit / merge protocol
- Work on **`claude/claude-md-docs-pl7crd`** (create if missing). Never push to `main` directly.
- Conventional, descriptive commits. **End every commit message with:**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FRpG4SzbE316LF7ttAWKhZ
  ```
- After a logical group lands + gates pass: push, **open a PR and merge it to `main`** (squash/merge).
  Use the GitHub MCP tools (`mcp__github__*`); repo is `trash100k/Yrdwrx`.
- Never commit `.gemini_cache.json` changes (it's a runtime cache) — `git checkout -- .gemini_cache.json`
  before staging. Never commit `.env.local` or any real key.

## 7. Human-only blockers (build around; flag clearly; do NOT fake)
You cannot do these — stub the code to be ready and write the exact step into `README.md` + `TODO.md`:
- **Supabase Third-Party Auth → Firebase** in the Supabase dashboard (so Firebase JWTs validate under RLS).
- **`.env.local` secrets:** `VITE_SUPABASE_ANON_KEY`, `VITE_FIREBASE_*` (apiKey/authDomain/appId),
  `GEMINI_API_KEY` (or Vertex/ADC on Cloud Run), `STRIPE_*`, Twilio creds. The Supabase URL is known
  (`https://bzpxudpmksnawmaanxal.supabase.co`); fetch the anon key via the Supabase MCP if available.
- **Google OAuth verification / CASA** for sensitive Workspace scopes (gmail/calendar/drive) — needed
  before public launch; use least-privilege scopes meanwhile.
- **GCP:** enable Vertex AI API + grant the Cloud Run SA `roles/aiplatform.user`; Stripe live mode;
  domain/DNS. Document, don't attempt.
Everything you build should **light up the instant the human flips these on.**

## 8. Guardrails (non-negotiable)
- **Tenant isolation is sacred** — every table tenant-scoped + RLS; re-verify after schema changes.
- Keep the `// @ts-nocheck` headers; new shared types go in `src/types.ts`. `npm run lint` is `tsc --noEmit`.
- Preserve the **hybrid architecture** (don't rip out Firebase Auth / Cloud Run / Vertex; don't move
  hosting). Don't re-litigate decided choices in `TODO.md`/the plan.
- **Honesty:** report what's actually verified vs assumed. If a gate is skipped or a step stubbed, say so
  in the commit + TODO. Don't claim "done" without passing the gate.
- Keep quotes **catalog-grounded / deterministic** — never let the model invent the final prices/measurements.
- Gate heavy Gemini ops (image/video/search/voice) behind the **credit wallet + tier** (TODO A5).
- Stay scoped to `src/`, `server.ts`, `supabase/migrations/`, and real config. Never resurrect the root
  scratch scripts/dumps (`fix-*.cjs`, `*.txt`, etc.).

## 9. When to stop
Stop the loop when **§3 Definition of Done** is fully met and verified, OR when only human-only
blockers (§7) remain — at which point: ensure `main` is green, write a crisp **"ready for first
clients — here's the 5-step human setup"** section at the top of `README.md`, update `TODO.md`, and
report. If you hit the same wall ~3 times, change approach or pick a different item; don't spin.

---
_This runbook is the operating brief. `TODO.md` is the task list. `MARKET_RESEARCH.md` is the why.
Read all three, then build._
