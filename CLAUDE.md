# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this project is

**YardWorx** is an AI-powered, multi-tenant field-service / landscaping operations
SaaS ("Operational Cockpit"). It is a single-repo full-stack app:

- A **React 19 + Vite** single-page PWA frontend (`src/`, `index.html`).
- A **single large Express 5 backend** in `server.ts` (~3,600 lines) that serves the
  API, proxies Google **Gemini** AI calls, renders PDFs with Puppeteer, exposes a
  WebSocket **Live** voice endpoint, and serves the built SPA in production.

> Naming note: the product has been rebranded several times. You will see
> **YardWorx**, **TerraMind Ops OS**, **Cutty**, and **Meridian Green** across the
> code, manifests, and log strings. They all refer to this same app. The current
> user-facing brand is **YardWorx**. `package.json` still says `react-example`.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, React Router 7, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), Motion, Recharts, lucide-react |
| Build/dev | Vite 8, `vite-plugin-pwa`, `tsx` (runs `server.ts` without compiling) |
| Backend | Express 5, `@google/genai` (Gemini), `ws` (WebSocket Live API), Puppeteer (PDF/HTML render), Stripe, Twilio, `firebase-admin`, Helmet, `express-rate-limit` |
| Data/Auth | Firebase (client SDK: Auth, Firestore, Storage, Analytics) + Firebase Admin on the server; security in `firestore.rules` |
| Mobile | Capacitor (`@capacitor/*`) for iOS/Android wrapping; `capacitor.config.ts` |
| Testing | Vitest + Testing Library (jsdom); Cypress is installed for E2E |
| Deploy | Multi-stage `Dockerfile` → Google Cloud Run via `cloudbuild.yaml` |

## Commands

```bash
npm install            # install deps (lockfiles: package-lock.json AND pnpm-lock.yaml both exist; npm is canonical per Dockerfile)
npm run dev            # concurrently runs `vite` (frontend) and `tsx server.ts` (API on port 3000)
npm run build          # vite build -> dist/ (frontend bundle)
npm run start          # node dist/server.cjs  (production server entrypoint)
npm run lint           # tsc --noEmit  (type-check only; this is the "lint")
npm run test           # vitest run
npm run clean          # rm -rf dist server.js
```

- **Dev:** the Express server (`server.ts`) mounts Vite as middleware and listens on
  **port 3000**, so the full app is reachable at `http://localhost:3000`. The API is
  authenticated via a `x-firebase-auth: Bearer <idToken>` header (see `src/lib/api.ts`).
- **`npm run lint` is type-checking**, not ESLint. There is no ESLint config. The
  "passing" bar is `tsc --noEmit` plus `vitest run`.
- **Production server entrypoint is `dist/server.cjs`.** `npm run build` only builds the
  Vite frontend; the server bundle (`server.ts` → `dist/server.cjs` via esbuild) is part
  of the deploy pipeline. If you change `start`/build behavior, keep this contract intact.

## Repository layout

```
index.html                 # SPA entry, loads src/main.tsx
server.ts                  # THE backend — all API routes, AI, PDF, WebSocket, static serving
firestore.rules            # Firestore security rules (the real authz model)
firebase-blueprint.json    # Firestore schema/collections blueprint
firebase-applet-config.json# { projectId } used by firebase-admin init on the server
vite.config.ts             # Vite + PWA (manifest, workbox runtime caching of /api/*)
capacitor.config.ts        # Capacitor native shell config
Dockerfile / cloudbuild.yaml  # Cloud Run build + deploy

src/
  main.tsx                 # React root
  App.tsx                  # Router + auth gate + role-based portal routing
  types.ts                 # Shared domain types (Customer, Job, Invoice, Lead, etc.)
  index.css                # Tailwind layer + design tokens (forest/zinc palette)
  pages/                   # Route-level screens (lazy-loaded): Dashboard, CRM, Scheduler,
                           #   Invoices, Inventory, Reviews, DesignStudio, RouteOptimizer,
                           #   Agent, Compliance, Contracts, Portfolio, ClientPortal,
                           #   Settings, SaaSAdminDashboard, AiPlayground, ...
  components/              # Reusable UI + feature panels (Button, Modal, Table, CRM*,
                           #   widgets/, auth/ guards, etc.)
  contexts/                # React context providers (Tenant, Toast, FieldMode,
                           #   EnterpriseTheme, CuttyGuide, WorkspaceOutbox)
  hooks/                   # useRole, useLocalStorage, useSpeechRecognition, useTranslate, ...
  lib/                     # firebase.ts, api.ts (authed fetch), storage.ts, securityUtils.ts,
                           #   constants.ts, seedDatabase.ts, imageUtils.ts
  services/                # brainService.ts (semantic memory), syncService.ts (offline queue)

public/                    # static assets + manifest.json
```

