-- YardWorx — Row-Level Security (replaces firestore.rules)
-- Tenant isolation keyed on the caller's profile row. Mirrors firestore.rules:
--   getTenantId()  -> public.auth_tenant_id()
--   getRole()      -> public.auth_role()
--   SaaS admin     -> profiles.is_platform_admin (replaces the hardcoded owner email)
-- The Express server uses the service-role key, which bypasses RLS for privileged ops
-- (provisioning, Stripe webhook). All end-user access goes through these policies.

-- ---------------------------------------------------------------------------
-- Helpers (STABLE + SECURITY DEFINER so they read profiles regardless of RLS,
-- and are evaluated once per statement for RLS performance)
-- ---------------------------------------------------------------------------

create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = (select auth.uid())
$$;

create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = (select auth.uid())), false)
$$;

-- ---------------------------------------------------------------------------
-- Standard tenant-scoped tables: read = same tenant; write = same tenant & not a client
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tenant_tables text[] := array[
    'customers','customer_messages','jobs','invoices','expenses','inventory','material_logs',
    'reviews','crews','leads','vendors','knowledge','design_catalog','customer_design_visions',
    'contracts','employees','broadcasts','inspection_forms'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %1$I_read  on public.%1$I', t);
    execute format('drop policy if exists %1$I_write on public.%1$I', t);
    execute format(
      'create policy %1$I_read on public.%1$I for select using '
      '(public.is_platform_admin() or tenant_id = public.auth_tenant_id())', t);
    execute format(
      'create policy %1$I_write on public.%1$I for all '
      'using (public.is_platform_admin() or (tenant_id = public.auth_tenant_id() and public.auth_role() <> ''client'')) '
      'with check (public.is_platform_admin() or (tenant_id = public.auth_tenant_id() and public.auth_role() <> ''client''))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles — self + same-tenant read; self-provision; self/admin update
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;

create policy profiles_read on public.profiles for select using (
  public.is_platform_admin()
  or id = (select auth.uid())
  or tenant_id = public.auth_tenant_id()
);
create policy profiles_insert on public.profiles for insert with check (
  public.is_platform_admin() or id = (select auth.uid())
);
create policy profiles_update on public.profiles for update using (
  public.is_platform_admin()
  or id = (select auth.uid())
  or (tenant_id = public.auth_tenant_id() and public.auth_role() in ('admin','owner'))
);
-- NOTE: prevent self role/tenant escalation with a BEFORE UPDATE trigger (follow-up);
-- for now non-platform updates are constrained to same-tenant admins + self.

-- ---------------------------------------------------------------------------
-- tenants — members read their tenant; admins update settings; provisioning via service role
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
drop policy if exists tenants_read   on public.tenants;
drop policy if exists tenants_update on public.tenants;

create policy tenants_read on public.tenants for select using (
  public.is_platform_admin() or id = public.auth_tenant_id()
);
create policy tenants_update on public.tenants for update using (
  public.is_platform_admin()
  or (id = public.auth_tenant_id() and public.auth_role() in ('admin','owner'))
);

-- ---------------------------------------------------------------------------
-- business_settings — own row or tenant admin
-- ---------------------------------------------------------------------------
alter table public.business_settings enable row level security;
drop policy if exists business_settings_rw on public.business_settings;
create policy business_settings_rw on public.business_settings for all
using (
  public.is_platform_admin()
  or user_id = (select auth.uid())
  or (tenant_id = public.auth_tenant_id() and public.auth_role() in ('admin','owner'))
)
with check (
  public.is_platform_admin()
  or user_id = (select auth.uid())
  or (tenant_id = public.auth_tenant_id() and public.auth_role() in ('admin','owner'))
);

-- ---------------------------------------------------------------------------
-- Immutable audit trails — tenant members append + read; no update/delete (platform admin only)
-- ---------------------------------------------------------------------------
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
      '(public.is_platform_admin() or tenant_id = public.auth_tenant_id())', t);
    execute format(
      'create policy %1$I_insert on public.%1$I for insert with check '
      '(public.is_platform_admin() or tenant_id = public.auth_tenant_id())', t);
    -- update/delete: platform admin only (immutability)
    execute format(
      'create policy %1$I_admin on public.%1$I for all to authenticated '
      'using (public.is_platform_admin()) with check (public.is_platform_admin())', t);
  end loop;
end $$;
