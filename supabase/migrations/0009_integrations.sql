-- Third-party integration tokens (QuickBooks Online, etc.). Tokens are written/read ONLY by
-- the server via the service-role key (which bypasses RLS). The RLS select policy is
-- platform-admin-only so the anon/client key can NEVER read OAuth tokens; the app checks
-- connection status through a server endpoint instead.

create table if not exists public.integrations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  provider      text not null,            -- e.g. 'quickbooks'
  realm_id      text,                     -- QBO company (realm) id
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  status        text not null default 'connected',
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, provider)
);
create index if not exists integrations_tenant_idx on public.integrations(tenant_id);

alter table public.integrations enable row level security;
drop policy if exists integrations_admin on public.integrations;
-- Tokens never exposed to the anon/client key — only platform admins (and the service role,
-- which bypasses RLS entirely) can read/write rows here.
create policy integrations_admin on public.integrations for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
