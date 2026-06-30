-- Capture three tables that were applied live during the feature sprints but never
-- committed as migrations (referrals, equipment, compliance_logs). Without this file a
-- rebuild from supabase/migrations/ would be missing them entirely (and any recreated
-- copy would lack RLS = world-open). Idempotent: a no-op against the current live DB.
-- Schema mirrors the live columns; RLS mirrors the standard tenant-scoped pattern (0003).

-- ---------------------------------------------------------------------------
-- referrals — advocacy / referral engine
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  referrer_customer_id  uuid,
  referred_name         text,
  referred_email        text,
  referred_phone        text,
  status                text default 'invited',
  share_code            text,
  reward_type           text,
  reward_value          numeric,
  reward_status         text default 'pending',
  converted_invoice_id  uuid,
  notes                 text,
  data                  jsonb default '{}'::jsonb,
  created_at            timestamptz default now()
);
create index if not exists referrals_tenant_idx on public.referrals(tenant_id);

-- ---------------------------------------------------------------------------
-- equipment — fleet / asset maintenance tracker
-- ---------------------------------------------------------------------------
create table if not exists public.equipment (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  name                    text not null,
  type                    text,
  make                    text,
  model                   text,
  year                    integer,
  identifier              text,
  status                  text default 'active',
  meter_type              text default 'hours',
  hours_meter             numeric,
  mileage                 numeric,
  service_interval_hours  numeric,
  service_interval_miles  numeric,
  last_service_date       date,
  last_service_hours      numeric,
  last_service_mileage    numeric,
  assigned_crew           text,
  purchase_date           date,
  purchase_cost           numeric,
  notes                   text,
  data                    jsonb default '{}'::jsonb,
  created_at              timestamptz default now()
);
create index if not exists equipment_tenant_idx on public.equipment(tenant_id);

-- ---------------------------------------------------------------------------
-- compliance_logs — pesticide / chemical application records
-- ---------------------------------------------------------------------------
create table if not exists public.compliance_logs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  customer_id       uuid,
  job_id            uuid,
  type              text default 'pesticide',
  product_name      text,
  epa_reg_number    text,
  applicator        text,
  application_date  timestamptz,
  target            text,
  rate              text,
  area              text,
  weather           text,
  notes             text,
  data              jsonb default '{}'::jsonb,
  created_at        timestamptz default now()
);
create index if not exists compliance_logs_tenant_idx on public.compliance_logs(tenant_id);

-- ---------------------------------------------------------------------------
-- RLS — tenant-scoped read; write requires same tenant and a non-client role
-- (mirrors the standard tenant tables in 0003_rls_helpers_private_schema.sql)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['referrals','equipment','compliance_logs'] loop
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
