# YardWorx

**YardWorx** is a multi-tenant, AI-first field-service / landscaping operations SaaS — an
"operational cockpit" sold to landscaping companies. Each tenant gets CRM, scheduling, crew
tracking, inventory, invoicing, EPA/compliance logging, a customer portal, and an AI-driven
**Design Studio** (photo → grounded, priced good/better/best proposal) plus the flagship
**Live Ear** on-site voice assistant.

> The product has been rebranded several times; you'll see **YardWorx**, **TerraMind Ops OS**,
> **Cutty**, and **Meridian Green** in code and logs. They all mean this app. Current brand:
> **YardWorx**. (`package.json` still says `react-example`.)

## Architecture (hybrid)

A single repo, full-stack:

- **Frontend** — React 19 + Vite 8 single-page PWA (`src/`, `index.html`), Tailwind v4,
  React Router 7, lazy-loaded role-scoped portals.
- **Backend** — one large Express 5 server (`server.ts`) that serves the API, proxies
  **Gemini** (locally via API key; in production via **Vertex AI** on Cloud Run with ADC),
  renders PDFs with Puppeteer, exposes the WebSocket **Live** voice endpoint, and serves the
  built SPA in production.
- **Auth** — **Firebase Authentication** (Google Sign-In). The server verifies the Firebase
  ID token on every `/api/*` request.
- **Data** — **Supabase Postgres** is the production system of record, with **Row-Level
  Security** keyed on the Firebase UID (`auth.jwt()->>'sub'`) via Supabase Third-Party Auth.
  Access goes through the repo layer in `src/lib/repos/*`. Schema + RLS live in
  `supabase/migrations/`.
- **Hosting** — Google **Cloud Run** (`Dockerfile` → `cloudbuild.yaml`), port 3000.

> **Current state of the demo:** the working demo still runs on **Firebase Firestore** and
> ships with **client-side auth mocked** (a demo admin user; `useRole` returns `owner`). Real
> auth is being restored behind the `VITE_REQUIRE_AUTH` / `REQUIRE_AUTH` flags. The Supabase
> repos exist and are the target backend, but are **inert in the demo** (RLS token is null
> under mocked auth, and nothing provisions Supabase `tenants`/`profiles` rows yet). The
> Firestore → Supabase page cutover is in progress, not finished.

## Roles

`admin · owner · employee · client · foreman` (`src/types.ts`, `src/hooks/useRole.ts`).
`App.tsx` routes users into role-scoped portals: `/admin`, `/employee`, `/client`,
`/saas-admin`. Public routes: `/privacy`, `/terms`, `/data-map`, `/ai-usage`,
`/portal/:clientId`, `/portal/auth/:token`.

## Local development

**Prerequisites:** Node.js 20+.

```bash
npm install      # npm is canonical (per Dockerfile)
npm run dev      # vite + tsx server.ts, concurrently
```

The Express server mounts Vite as middleware and listens on **port 3000**, so the whole app
is at **http://localhost:3000**.

**Mock mode:** with **`GEMINI_API_KEY` unset**, the server returns canned AI responses, so the
app and tests run with no API key. Tests/lint:

```bash
npm run lint     # tsc --noEmit (this is the "lint"; there is no ESLint)
npm run test     # vitest run
```

## Environment variables

Copy `.env.example` → `.env.local` (gitignored) and fill in. That file documents every var;
the essentials: `VITE_FIREBASE_*` (client auth), `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
and server-side `SUPABASE_SERVICE_ROLE_KEY` (data), `GEMINI_API_KEY` (unset → mock mode),
`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`, Twilio + Maps keys, and the auth
flags `REQUIRE_AUTH` / `VITE_REQUIRE_AUTH`.

## Build & deploy

```bash
npm run build    # vite build (frontend → dist/) AND esbuild server.ts → dist/server.cjs
npm run start    # node dist/server.cjs  (production entrypoint)
```

`npm run build` produces **both** the frontend bundle and the server bundle
(`dist/server.cjs`) — keep that contract intact. The multi-stage `Dockerfile` builds the
frontend, bundles the server, and ships a slim runtime with system Chromium for Puppeteer
(non-root, port 3000). `cloudbuild.yaml` builds the image, pushes to GCR, and deploys to
**Cloud Run** (`us-central1`), where the container runs `npm run start`. With
`NODE_ENV=production` the server uses Node `cluster` to fork workers and serves the SPA from
`dist/`.

## Going live — first paying client (human-only steps)

The code is built to light up the moment these are flipped on; an autonomous agent **cannot**
do them. Each is roughly 1–2 minutes.

1. **Enable Supabase Third-Party Auth → Firebase.** In the Supabase dashboard for project
   `bzpxudpmksnawmaanxal`, add Firebase as a third-party auth provider, pointing at the
   Firebase project in `VITE_FIREBASE_PROJECT_ID`. This is what makes Firebase JWTs validate
   under RLS.
2. **Set all secrets in Cloud Run via Secret Manager.** `GEMINI_API_KEY` (or Vertex AI access),
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `TWILIO_*`, and `GOOGLE_MAPS_PLATFORM_KEY`.
3. **Enable Vertex AI for production Gemini.** Enable the Vertex AI API and grant the Cloud Run
   service account `roles/aiplatform.user` (production uses Vertex via ADC, not an API key).
4. **Flip auth on — both flags together.** Set `REQUIRE_AUTH=true` **and**
   `VITE_REQUIRE_AUTH=true` and redeploy. They must change together: the client only sends a
   token once real auth is on, and the server only enforces it when `REQUIRE_AUTH=true`.
5. **Provision the first tenant.** Create the tenant (and the owner's `profiles` row) so the
   signed-in user resolves to a real tenant + tier (via the provisioning endpoint /
   onboarding flow).
6. **Connect Stripe.** Complete Stripe Connect onboarding for the tenant and register the
   webhook endpoint with `STRIPE_WEBHOOK_SECRET`, so the contractor can take card/ACH payments.
7. **Enable Supabase PITR / backups.** Turn on point-in-time recovery (and a backup schedule)
   for the production project before real customer data lands.

See `TODO.md` for the full backlog, `AGENT_RUNBOOK.md` for the autonomous operating brief, and
`MARKET_RESEARCH.md` for product/GTM context.
