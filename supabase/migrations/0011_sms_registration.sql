-- YardWorx — Texting setup: A2P 10DLC registration intake + auto-reply config.
--
-- One row per tenant. Holds (a) the A2P 10DLC brand + campaign registration data the
-- carrier needs (collected via the in-app setup flow; actual submission to Twilio is a
-- human/config step — see TEXT_CAMPAIGN_RESEARCH.md §2a) and (b) the agentic SMS auto-reply
-- mode. Additive + idempotent, RLS via the private.* helpers (same pattern as 0010).

create extension if not exists "pgcrypto";

create table if not exists public.sms_registrations (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  -- A2P 10DLC brand (the business identity carriers vet)
  legal_business_name      text,
  business_type            text,        -- LLC | Sole Proprietor | Corporation | ...
  ein                      text,        -- tax id (Standard brand) — null for Sole Proprietor
  vertical                 text,        -- industry, e.g. "Landscaping / Home services"
  website                  text,
  address                  text,
  contact_email            text,
  contact_phone            text,
  -- A2P 10DLC campaign (the use case)
  use_case                 text default 'mixed',  -- mixed | marketing | customer_care | ...
  description              text,
  sample_messages          jsonb not null default '[]'::jsonb,
  opt_in_description       text,
  -- Agentic auto-reply
  auto_reply_mode          text not null default 'off',  -- off | auto | draft
  auto_reply_instructions  text,
  -- Lifecycle + Twilio identifiers (populated when submission succeeds)
  status                   text not null default 'not_started', -- not_started|collecting|pending|approved|failed
  brand_sid                text,
  campaign_sid             text,
  messaging_service_sid    text,
  submitted_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index if not exists sms_registrations_tenant_uidx on public.sms_registrations(tenant_id);

do $$
declare t text;
begin
  foreach t in array array['sms_registrations'] loop
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