### Ignore these (legacy/scratch — do not treat as source of truth)

The repo root is littered with one-off migration/codemod scripts and dumps from past
rebrands and fixes. **Do not edit, extend, or imitate them**, and do not assume they run:
`fix-*.cjs`, `fix_*.ts`, `replace-*.cjs`, `rebrand*.cjs`, `add_nocheck.cjs`,
`apply_nocheck_all.cjs`, `remove-nocheck.cjs`, `reset-agreements.cjs`,
`security_gauntlet.cjs`, `test*.cjs`, `parse.ts`, `*.txt` dumps (`out.txt`, `audit.txt`,
`temp.txt`, `root_output.html`), and the `app/applet/` and `workspace/` scratch dirs.
Real application code lives in `src/`, `server.ts`, and the config files listed above.

## Architecture & key conventions

### Authentication & roles
- Roles: `"admin" | "owner" | "employee" | "client" | "foreman"` (`src/types.ts`,
  `src/hooks/useRole.ts`).
- `App.tsx` routes users into **role-scoped portals**: `/admin`, `/employee`, `/client`,
  `/saas-admin`. Guards live in `src/components/auth/` (`RoleGuard`, `SaaSOwnerGate`,
  `BiometricGuard`). Public routes: `/privacy`, `/terms`, `/data-map`, `/ai-usage`,
  `/portal/:clientId`, `/portal/auth/:token`.
- **Important — auth is currently bypassed for internal testing.** `App.tsx` injects a
  mock admin user (`admin@yardworx.io`) and `useRole()` hard-returns `owner` with
  `hasPermission: () => true`. The real Firebase `onAuthStateChanged` flow is commented
  out. If you touch auth, preserve or deliberately restore this; don't silently re-enable
  real auth without flagging it.
- Server-side, every `/api/*` request (except magic-link, stripe webhook, threats, and
  `/api/playground/*`) is verified by `verifyFirebaseToken`, which checks the
  `x-firebase-auth` header via `firebase-admin`. Client requests must go through
  `fetchApi` in `src/lib/api.ts`, which attaches the token automatically.

### Multi-tenancy
- `TenantContext` (`src/contexts/TenantContext.tsx`) holds the `TenantProfile`: tier
  (`free | pro | enterprise`), feature flags, quotas, service catalog, Stripe account, etc.
  Feature gating and AI quotas key off this profile.

### The backend (`server.ts`)
- One file, one `startServer()` function, dozens of `app.post("/api/...")` handlers grouped
  by domain: `/api/workflows/*`, `/api/agent/*`, `/api/crm/*`, `/api/brain/*`,
  `/api/design/*`, `/api/inventory/*`, `/api/invoices/*`, `/api/scheduler/*`,
  `/api/reviews/*`, `/api/marketing/*`, `/api/integration/*`, `/api/stripe/*`, etc.
