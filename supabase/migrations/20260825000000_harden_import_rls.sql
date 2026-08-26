-- import_jobs, ig_posts and ig_post_files all predate the supabase migrations
-- in this directory. Because they were created before the rls_auto_enable()
-- event trigger was wired up, they have RLS *disabled* by default — meaning
-- the anon/publishable browser client can read every seller's import history,
-- every Instagram post record, and every stored file path through the
-- PostgREST API (/rest/v1/<table>).
--
-- All three are written and read exclusively through service-role routes (the
-- import worker, api.import.*, api.instagram.*). The browser client has no
-- legitimate reason to touch them directly. Enabling RLS with zero policies
-- locks out anon and authenticated callers completely, exactly as
-- store_credentials and store_payout_accounts are configured. Service-role
-- bypasses RLS and keeps working without change.

alter table public.import_jobs enable row level security;

comment on table public.import_jobs is
  'Import job queue. RLS enabled with zero policies: only the service-role key (Render worker + api.import.* handlers) can read or write. The browser client has no direct access.';

alter table public.ig_posts enable row level security;

comment on table public.ig_posts is
  'Imported Instagram posts. RLS enabled with zero policies: only the service-role key (Render worker) can read or write. Note: this table uses seller_id (not store_id) — a legacy name from oakmonte-backend that should be normalised when the schema allows.';

alter table public.ig_post_files enable row level security;

comment on table public.ig_post_files is
  'Uploaded Instagram post files. RLS enabled with zero policies: only the service-role key (Render worker) can read or write. The browser client has no direct access.';
