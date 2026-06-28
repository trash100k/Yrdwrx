-- rls_auto_enable() is a beneficial pre-existing event trigger (auto-enables RLS on new
-- public tables). Event triggers fire via the DDL mechanism, not direct RPC, so revoking
-- the stray direct-EXECUTE grant is safe and clears the linter warning.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
