-- Durable Stripe webhook idempotency ledger (double-billing guard).
-- The webhook previously deduped redeliveries with an in-memory Set only. Under the 2-worker
-- production cluster (and Cloud Run autoscale) a redelivered `checkout.session.completed` can
-- land on a DIFFERENT worker/instance whose Set is empty, so the payment could be applied
-- twice -> invoice double-credit. The webhook now CLAIMS each Stripe event id here BEFORE
-- applying any payment: `insert into stripe_events(id) ... on conflict do nothing`. A 0-row
-- result means the id is already present (already processed elsewhere) -> ack 200 and skip.
--
-- Service-role ONLY: RLS is enabled with NO policies, so no anon/authenticated caller can read
-- or write it; only the server's service-role key (which bypasses RLS) ever touches this table.
-- Idempotent + additive; safe to re-run.

create table if not exists public.stripe_events (
  id           text primary key,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- Intentionally NO policies: with RLS on and no policy, every non-service-role role is denied.
