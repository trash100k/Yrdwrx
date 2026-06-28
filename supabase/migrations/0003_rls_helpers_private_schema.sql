-- Move RLS helpers into a non-PostgREST-exposed `private` schema so they can't be
-- called via /rest/v1/rpc, while RLS policies can still invoke them. Clears the
-- "Public/Signed-in can execute SECURITY DEFINER function" advisories on the helpers.
create schema if not exists private;
grant usage on schema private to authenticated, anon, service_role;

create or replace function private.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where firebase_uid = (auth.jwt() ->> 'sub')
$$;
create or replace function private.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where firebase_uid = (auth.jwt() ->> 'sub')
$$;
create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where firebase_uid = (auth.jwt() ->> 'sub')), false)
$$;
grant execute on function private.auth_tenant_id(), private.auth_role(), private.is_platform_admin()
  to authenticated, anon, service_role;

-- Recreate every policy to reference private.* helpers.
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

drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read on public.profiles for select using (
  private.is_platform_admin() or firebase_uid = (auth.jwt() ->> 'sub') or tenant_id = private.auth_tenant_id()
);
create policy profiles_insert on public.profiles for insert with check (
  private.is_platform_admin() or firebase_uid = (auth.jwt() ->> 'sub')
);
create policy profiles_update on public.profiles for update using (
  private.is_platform_admin() or firebase_uid = (auth.jwt() ->> 'sub')
  or (tenant_id = private.auth_tenant_id() and private.auth_role() in ('admin','owner'))
);

drop policy if exists tenants_read   on public.tenants;
drop policy if exists tenants_update on public.tenants;
create policy tenants_read on public.tenants for select using (
  private.is_platform_admin() or id = private.auth_tenant_id()
);
create policy tenants_update on public.tenants for update using (
  private.is_platform_admin() or (id = private.auth_tenant_id() and private.auth_role() in ('admin','owner'))
);

drop policy if exists business_settings_rw on public.business_settings;
create policy business_settings_rw on public.business_settings for all
using (
  private.is_platform_admin() or firebase_uid = (auth.jwt() ->> 'sub')
  or (tenant_id = private.auth_tenant_id() and private.auth_role() in ('admin','owner'))
)
with check (
  private.is_platform_admin() or firebase_uid = (auth.jwt() ->> 'sub')
  or (tenant_id = private.auth_tenant_id() and private.auth_role() in ('admin','owner'))
);

do $$
declare t text;
begin
  foreach t in array array['audit_logs','system_logs'] loop
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

-- Remove the public (PostgREST-exposed) helpers now that nothing references them.
drop function if exists public.auth_tenant_id();
drop function if exists public.auth_role();
drop function if exists public.is_platform_admin();
