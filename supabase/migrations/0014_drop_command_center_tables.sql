-- SEC-2 remediation: drop the abandoned "command center" (`cc_*`) tables.
--
-- The pentest found 16 `cc_*` tables in this Supabase project that were world-readable AND
-- world-writable through the public anon key (RLS `USING/WITH CHECK (true)` for role `public`)
-- and held real prospect PII (leads, deals, voice calls). They are NOT part of YardWorx —
-- zero references anywhere in this codebase, no `tenant_id`, and no foreign key from any
-- YardWorx table points at them (verified). They belonged to a separate, abandoned
-- "command center" experiment sharing this project. The owner authorized their removal.
--
-- Dropped: cc_agents, cc_campaigns, cc_commands, cc_deals, cc_docs, cc_events, cc_leads,
-- cc_memories, cc_projects, cc_sequence_steps, cc_sites, cc_skills, cc_tasks, cc_voice_agents,
-- cc_voice_calls, cc_workflows (~76 rows total). CASCADE also removes their RLS policies,
-- indexes, and any cc_-internal constraints. Idempotent.

drop table if exists public.cc_agents         cascade;
drop table if exists public.cc_campaigns      cascade;
drop table if exists public.cc_commands       cascade;
drop table if exists public.cc_deals          cascade;
drop table if exists public.cc_docs           cascade;
drop table if exists public.cc_events         cascade;
drop table if exists public.cc_leads          cascade;
drop table if exists public.cc_memories       cascade;
drop table if exists public.cc_projects       cascade;
drop table if exists public.cc_sequence_steps cascade;
drop table if exists public.cc_sites          cascade;
drop table if exists public.cc_skills         cascade;
drop table if exists public.cc_tasks          cascade;
drop table if exists public.cc_voice_agents   cascade;
drop table if exists public.cc_voice_calls    cascade;
drop table if exists public.cc_workflows      cascade;
