-- SEC-1 (CRITICAL) remediation: block privilege escalation via public.profiles self-update.
--
-- The RLS policy `profiles_update` lets a user update their OWN profile row
-- (firebase_uid = auth.jwt()->>'sub') but has no WITH CHECK column guard, and the
-- anti-escalation BEFORE UPDATE trigger that 0002_rls.sql flagged as a "follow-up" was
-- never implemented. That let any authenticated user PATCH their own profiles row (directly
-- against PostgREST with the public anon key + their session JWT) to set
-- is_platform_admin=true / role='owner' / tenant_id=<victim>, which then satisfies
-- private.is_platform_admin() / re-points private.auth_tenant_id() and grants full
-- cross-tenant read/write. This trigger closes that hole.
--
-- Legitimate privileged writes (server provisioning, tier/role changes, admin actions) go
-- through the service role or a platform admin, both of which are allowed to pass. A normal
-- authenticated user may still edit non-privileged fields (name, avatar, prefs, ...).

create or replace function private.guard_profile_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  -- Server (service_role) and platform admins may legitimately change privileged columns.
  if coalesce(auth.role(), '') = 'service_role' or private.is_platform_admin() then
    return new;
  end if;
  -- A regular authenticated user may NOT escalate their own role / tenant / admin flag / uid.
  if new.role             is distinct from old.role
     or new.tenant_id     is distinct from old.tenant_id
     or new.is_platform_admin is distinct from old.is_platform_admin
     or new.firebase_uid  is distinct from old.firebase_uid then
    raise exception 'not authorized to modify privileged profile fields (role/tenant_id/is_platform_admin/firebase_uid)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function private.guard_profile_privileged_columns();
