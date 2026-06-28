-- YardWorx — Supporting tenant-scoped tables the app reads/writes but the schema
-- under-specified: material_logs, messages (client portal), audit_logs, system_logs,
-- telemetry. Source of truth for fields: the live Firestore collections the frontend
-- still writes (src/pages/Inventory.tsx -> "materialLogs"; src/pages/ClientPortal.tsx ->
-- customers/{id}/messages; src/hooks/useAuditLog.ts -> "audit_logs";
-- src/lib/firebase.ts logSystemEvent -> "systemLogs"; src/pages/AiPlayground.tsx -> "telemetry").
--
-- NOTE: material_logs, audit_logs and system_logs already exist (0001/0002/0003). This
-- migration is additive + idempotent: `create table if not exists` is a no-op on the live
-- tables, and `add column if not exists` backfills the domain columns those tables lack so
-- the schema matches actual app usage. messages + telemetry are net-new. RLS + tenant
-- policies are (re)applied for all five using the private.* helpers, matching 0003/0005.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- material_logs — inventory stock-in/out ledger (already exists in 0001; backfill columns)
-- ---------------------------------------------------------------------------
create table if not exists public.material_logs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  inventory_item_id uuid references public.inventory(id) on delete set null,
  quantity          numeric,
  job_id            uuid references public.jobs(id) on delete set null,
  note              text,
  created_at        timestamptz not null default now()
);
alter table public.material_logs add column if not exists inventory_item_id uuid references public.inventory(id) on delete set null;
alter table public.material_logs add column if not exists quantity numeric;
alter table public.material_logs add column if not exists job_id uuid references public.jobs(id) on delete set null;
alter table public.material_logs add column if not exists note text;
alter table public.material_logs add column if not exists created_at timestamptz not null default now();
create index if not exists material_logs_tenant_idx on public.material_logs(tenant_id);

-- ---------------------------------------------------------------------------
-- messages — client portal threads (was Firestore subcollection customers/{id}/messages)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sender      text,
  body        text,
  created_at  timestamptz not null default now()
);
create index if not exists messages_tenant_idx   on public.messages(tenant_id);
create index if not exists messages_customer_idx on public.messages(customer_id);

-- ---------------------------------------------------------------------------
-- audit_logs — immutable user-action trail (already exists in 0001; backfill columns)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  actor      text,
  action     text,
  target     text,
  meta       jsonb not null default '{}'::jsonb,
  ts         timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.audit_logs add column if not exists actor text;
alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists target text;
alter table public.audit_logs add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.audit_logs add column if not exists ts timestamptz not null default now();
create index if not exists audit_logs_tenant_idx on public.audit_logs(tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- system_logs — immutable platform event trail (already exists in 0001; backfill columns)
-- ---------------------------------------------------------------------------
create table if not exists public.system_logs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id) on delete cascade,
  level      text,
  message    text,
  meta       jsonb not null default '{}'::jsonb,
  ts         timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.system_logs add column if not exists level text;
alter table public.system_logs add column if not exists message text;
alter table public.system_logs add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.system_logs add column if not exists ts timestamptz not null default now();
create index if not exists system_logs_tenant_idx on public.system_logs(tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- telemetry — anonymizable product/usage events (was Firestore "telemetry")
-- ---------------------------------------------------------------------------
create table if not exists public.telemetry (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  event      text,
  props      jsonb not null default '{}'::jsonb,
  uid        text,  -- Firebase UID of the acting user
  ts         timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists telemetry_tenant_idx on public.telemetry(tenant_id);

-- ---------------------------------------------------------------------------
-- RLS — same tenant-isolation pattern as the existing tables (private.* helpers).
-- material_logs + messages + telemetry: standard read (same tenant) / write (same tenant,
-- not a client). audit_logs + system_logs: append + read for tenant members, update/delete
-- platform-admin only (immutability), mirroring 0002/0003.
-- (The rls_auto_enable event trigger already turns RLS on for new tables; we enable it
-- explicitly anyway so this migration is self-contained and idempotent.)
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['material_logs','messages','telemetry'] loop
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
  foreach t in array array['audit_logs','system_logs'] loop
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
