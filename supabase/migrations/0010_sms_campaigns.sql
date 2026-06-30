-- YardWorx — Text (SMS) Campaign feature: consent, delivery tracking, campaigns.
--
-- Backs the Text Campaign feature (see TEXT_CAMPAIGN_RESEARCH.md). Adds the TCPA/CTIA
-- compliance scaffolding the SMS surface was missing and the per-campaign send/delivery
-- tracking the composer + results dashboard read.
--
-- Additive + idempotent, matching 0005/0006: `add column if not exists` backfills the
-- customers + customer_messages domain columns; `create table if not exists` is a no-op if
-- re-run. RLS uses the same private.* helpers as the existing tables (0003).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- customers (+): SMS consent state. sms_consent gates who may be texted —
--   none | transactional | marketing. opt-out timestamp suppresses globally.
-- ---------------------------------------------------------------------------
alter table public.customers add column if not exists sms_consent        text not null default 'none';
alter table public.customers add column if not exists sms_consent_at     timestamptz;
alter table public.customers add column if not exists sms_consent_source text;
alter table public.customers add column if not exists sms_opt_out_at      timestamptz;

-- ---------------------------------------------------------------------------
-- customer_messages (+): stop commingling untyped rows. Track channel, direction,
--   per-campaign linkage, and Twilio delivery state so the thread + results dashboard
--   can show honest sent/delivered/failed status (and not fake "Sent!").
-- ---------------------------------------------------------------------------
alter table public.customer_messages add column if not exists channel     text not null default 'sms';
alter table public.customer_messages add column if not exists direction   text not null default 'outbound';
alter table public.customer_messages add column if not exists campaign_id  uuid;
alter table public.customer_messages add column if not exists status       text;       -- queued|sent|delivered|failed|undelivered|simulated|blocked
alter table public.customer_messages add column if not exists twilio_sid   text;
alter table public.customer_messages add column if not exists error_code   text;
create index if not exists customer_messages_campaign_idx on public.customer_messages(campaign_id);
create index if not exists customer_messages_sid_idx      on public.customer_messages(twilio_sid);

-- ---------------------------------------------------------------------------
-- sms_campaigns — a saved/sent bulk text campaign + its rollup counters.
-- ---------------------------------------------------------------------------
create table if not exists public.sms_campaigns (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  name             text,
  target_service   text,
  segment          text,                      -- priority|lapsed|all|custom
  body_template    text,
  status           text not null default 'draft', -- draft|scheduled|sending|sent|failed
  scheduled_for    timestamptz,
  total_recipients integer not null default 0,
  sent_count       integer not null default 0,
  failed_count     integer not null default 0,
  skipped_count    integer not null default 0,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists sms_campaigns_tenant_idx on public.sms_campaigns(tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- sms_consent_log — append-only consent/opt-out audit trail (TCPA defense).
-- ---------------------------------------------------------------------------
create table if not exists public.sms_consent_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  event       text,        -- opt_in | opt_out | help | start
  channel     text,        -- inbound_sms | crm | booking | portal | import
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists sms_consent_log_tenant_idx   on public.sms_consent_log(tenant_id, created_at desc);
create index if not exists sms_consent_log_customer_idx on public.sms_consent_log(customer_id);

-- ---------------------------------------------------------------------------
-- RLS — same tenant-isolation pattern as the existing tables (private.* helpers).
-- sms_campaigns: standard read/write (same tenant, not a client).
-- sms_consent_log: append + read for tenant members; immutable (no update/delete except
--   platform admin), mirroring audit_logs in 0006.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sms_campaigns'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %1$I_read  on public.%1$I', t);
    execute format('drop policy if exists %1$I_write on public.%1$I', t);
    execute format(
      'create policy %1$I_read on public.%1$I for select using '
      '(private.is_platform_admin() or tenant_id = private.auth_tenant_id())', t);
    execute format(
      'create policy %1$I_write on public.%1$I for all '
      'using (private.is_platform_admin() or (tenant_id = private.auth_tenant_id() and private.auth_role() <> ''client'')) '
      'with check (private.is_platform_admin() or (tenant_id = private.auth_tenant_id() and private.auth_role() <> ''client''))', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['sms_consent_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %1$I_read   on public.%1$I', t);
    execute format('drop policy if exists %1$I_insert on public.%1$I', t);
    execute format('drop policy if exists %1$I_admin  on public.%1$I', t);
    execute format(
      'create policy %1$I_read on public.%1$I for select using '
      '(private.is_platform_admin() or tenant_id = private.auth_tenant_id())', t);
    execute format(
      'create policy %1$I_insert on public.%1$I for insert with check '
      '(private.is_platform_admin() or tenant_id = private.auth_tenant_id())', t);
    execute format(
      'create policy %1$I_admin on public.%1$I for all to authenticated '
      'using (private.is_platform_admin()) with check (private.is_platform_admin())', t);
  end loop;
end $$;
