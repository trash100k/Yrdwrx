-- Harden the SEC-1 anti-escalation trigger function: pin an empty search_path so it can't be
-- hijacked by a caller-controlled search_path (clears the function_search_path_mutable advisor).
-- All references are already schema-qualified (auth.role, private.is_platform_admin); pg_catalog
-- built-ins (coalesce, raise, operators) remain available under an empty search_path.
create or replace function private.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or private.is_platform_admin() then
    return new;
  end if;
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