- **Gemini AI:** all generation goes through the shared `ai` (`GoogleGenAI`) client.
  - **Mock mode:** if `GEMINI_API_KEY` is unset the server runs in mock mode —
    `getMockText()` returns canned responses keyed off the system instruction. Tests and
    local runs work without a key.
  - **Caching:** responses are SHA-256 cached to `.gemini_cache.json` on disk; some routes
    add an in-memory `cacheApiResponse(seconds)` layer.
  - Use `parseGeminiJson()` for model JSON (it strips ```` ```json ```` fences).
- **WebSocket Live API:** `ws` server at path `/api/live` bridges to `ai.live.connect`
  for real-time voice/dictation.
- **Security middleware:** Helmet CSP, request-payload injection/path-traversal scanning
  (logs to an in-memory `threatLog` surfaced at `/api/security/threats`), blocked file
  extensions, and tiered `express-rate-limit`: `globalLimiter` on all `/api/`, `aiLimiter`
  (100/day, keyed by Firebase UID) on AI routes, `strictLimiter` on `/api/stripe/`.
- **Stripe webhook** (`/api/stripe/webhook`) needs the raw body and is registered BEFORE
  `express.json()`. Don't move it below the JSON parser.
- In production with `NODE_ENV=production`, the server uses Node `cluster` to fork workers.

### Frontend patterns
- Routes are **lazy-loaded** (`React.lazy` + `Suspense`) in `App.tsx`. Add new screens to
  `src/pages/` and wire them into the correct role portal's `<Route>` subtree.
- Path alias **`@`** maps to the repo root (`vite.config.ts` + `tsconfig.json`), so
  `@/src/...` resolves from root. Most intra-`src` imports use relative paths.
- Styling is **Tailwind v4** utility classes (no separate config file; tokens/`@theme` live
  in `src/index.css`). The palette centers on `forest-*` (brand green) and `zinc-*` on a
  near-black background. Match the existing dense, uppercase-label, rounded-`xl` aesthetic.
- Offline-first: `syncService` queues Firestore mutations when offline; `vite-plugin-pwa`
  workbox caches `/api/crm`, `/api/knowledge`, `/api/workflows` responses.

### `@ts-nocheck` convention (read this)
- The vast majority of files (`server.ts`, `App.tsx`, most of `src/`) start with
  `// @ts-nocheck`. This is intentional — the codebase ships with type-checking suppressed
  at the file level even though `tsconfig.json` has `strict: true`.
- When editing an existing `@ts-nocheck` file, **leave the directive in place**; don't try
  to make the whole file type-clean as a side quest. New shared types belong in
  `src/types.ts`. `npm run lint` (`tsc --noEmit`) will still pass because of the directives.

## Testing

- Framework: **Vitest** (`vitest.config.ts`, jsdom env, globals on, `src/setupTests.ts`).
  Run with `npm run test`. Existing examples: `src/App.test.tsx`,
  `src/lib/securityUtils.test.ts`.
- `TEST_MATRIX.md` documents required manual/edge-case fuzzing (Unicode, XSS, overflow,
  injection) for inputs and API endpoints.
- `security_spec.md` defines data invariants and the "Dirty Dozen" Firestore abuse cases
  that `firestore.rules` must reject (e.g. cross-tenant settings writes, shadow-field
  injection, timestamp spoofing). When changing `firestore.rules`, check against this spec.

## Environment variables

Set in `.env` / `.env.local` (gitignored; `.env.example` is allowed). Key ones:

- `GEMINI_API_KEY` — Gemini API key. **Unset → server runs in mock mode** (fine for dev/tests).
- `GOOGLE_MAPS_PLATFORM_KEY` — Maps JS API (route optimizer, customer/job maps).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe Connect/checkout + webhook verification.
- `TELEMETRY_EXPORT_KEY` — guards `/api/analytics/telemetry-export`.
- Twilio credentials — SMS/outbound (`twilio` SDK).
- `NODE_ENV=production` — enables cluster mode and static serving from `dist/`.
- `DISABLE_HMR=true` — disables Vite HMR/file watching (used in constrained envs).

## Deployment

`Dockerfile` is a multi-stage build (deps → vite build → slim runtime with system Chromium
for Puppeteer, non-root `appuser`, port 3000). `cloudbuild.yaml` builds the image, pushes to
GCR, and deploys to **Cloud Run** (`us-central1`, 2 CPU, 1Gi, min 1 instance, concurrency 80).
The container runs `npm run start` → `node dist/server.cjs`.

## Standing backlog — `TODO.md`

`TODO.md` (repo root) is the **living to-do list of record** for this project: the phased
roadmap for getting the app running in production (Cloud Run + Firebase + Gemini) and building
the flagship **Live Ear** "design vision" feature. **Before starting substantial work, read it**
to see what's outstanding and what's in flight. As you work: check off items you complete, add
newly-discovered tasks under the right phase, keep its file/line references accurate, and bump
its `_Last updated_` line. Don't start a parallel/competing list — this is the one.

## Working agreements for AI assistants

- **Consult and maintain `TODO.md`** (the standing backlog, see above) when doing feature or
  production-readiness work.
- **Branch:** develop on the branch you were assigned (e.g. `claude/...`); create it locally
  if missing. Commit with clear messages. Do **not** push to `main` or open a PR unless
  explicitly asked.
- Keep changes scoped to `src/`, `server.ts`, and real config files. Never resurrect or
  extend the root scratch scripts/dumps listed under "Ignore these".
- Preserve the established conventions above: `@ts-nocheck` headers, the authed `fetchApi`
  path for API calls, role-portal routing, the Stripe-webhook-before-json ordering, mock-mode
  AI behavior, and the multi-brand naming reality.
- Before claiming success, run `npm run lint` and `npm run test`. Report failures honestly
  with output rather than asserting green.
