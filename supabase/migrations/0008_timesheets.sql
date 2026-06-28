-- Crew time-tracking (clock in/out → payroll). Backs src/components/TimeClock.tsx +
-- src/lib/timesheets.ts. Tenant-scoped with the same RLS pattern as the rest of the schema
-- (private.* helpers from 0003). Idempotent + additive.

create table if not exists public.timesheets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       text,            -- Firebase UID of the worker
  user_name     text,
  clock_in      timestamptz not null,
  clock_out     timestamptz,
  duration_mins numeric,
  job_id        uuid references public.jobs(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists timesheets_tenant_idx on public.timesheets(tenant_id);
create index if not exists timesheets_user_idx   on public.timesheets(tenant_id, user_id);

alter table public.timesheets enable row level security;
drop policy if exists timesheets_read  on public.timesheets;
drop policy if exists timesheets_write on public.timesheets;
create policy timesheets_read on public.timesheets for select using
  (private.is_platform_admin() or tenant_id = private.auth_tenant_id());
create policy timesheets_write on public.timesheets for all
  using (private.is_platform_admin() or (tenant_id = private.auth_tenant_id() and private.auth_role() <> 'client'))
  with check (private.is_platform_admin() or (tenant_id = private.auth_tenant_id() and private.auth_role() <> 'client'));
