-- YardWorx — Supabase Postgres schema (migrated from Firestore)
-- Foundation migration: tables + indexes. RLS lives in 0002_rls.sql.
-- Source of truth for fields: firebase-blueprint.json, src/types.ts, src/lib/seedDatabase.ts,
-- firestore.rules. Flexible/legacy bags are kept in `data jsonb` so the incremental cutover
-- never loses a Firestore field; typed columns cover the hot query/filter paths.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenancy & identity
-- ---------------------------------------------------------------------------

create table if not exists public.tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  tier              text not null default 'free' check (tier in ('free','pro','enterprise')),
  stripe_account_id text,
  legal             jsonb not null default '{}'::jsonb,
  quotas            jsonb not null default '{}'::jsonb,
  settings          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One row per Firebase user. Replaces the Firestore /users/{uid} doc; carries the
-- tenant_id + role that RLS keys on (mirrors firestore.rules getTenantId()/getRole()).
-- HYBRID AUTH: identity stays in Firebase Auth. Supabase trusts Firebase JWTs via
-- Third-Party Auth, so the PK is the Firebase UID (the JWT `sub` claim) — there is no
-- Supabase auth.users table to reference.
create table if not exists public.profiles (
  firebase_uid        text primary key,
  tenant_id           uuid references public.tenants(id) on delete set null,
  role                text not null default 'employee'
                        check (role in ('admin','owner','employee','client','foreman')),
  email               text,
  display_name        text,
  agreements_accepted boolean not null default false,
  is_platform_admin   boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists profiles_tenant_idx on public.profiles(tenant_id);

-- Per-user business settings (Firestore /settings/{userId}).
create table if not exists public.business_settings (
  firebase_uid       text primary key,
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  company_name       text,
  onboarding_complete boolean not null default false,
  data               jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);
create index if not exists business_settings_tenant_idx on public.business_settings(tenant_id);

-- ---------------------------------------------------------------------------
-- Core business tables (all tenant-scoped)
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  first_name         text,
  last_name          text,
  company_name       text,
  email              text,
  phone              text,
  address            text,
  property_size      text,
  status             text,
  segment            text,
  tags               text[] not null default '{}',
  notes              text,
  is_hoa             boolean not null default false,
  priority           boolean not null default false,
  ai_score           numeric,
  ai_score_label     text,
  ai_score_reasoning text,
  stripe_customer_id text,
  custom_fields      jsonb not null default '{}'::jsonb,
  data               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists customers_tenant_idx on public.customers(tenant_id);
create index if not exists customers_phone_idx  on public.customers(tenant_id, phone);

create table if not exists public.customer_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  sender      text,
  text        text,
  created_at  timestamptz not null default now()
);
create index if not exists customer_messages_customer_idx on public.customer_messages(customer_id);
create index if not exists customer_messages_tenant_idx   on public.customer_messages(tenant_id);

create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title       text,
  status      text not null default 'PENDING',
  date        timestamptz,
  address     text,
  assigned_to text,
  revenue     numeric,
  progress    numeric,
  lat         double precision,
  lng         double precision,
  notes       text,
  checklist   jsonb not null default '[]'::jsonb,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists jobs_tenant_idx        on public.jobs(tenant_id);
create index if not exists jobs_tenant_status_idx on public.jobs(tenant_id, status);
create index if not exists jobs_customer_idx      on public.jobs(customer_id);

create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  amount      numeric not null default 0,
  status      text not null default 'DRAFT',
  date        timestamptz,
  due_date    timestamptz,
  items       jsonb not null default '[]'::jsonb,
  is_archived boolean not null default false,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invoices_tenant_idx        on public.invoices(tenant_id);
create index if not exists invoices_tenant_status_idx on public.invoices(tenant_id, status);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  amount      numeric,
  merchant    text,
  category    text,
  date        timestamptz,
  is_archived boolean not null default false,
  deleted_at  timestamptz,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_tenant_idx on public.expenses(tenant_id);

create table if not exists public.inventory (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  sku           text,
  category      text,
  status        text,
  location      text,
  image_url     text,
  vendor        text,
  brand         text,
  barcode       text,
  part_number   text,
  stock         numeric,
  quantity      numeric,
  unit          text,
  unit_price    numeric,
  unit_cost     numeric,
  min_threshold numeric,
  is_archived   boolean not null default false,
  last_scanned_at timestamptz,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists inventory_tenant_idx on public.inventory(tenant_id);

create table if not exists public.material_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  item_id     uuid references public.inventory(id) on delete set null,
  item_name   text,
  job_id      uuid references public.jobs(id) on delete set null,
  client_name text,
  quantity    numeric,
  unit        text,
  type        text,
  created_at  timestamptz not null default now()
);
create index if not exists material_logs_tenant_idx on public.material_logs(tenant_id);

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  rating      numeric,
  content     text,
  text        text,
  sentiment   text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_tenant_idx on public.reviews(tenant_id);

create table if not exists public.crews (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text,
  status     text,
  leader     text,
  equip      text,
  phone      text,
  job        text,
  progress   numeric,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crews_tenant_idx on public.crews(tenant_id);

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text,
  address      text,
  prop_size    text,
  match_reason text,
  score        numeric,
  notes        text,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists leads_tenant_idx on public.leads(tenant_id);

create table if not exists public.vendors (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text,
  category      text,
  status        text,
  contact       text,
  next_delivery text,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists vendors_tenant_idx on public.vendors(tenant_id);

create table if not exists public.knowledge (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  topic      text,
  content    text,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists knowledge_tenant_idx on public.knowledge(tenant_id);

create table if not exists public.design_catalog (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  type        text,
  name        text,
  title       text,
  description text,
  roi         text,
  tags        text[] not null default '{}',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists design_catalog_tenant_idx on public.design_catalog(tenant_id);

create table if not exists public.customer_design_visions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  summary     text,
  proposal    jsonb not null default '{}'::jsonb,
  before_url  text,
  after_url   text,
  created_at  timestamptz not null default now()
);
create index if not exists customer_design_visions_tenant_idx on public.customer_design_visions(tenant_id);

create table if not exists public.contracts (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  name       text,
  status     text,
  mrr        numeric,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contracts_tenant_idx on public.contracts(tenant_id);

create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text,
  role        text,
  status      text,
  performance numeric,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists employees_tenant_idx on public.employees(tenant_id);

create table if not exists public.broadcasts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  message      text,
  neighborhood text,
  created_at   timestamptz not null default now()
);
create index if not exists broadcasts_tenant_idx on public.broadcasts(tenant_id);

-- Inspection forms (was Firestore subcollection tenants/{id}/inspection_forms).
create table if not exists public.inspection_forms (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text,
  status     text,
  fields     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inspection_forms_tenant_idx on public.inspection_forms(tenant_id);

-- ---------------------------------------------------------------------------
-- Immutable audit trails
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  event      text not null,
  user_id    text,  -- Firebase UID of the acting user
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_tenant_idx on public.audit_logs(tenant_id, created_at desc);

create table if not exists public.system_logs (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id) on delete cascade,
  event      text not null,
  user_id    text,  -- Firebase UID of the acting user
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists system_logs_tenant_idx on public.system_logs(tenant_id, created_at desc);
