-- Multi-tenant isolation verification for the live Supabase project.
-- Every block runs inside a transaction that ROLLS BACK, so it creates no persistent data.
-- Run in the Supabase SQL editor (or via the MCP). Each query's result is annotated with
-- the expected value. These were run green against project bzpxudpmksnawmaanxal.
--
-- Background: identity is Firebase; Supabase trusts the Firebase JWT via Third-Party Auth.
-- RLS helpers live in the private schema and key on profiles.firebase_uid = auth.jwt()->>'sub'.

-- ============================================================================
-- 1. Config coverage — every public table must have RLS enabled with >=1 policy.
--    (Expect: zero rows. Any row returned is an unprotected table.)
-- ============================================================================
select c.relname as unprotected_table, c.relrowsecurity as rls_enabled,
       count(p.policyname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
having c.relrowsecurity = false or count(p.policyname) = 0;

-- ============================================================================
-- 2. Cross-tenant READ isolation — tenant A's owner must see only tenant A.
--    (Expect: tenants_visible=1, customers_visible=1, other_tenant_rows_leaked=0)
-- ============================================================================
begin;
  insert into public.tenants (id, name) values
    ('aaaaaaaa-0000-4000-8000-000000000001','ZZ_ISO_A'),
    ('bbbbbbbb-0000-4000-8000-000000000002','ZZ_ISO_B');
  insert into public.profiles (firebase_uid, tenant_id, role) values
    ('zz_iso_user_a','aaaaaaaa-0000-4000-8000-000000000001','owner'),
    ('zz_iso_user_b','bbbbbbbb-0000-4000-8000-000000000002','owner');
  insert into public.customers (tenant_id) values
    ('aaaaaaaa-0000-4000-8000-000000000001'),
    ('bbbbbbbb-0000-4000-8000-000000000002');
  select set_config('request.jwt.claims', '{"sub":"zz_iso_user_a"}', true);
  set local role authenticated;
  select
    private.auth_tenant_id()::text                            as resolved_tenant,
    (select count(*) from public.tenants)                     as tenants_visible,          -- 1
    (select count(*) from public.customers)                   as customers_visible,        -- 1
    (select count(*) from public.customers
       where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002') as other_tenant_rows_leaked; -- 0
rollback;

-- ============================================================================
-- 3. Unauthenticated scraping — the anon role must see nothing.
--    (Expect: all counts = 0)
-- ============================================================================
begin;
  insert into public.tenants (id, name) values ('cccccccc-0000-4000-8000-000000000003','ZZ_ANON');
  insert into public.customers (tenant_id) values ('cccccccc-0000-4000-8000-000000000003');
  insert into public.invoices  (tenant_id) values ('cccccccc-0000-4000-8000-000000000003');
  set local role anon;
  select
    (select count(*) from public.customers) as customers_visible_to_anon,  -- 0
    (select count(*) from public.invoices)  as invoices_visible_to_anon,   -- 0
    (select count(*) from public.tenants)   as tenants_visible_to_anon;    -- 0
rollback;

-- ============================================================================
-- 4. Cross-tenant WRITE denial — tenant A cannot insert into tenant B.
--    (Expect: cross_tenant_write_blocked = true)
-- ============================================================================
begin;
  insert into public.tenants (id, name) values
    ('aaaaaaaa-0000-4000-8000-000000000001','ZZ_W_A'),
    ('bbbbbbbb-0000-4000-8000-000000000002','ZZ_W_B');
  insert into public.profiles (firebase_uid, tenant_id, role) values
    ('zz_w_user_a','aaaaaaaa-0000-4000-8000-000000000001','owner');
  select set_config('request.jwt.claims', '{"sub":"zz_w_user_a"}', true);
  set local role authenticated;
  do $$
  begin
    insert into public.customers (tenant_id) values ('bbbbbbbb-0000-4000-8000-000000000002');
    raise exception 'FAIL: cross-tenant write was ALLOWED';
  exception
    when insufficient_privilege or check_violation then raise notice 'PASS: cross-tenant write blocked';
    when others then
      if sqlstate = '42501' then raise notice 'PASS: cross-tenant write blocked (RLS)';
      else raise; end if;
  end $$;
rollback;
