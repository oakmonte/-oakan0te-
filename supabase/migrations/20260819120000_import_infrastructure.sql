-- Import infrastructure: Instagram credentials, job metadata, and the
-- idempotency key the import contract has always assumed.
--
-- Additive only. Nothing is dropped or rewritten, so this is safe to apply
-- while the current Bumpa import path keeps running.

-- ------------------------------------------------- store_credentials: IG ---
-- Instagram OAuth previously ran in oakmonte-backend and did the entire media
-- pull inside the callback, so the token never had to outlive the request. Now
-- the callback enqueues a job and the worker does the pull minutes later, which
-- means the token has to be stored — and long-lived (60 day) tokens have to be
-- refreshable, hence the expiry.
--
-- store_credentials is the right home rather than `stores`: it has RLS enabled
-- and it keeps tokens out of the row the storefront reads. Do not add new
-- credential columns to `stores`.
alter table public.store_credentials
  add column if not exists instagram_user_id            text,
  add column if not exists instagram_access_token       text,
  add column if not exists instagram_token_expires_at   timestamptz,
  add column if not exists instagram_connected_at       timestamptz;

comment on column public.store_credentials.instagram_user_id is
  'Instagram user id. TEXT, never numeric — these exceed 2^53-1 and round silently through JSON.parse.';

-- ------------------------------------------------------ import_jobs ---------
-- metadata: input for the run. CSV column maps, a forced profile, an Instagram
--           post filter. Without it the only channel into a job is file_path.
-- result:   structured outcome. `error` stays the human-readable summary (it is
--           the only free-text column and is used for `partial` too), while the
--           per-product detail lands here.
-- heartbeat_at: closes the gap the import contract calls out — a job stuck in
--           `running` because the worker died is otherwise indistinguishable
--           from one still in progress.
alter table public.import_jobs
  add column if not exists metadata      jsonb not null default '{}'::jsonb,
  add column if not exists result        jsonb,
  add column if not exists heartbeat_at  timestamptz;

comment on column public.import_jobs.status is
  'pending -> running -> succeeded | failed | partial. Free text with no check constraint, so this is a convention the worker and the app both have to honour.';

-- The worker polls for the oldest pending job on every tick.
create index if not exists import_jobs_status_created_idx
  on public.import_jobs (status, created_at);

-- Finding a store's recent imports for the dashboard.
create index if not exists import_jobs_store_created_idx
  on public.import_jobs (store_id, created_at desc);

-- --------------------------------------------------- products: identity -----
-- (store_id, source_platform, external_handle) is the reconciliation key every
-- importer already matches on. Until now nothing enforced it, so a concurrent
-- double-run could produce twins.
--
-- Partial, because manually-created products have a null external_handle and
-- there can be any number of those.
--
-- IF THIS FAILS with a uniqueness violation, duplicates already exist. Find
-- them before forcing it through:
--
--   select store_id, source_platform, external_handle, count(*)
--   from public.products
--   where external_handle is not null
--   group by 1,2,3 having count(*) > 1;
create unique index if not exists products_source_identity_uniq
  on public.products (store_id, source_platform, external_handle)
  where external_handle is not null;

-- ------------------------------------------------------ ig_post_files -------
-- The worker deletes and re-inserts a post's files on re-import, which is what
-- keeps a second run from appending a duplicate set. This index makes that
-- delete (and every "files for this post" read) cheap.
create index if not exists ig_post_files_post_id_idx
  on public.ig_post_files (post_id);
