-- AI credit wallet columns on tenants.
-- Backs server.ts meterCredits() + GET /api/usage/credits: per-tenant monthly AI credit
-- accounting (402 INSUFFICIENT_CREDITS at zero). Idempotent + additive; safe to re-run.
-- ai_credits_period is the YYYY-MM the counter applies to; it resets implicitly when the
-- stored period != the current month (see server.ts).

alter table public.tenants add column if not exists ai_credits_used   numeric not null default 0;
alter table public.tenants add column if not exists ai_credits_period text;
