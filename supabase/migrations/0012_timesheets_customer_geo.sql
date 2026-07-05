-- Per-job linkage + optional geofence for crew timesheets (feat-timeclock-payroll).
-- 0008 gave timesheets a job_id; the clock now also stamps the customer and (optionally)
-- the device coordinates captured at clock-in, so Job Costing / Customer Intelligence get
-- real labor linkage instead of estimate fallbacks. Additive + idempotent: safe to re-run
-- and a no-op against a DB that already has these columns. RLS is unchanged (see 0008).

alter table public.timesheets
  add column if not exists customer_id   uuid references public.customers(id) on delete set null;

alter table public.timesheets
  add column if not exists clock_in_lat  double precision;

alter table public.timesheets
  add column if not exists clock_in_lng  double precision;

create index if not exists timesheets_customer_idx on public.timesheets(tenant_id, customer_id);
