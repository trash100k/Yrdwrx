-- YardWorx — scheduled text campaigns: store the queued recipients on the campaign row so
-- the server-side processor can send them at scheduled_for. Additive + idempotent.
-- (status + scheduled_for already exist from 0010; recipients/append_footer are new.)

alter table public.sms_campaigns add column if not exists recipients    jsonb not null default '[]'::jsonb;
alter table public.sms_campaigns add column if not exists append_footer boolean not null default true;

-- The processor scans for due scheduled campaigns; index the hot path.
create index if not exists sms_campaigns_due_idx on public.sms_campaigns(status, scheduled_for);
