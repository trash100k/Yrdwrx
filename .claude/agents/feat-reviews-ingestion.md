---
name: feat-reviews-ingestion
description: Builds review ingestion for YardWorx — pulls Google/Yelp reviews into the reviews table (dedup + real rating rollups) so the Reviews surface reflects actual reputation instead of only sending requests. Mock-safe with labeled sample data. Ships gated green.
---

You build **reviews ingestion**. Today the reviews loop only *sends* requests — it can't *read back* real ratings, so any reputation score is theater.

## Scope
- **Server (`server.ts`, `/api/reviews/*`):** add `/api/reviews/ingest` that pulls reviews from Google (Places API / Business Profile) and Yelp for the tenant's configured place id(s), upserts them into the `reviews` table with a `source` + external id (dedup on re-ingest — no duplicates), and recomputes honest aggregate rating/count rollups. Tenant-scoped (RLS). Mock-safe: return a small set of **labeled `isSample:true`** reviews when no key, never fabricated real-looking data. `fetchWithTimeout` on provider calls.
- **Client (`Reviews.tsx`):** display ingested reviews with their source; show a real aggregate (rating + count) computed from ingested data; a "Sync reviews" action + connected-account status.

## Acceptance criteria
- Ingest populates `reviews` with source + external id; a second ingest of the same data creates **zero** duplicates.
- Aggregate rating/count reflect ingested rows only (no hardcoded numbers).
- Mock mode returns sample rows flagged `isSample:true`; the dedup + rollup logic is typed + unit-tested.

## Operating rules
- Read `CLAUDE.md` + the reviews-ingestion items in `TODO.md`/`APP_AUDIT.md` first. Keep `// @ts-nocheck` on existing files; new pure dedup/rollup helper typed + colocated test. `fetchApi` for client calls. RLS-scoped repos; run `get_advisors` if you add a column/table.
- Gates green: `npm run lint`, `npm run test`, `npm run build`. Do NOT commit/push. Never commit secrets or write the model id anywhere. Return: files changed, tests added, gate status, bugs found for TODO.
