-- YardWorx — usage-metered billing ledger (base + per-seat + metered overage).
-- Backs PRICING_STRATEGY.md and server.ts gateUsage()/writeUsage()/GET /api/usage/summary:
-- every metered resource (ai, sms, live_min, aerial, pdf) is recorded as an append-only
-- `usage_events` row and rolled up per (tenant, period, meter) into `tenant_usage`. The pure
-- overage/spend-cap math lives in src/lib/usageLedger.ts; this migration is storage + RLS only.
--
-- Back-compat: the legacy AI-credit columns from 0007 (tenants.ai_credits_used /
-- ai_credits_period) are LEFT INTACT and kept in sync by writeUsage() for the `ai` meter, so the
-- existing meterCredits() accounting + GET /api/usage/credits keep working unchanged.
--
-- Isolation: reads are tenant-scoped via private.auth_tenant_id() (same helper as 0003/0006);
-- writes are service-role ONLY (no write policy → every non-service-role role is denied, and the
-- server's service-role key bypasses RLS to meter). Idempotent + additive; safe to re-run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- tenants.spend_cap_cents — hard per-tenant bill-shock ceiling (integer cents).
-- NULL = no cap (unlimited); withinSpendCap() treats null as "always allowed". A metered op
-- that would push billable overage past this cap returns 402 SPEND_CAP_EXCEEDED.
-- ---------------------------------------------------------------------------
alter table public.tenants add column if not exists spend_cap_cents integer;

-- Seats billed on the platform subscription + the platform-subscription Stripe customer id
-- (backfilled by the subscription webhook). The reporter needs the customer id to post metered
-- usage as Stripe meter events; `seats` mirrors the per-seat line-item quantity for projections.
alter table public.tenants add column if not exists seats integer;
alter table public.tenants add column if not exists stripe_customer_id text;

-- ---------------------------------------------------------------------------
-- usage_events — append-only ledger. One row per metered unit-batch. `quantity` is in the
-- meter's native unit (ai=credits, sms=segments, live_min=minutes (fractional ok), aerial=
-- lookups, pdf=renders). `unit_cost_cents` snapshots the retail overage rate at write time so
-- the ledger is self-describing for audit + Stripe meter-event reporting even if rates retune.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  period         text not null,                    -- YYYY-MM the event is billed to
  meter          text not null,                    -- one of ai|sms|live_min|aerial|pdf
  quantity       numeric not null default 0,
  unit_cost_cents integer not null default 0,
  created_at     timestamptz not null default now()
);
alter table public.usage_events add column if not exists period text;
alter table public.usage_events add column if not exists meter text;
alter table public.usage_events add column if not exists quantity numeric not null default 0;
alter table public.usage_events add column if not exists unit_cost_cents integer not null default 0;
alter table public.usage_events add column if not exists created_at timestamptz not null default now();
create index if not exists usage_events_tenant_period_idx on public.usage_events(tenant_id, period);
create index if not exists usage_events_tenant_meter_idx  on public.usage_events(tenant_id, period, meter);

-- ---------------------------------------------------------------------------
-- tenant_usage — per (tenant, period, meter) running rollup. Fast source for the usage bars +
-- projected-bill computation and the nightly Stripe meter-event reporter. Derived from
-- usage_events; maintained by writeUsage() (best-effort read-modify-write, same tolerance as
-- the legacy meterCredits() counter — an atomic increment RPC / event-SUM reconciler is a
-- documented follow-up).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_usage (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  period     text not null,                        -- YYYY-MM
  meter      text not null,                        -- one of ai|sms|live_min|aerial|pdf
  quantity   numeric not null default 0,           -- units consumed this period
  updated_at timestamptz not null default now(),
  primary key (tenant_id, period, meter)
);
alter table public.tenant_usage add column if not exists quantity numeric not null default 0;
alter table public.tenant_usage add column if not exists updated_at timestamptz not null default now();
create index if not exists tenant_usage_tenant_idx on public.tenant_usage(tenant_id, period);

-- ---------------------------------------------------------------------------
-- RLS — tenant members may READ their own usage (powers the AiUsage dashboard); NO write
-- policy, so only the service-role key (bypasses RLS) can meter. Mirrors the isolation model in
-- 0003/0006 for reads and the service-role-only posture in 0016 for writes.
-- (rls_auto_enable already turns RLS on for new tables; we enable it explicitly for idempotency.)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['usage_events','tenant_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %1$I_read on public.%1$I', t);
    execute format(
      'create policy %1$I_read on public.%1$I for select using '
      '(private.is_platform_admin() or tenant_id = private.auth_tenant_id())', t);
    -- Intentionally NO insert/update/delete policy: writes are service-role only.
  end loop;
end $$;
