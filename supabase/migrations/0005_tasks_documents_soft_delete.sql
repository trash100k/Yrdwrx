-- Phase A of the CRM build-out: customer soft-delete + tasks/documents tables.

-- Soft-delete on customers
alter table public.customers add column if not exists is_archived boolean not null default false;
alter table public.customers add column if not exists deleted_at timestamptz;
create index if not exists customers_active_idx on public.customers(tenant_id) where is_archived = false;

-- Tasks (CRM tasks had no persistence)
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  title        text not null,
  notes        text,
  status       text not null default 'pending' check (status in ('pending','in_progress','completed')),
  priority     text not null default 'medium' check (priority in ('low','medium','high')),
  due_date     timestamptz,
  assigned_to  text,
  completed_at timestamptz,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tasks_tenant_idx        on public.tasks(tenant_id);
create index if not exists tasks_tenant_status_idx on public.tasks(tenant_id, status);
create index if not exists tasks_customer_idx      on public.tasks(customer_id);

-- Documents (metadata; files live in Firebase Storage / GCS)
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  name         text not null,
  folder       text,
  mime         text,
  size_bytes   bigint,
  storage_path text,
  url          text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists documents_tenant_idx   on public.documents(tenant_id);
create index if not exists documents_customer_idx on public.documents(customer_id);

-- RLS for the two new tables (rls_auto_enable event trigger already enabled RLS;
-- add the standard tenant read/write policies using the private.* helpers).
do $$
declare t text;
begin
  foreach t in array array['tasks','documents'] loop
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
