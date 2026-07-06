-- YardWorx — atomic per-(tenant, period, meter) usage increment. Fixes the TOCTOU in writeUsage()
-- (read-rollup-then-upsert lost concurrent increments; tenant_usage UNDER-counted so a tenant could
-- silently blow past allotment / spend cap). Folds read+add+write into ONE statement whose
-- INSERT..ON CONFLICT DO UPDATE takes a row lock, serializing concurrent callers. Service-role only.
create or replace function public.increment_tenant_usage(
  p_tenant uuid,
  p_period text,
  p_meter  text,
  p_qty    numeric
) returns numeric
language sql
security definer
set search_path = ''
as $$
  insert into public.tenant_usage as tu (tenant_id, period, meter, quantity, updated_at)
  values (p_tenant, p_period, p_meter, coalesce(p_qty, 0), now())
  on conflict (tenant_id, period, meter)
  do update set quantity   = tu.quantity + excluded.quantity,
                updated_at = now()
  returning tu.quantity;
$$;

revoke all     on function public.increment_tenant_usage(uuid, text, text, numeric) from public, anon, authenticated;
grant  execute on function public.increment_tenant_usage(uuid, text, text, numeric) to   service_role;
