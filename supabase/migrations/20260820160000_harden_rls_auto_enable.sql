-- rls_auto_enable() is an event-trigger function: it enables RLS on any table
-- created in `public`. It is useful and should stay.
--
-- What it should NOT be is callable over the REST API. Supabase exposes every
-- function in `public` at /rest/v1/rpc/<name>, and this one is SECURITY
-- DEFINER, so both `anon` and `authenticated` could invoke it as the definer.
-- It errors harmlessly today (pg_event_trigger_ddl_commands() throws outside an
-- event-trigger context), but a SECURITY DEFINER function reachable by
-- unauthenticated callers is a standing liability, not a design.
--
-- Event triggers are invoked by Postgres itself and ignore EXECUTE grants, so
-- revoking them does not affect the auto-enable behaviour.

revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.rls_auto_enable() from public;
