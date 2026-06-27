# YardWorx — Production & Live Ear TODO

The working roadmap for getting YardWorx actually **running in production** (Google Cloud Run +
Firebase + Gemini) and building out the flagship **Live Ear** "design vision" feature.

This is grounded in the real state of the codebase — every task names the file/endpoint it
touches so work **reuses what already exists** instead of rebuilding it. See the
[Reference appendix](#reference-appendix) for the full file map.

## How to use this file

- Work top-to-bottom. **🔴 Phase 0 must land before anything else** — the app does not start
  today, so nothing else can be tested.
- Priority legend:
  - 🔴 **Blocker** — app won't run / deploy without it.
  - 🟠 **Risky** — works in demo, breaks or degrades under real production / scale.
  - 🟢 **Feature / polish** — the value-add and the "make it not ugly" work.
- Check items off as they land. Keep the file refs accurate when code moves.

---

## 🔴 Phase 0 — Get it running on Cloud Run

> Right now `cloudbuild.yaml` builds and deploys, then the container **crash-loops at runtime**:
> `npm run start` runs `node dist/server.cjs`, but `npm run build` only builds the frontend and
> never produces `dist/server.cjs`. Fix this first.

- [ ] **Add a server bundle step.** Bundle `server.ts` → `dist/server.cjs` with `esbuild`
  (already in devDependencies, currently never invoked).
  - Add script, e.g. `"build:server": "esbuild server.ts --bundle --platform=node --format=cjs --outfile=dist/server.cjs --external:puppeteer --external:firebase-admin"` (externalize native/heavy deps so they resolve from `node_modules` at runtime).
  - Wire it into build: `"build": "vite build && npm run build:server"`.
  - Verify `Dockerfile:19` (`RUN npm run build`) now emits both `dist/` (frontend) and `dist/server.cjs`.
  - Refs: `package.json:8-9`, `Dockerfile:19,46`.
- [ ] **Complete the Firebase _client_ config.** `src/lib/firebase.ts:14` has only `projectId`,
  so Firebase **Auth** (email + Google forms in `App.tsx`) cannot initialize.
  - Add `apiKey`, `authDomain`, `storageBucket`, `messagingSenderId`, `appId` via Vite env
    (`import.meta.env.VITE_FIREBASE_*`) — do **not** hardcode secrets.
  - Mirror the keys into `vite.config.ts` `define`/env handling.
- [ ] **Define and document required env vars.** Create `.env.example` (none exists today) with:
  `GEMINI_API_KEY`, `GOOGLE_MAPS_PLATFORM_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `TELEMETRY_EXPORT_KEY`, `JWT_SECRET`, Twilio creds, `OPENWEATHER_API_KEY`, the `VITE_FIREBASE_*`
  client keys, and `NODE_ENV`.
  - Add a startup check in `server.ts` that **warns loudly** for missing critical vars instead
    of failing silently.
- [ ] **Replace the hardcoded JWT secret.** `server.ts:3333` falls back to a dev string —
  require `process.env.JWT_SECRET` in production.
- [ ] **Confirm Cloud Run service account IAM.** `firebase-admin` initializes with only
  `projectId` and relies on ADC (`server.ts:435-444`). The Cloud Run service account needs
  Firestore + Firebase Auth Admin roles, or `verifyIdToken` and all DB writes fail silently.
- [ ] **Fix the ephemeral disk cache.** `.gemini_cache.json` is written to `process.cwd()`
  (`server.ts:210-228`); Cloud Run's FS is ephemeral/often read-only. Move to `/tmp` or gate
  behind an env flag so it can't crash the process.
- [ ] **Smoke test the container.** `npm ci` → `npm run build` → build the Docker image → run it
  → confirm `/` serves the SPA and at least one `/api/*` route responds. (Note: `node_modules`
  isn't present in a fresh clone — `npm ci` is step 0.)

---

## 🔴 Phase 1 — Turn real auth back on

> Auth is fully bypassed for internal testing. Before launch, restore it (keep an explicit,
> clearly-labeled demo path).

- [ ] **Restore the real auth listener.** Re-enable `onAuthStateChanged` in `src/App.tsx:101-124`
  (currently commented out; a mock admin is injected instead). Preserve a deliberate
  demo/bypass toggle behind a flag, not as the default.
- [ ] **Make `useRole` real.** `src/hooks/useRole.ts:4-8` hard-returns `owner` /
  `hasPermission: () => true`. Read the actual role from the Firebase user + Firestore `users` doc.
- [ ] **Make `TenantContext` real.** `src/contexts/TenantContext.tsx:64-91` hardcodes
  `demo-tenant-1`. Load the real tenant profile from Firestore and re-enable the
  `onAuthStateChanged` subscription.
- [ ] **Validate `firestore.rules`** against `security_spec.md` (the "Dirty Dozen") and
  `TEST_MATRIX.md`. Confirm the `demo-tenant-1` anonymous safe-hatch (`firestore.rules:40-44`)
  is acceptable or gated for production.
- [ ] **Audit the SaaS-admin gate.** Confirm `src/components/auth/SaaSOwnerGate.tsx` /
  `firestore.rules` owner-email check is correct and not overly permissive.

---

## 🟢 Phase 2 — Live Ear flagship: the live "design vision"

> The headline feature: while the rep talks to a customer, Live Ear looks them up in CRM, takes
> yard photos (file upload), hooks in pricing + plants, and **builds a vision live — a running
> line-item proposal AND an AI before/after render — to show the customer.**
>
> Good news: Live Ear is **already real** (`LiveEar.tsx` streams mic + camera over a WebSocket to
> `/api/live` → `ai.live.connect`). This phase **extends** it; it is not a rewrite. Every backend
> piece the vision needs already exists (see appendix) — the work is wiring + UI.

- [ ] **2a — Make Live Ear dev-safe.** `ai.live.connect` (`server.ts:3369`) is **not** covered by
  mock mode, so the WebSocket hard-fails with no `GEMINI_API_KEY` and closes the socket
  (`server.ts:3622-3625`). Wrap it to degrade gracefully / emit a mock transcript so the feature
  is demoable and dev doesn't break.
- [ ] **2b — Execute Live tools for real.** Today tool calls are echoed back as
  `"Action queued for dispatch in Meridian UI."` stubs (`server.ts:3387-3407`). Implement them:
  - `load_client_data` → query Firestore `customers` by name **and phone** (extend the
    name-only match at `CRM.tsx:559-569` with a normalized phone lookup), and feed the contact,
    `tenant.settings.serviceCatalog`, and the tenant `design_catalog` back into the live session.
  - Wire `schedule_job`, `create_invoice`, `create_lead`, `add_client_note` to their real
    Firestore writes / existing endpoints.
- [ ] **2c — Add a `build_design_vision` Live tool.** New tool declaration (alongside those at
  `server.ts:3448-3594`) + client handler in `LiveEar.tsx`. When the rep attaches a yard photo
  (reuse `compressImage`, `src/lib/imageUtils.ts`), the flow:
  1. `POST /api/design/process` (`server.ts:2230`) → `{ identifiedAreas, estimatedMaterials, visionSummary, … }`.
  2. `POST /api/design/tiers` (`server.ts:2475`) → Good / Better / Best pricing.
  3. Assemble a **live proposal**: detected services + recommended plants from the catalog +
     running price total (from `serviceCatalog` / `INITIAL_SERVICE_CATALOG`, `src/lib/constants.ts:1-54`).
  4. `POST /api/design/generate-mockup` (`server.ts:2336`, `gemini-3.1-flash-image`) → **AI
     before/after** image.
- [ ] **2d — Build the "Vision panel" UI.** A live, customer-facing panel that updates as the rep
  talks: itemized proposal + running total on one side, `BeforeAfterSlider` (`src/components/BeforeAfterSlider.tsx`)
  render on the other. Match the existing forest/zinc, uppercase-label, rounded-`xl` aesthetic.
- [ ] **2e — Persist the vision.** Save to a new `customer_design_visions` Firestore collection
  keyed by `customer.id`. Add a "send to client" action via the existing portal / magic-link flow
  (`/portal/:clientId`, `/api/auth/magic-link/*`).
- [ ] **2f — Implement Firebase Storage upload.** `storage` is exported (`src/lib/firebase.ts:36`)
  but never used. Add `uploadBytes` / `getDownloadURL` for the yard photos so visions reference
  durable URLs instead of inline base64.

---

## 🟢 Phase 3 — "It's ugly": UX / visual polish

> Fill in with specific screens once Phase 0–2 land and the worst offenders are obvious. Seed list:

- [ ] Auth screen (`App.tsx` `AuthPage`) — dense agreements block, tab styling, mobile spacing.
- [ ] Live Ear widget — cramped transcription/action popover; needs room for the new Vision panel.
- [ ] Design Studio flow (`src/pages/DesignStudio.tsx`) — upload → markup → result step clarity.
- [ ] Dashboard / CRM density pass — consistent spacing, empty states, loading skeletons.
- [ ] Mobile / PWA polish — safe-area insets, tap targets, install prompt.

---

## 🟠 Phase 4 — Hardening & scale

- [ ] **Distributed rate limiting.** `globalLimiter`/`aiLimiter`/`strictLimiter` use in-memory
  stores (`server.ts:456-503`) — per-instance only. Move to Redis (or accept per-instance limits
  and document it).
- [ ] **Persist the threat log.** `threatLog` is in-memory (`server.ts:355-372`) and lost on
  restart — persist to Firestore or a logging sink.
- [ ] **WebSocket pooling / clustering.** Address the FIXME at `server.ts:3361` — native `ws`
  doesn't survive multi-instance voice load; needs sticky sessions or a pooling layer.
- [ ] **Pay down type debt.** `// @ts-nocheck` is on ~57 files; `tsc --noEmit` surfaces real
  errors underneath. Tackle incrementally, starting with shared types in `src/types.ts`.
- [ ] **Add real tests.** Vitest is wired (`vitest.config.ts`) but coverage is minimal. Implement
  the `TEST_MATRIX.md` fuzzing cases and the `security_spec.md` "Dirty Dozen" against `firestore.rules`.
- [ ] **Remove remaining hardcoded secrets / demo bypasses** before public launch.

---

## Reference appendix

File-and-line map so each task is actionable without re-discovery.

**Build / deploy**
- `package.json:7-9` — `dev` / `build` / `start` scripts (missing server bundle).
- `Dockerfile:19,46` — `npm run build`, copies `dist/`.
- `cloudbuild.yaml` — Cloud Run deploy (`us-central1`, 2 CPU, 1Gi, concurrency 80).

**Auth / tenant**
- `src/App.tsx:101-124` — mock admin bypass; commented-out real auth listener.
- `src/hooks/useRole.ts:4-8` — hard-returns `owner`.
- `src/contexts/TenantContext.tsx:64-91` — hardcoded `demo-tenant-1`.
- `src/lib/firebase.ts:14` — incomplete client config; `:36` — unused `storage` export.
- `server.ts:424-452` — `verifyFirebaseToken`; `:435-444` — admin init via ADC + `projectId`.
- `firestore.rules:40-44` — demo anonymous safe-hatch. `security_spec.md`, `TEST_MATRIX.md`.

**Live Ear / voice**
- `src/components/LiveEar.tsx` — mic + back-camera capture, WebSocket client, audio playback.
- `server.ts:3363` — `WebSocketServer` at `/api/live`; `:3369` — `ai.live.connect`
  (`gemini-3.1-flash-live-preview`, voice "Zephyr").
- `server.ts:3372-3411` — message relay (audio / transcription / tool calls / interrupt).
- `server.ts:3387-3407` — tool calls echoed as `"Action queued…"` stubs (to implement).
- `server.ts:3448-3594` — declared Live tools. `:3622-3625` — connect error closes socket.
- `src/hooks/useSpeechRecognition.ts`, `src/lib/playVoice.ts`, `/api/agent/tts`
  (`server.ts:1398`), `/api/agent/hands-free-dictation` (`server.ts:1359`),
  `/api/agent/chat` (`server.ts:1424`).

**Design vision building blocks**
- CRM lookup by name: `src/pages/CRM.tsx:559-569` (add phone lookup). Customer type:
  `src/types.ts:55-80`. Firestore load: `CRM.tsx:510-517`. Seed data: `src/lib/seedDatabase.ts`.
- Pricing: `tenant.settings.serviceCatalog` (`TenantContext.tsx:23-45`),
  `INITIAL_SERVICE_CATALOG` (`src/lib/constants.ts:1-54`), `ServicePricingCatalog.tsx`.
- Plants/materials: tenant `design_catalog` collection (`DesignDatabasePanel.tsx`), hardcoded
  whitelist `server.ts:2238-2243`.
- `/api/design/process` (`server.ts:2230`), `/api/design/tiers` (`server.ts:2475`),
  `/api/design/generate-mockup` (`server.ts:2336`, `gemini-3.1-flash-image`).
- `src/components/BeforeAfterSlider.tsx`, `src/components/MarkupCanvas.tsx`,
  `compressImage` (`src/lib/imageUtils.ts`).

**Gemini / data**
- Mock mode: `server.ts:35` (`isMockMode`), `getMockText` `:57-207` (does **not** cover Live).
- Disk cache: `server.ts:210-228` (`.gemini_cache.json` in `process.cwd()`).
- Offline sync: `src/services/syncService.ts`; knowledge ingest: `src/services/brainService.ts`
  → `/api/knowledge/ingest` (`server.ts:1310`).
