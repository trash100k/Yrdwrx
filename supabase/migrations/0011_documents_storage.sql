-- Supabase Storage bucket for tenant documents (replaces Firebase Storage).
-- File bytes live in the private `documents` bucket under tenants/<tenantId>/documents/...;
-- metadata stays in public.documents (table RLS). Storage access is tenant-scoped by the
-- path prefix, so one tenant can never read/write another's files.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- A tenant member may read/write only files under their own tenant's prefix.
-- Path is tenants/<tenantId>/documents/<file>, so (storage.foldername(name))[2] = tenant id.
drop policy if exists documents_tenant_rw on storage.objects;
create policy documents_tenant_rw on storage.objects for all to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[2] = private.auth_tenant_id()::text
)
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[2] = private.auth_tenant_id()::text
);
