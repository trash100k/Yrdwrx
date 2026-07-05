-- Secrets hardening — GRANT-level column lockdown on public.profiles (belt-and-suspenders
-- behind 0013_profiles_anti_escalation.sql's BEFORE UPDATE trigger).
--
-- Supabase grants `authenticated`/`anon` a TABLE-level UPDATE on public tables, which makes a
-- column-level REVOKE a no-op (Postgres does not subtract columns from a table grant). To make
-- the grant layer actually enforce column restrictions we (a) drop the table-level UPDATE grant,
-- then (b) re-grant UPDATE on ONLY the single column the client legitimately updates:
-- `agreements_accepted` (set by src/components/AgreementsGate.tsx — verified the sole client-side
-- profiles write; src/lib/repos/profile.ts only SELECTs, and role/tenant_id/display_name/email are
-- written exclusively by the server's SERVICE ROLE, which bypasses these grants).
--
-- Result: an authenticated user can ONLY update agreements_accepted; any attempt to change
-- role / tenant_id / is_platform_admin / firebase_uid / email / display_name is refused at the
-- GRANT layer BEFORE it reaches RLS or the 0013 trigger — a true independent second layer.
-- Service role is unaffected. Idempotent + safe to re-run.

revoke update on public.profiles from authenticated, anon;
grant  update (agreements_accepted) on public.profiles to authenticated;
