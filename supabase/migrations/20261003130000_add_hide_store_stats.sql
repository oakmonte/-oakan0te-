-- A store OWNER (not a store) can hide the seller-reputation block on their
-- personal profile: the star badges and the Sold Items count. Per-owner, so it
-- lives on profiles; stores.personal_storefront_only is the per-store switch and
-- is unrelated. Additive, defaults to false (shown), nothing to backfill.
alter table public.profiles
  add column hide_store_stats boolean not null default false;

comment on column public.profiles.hide_store_stats is
  'When true, /profile/$username hides the star badges and Sold Items for this owner. Written from Settings > Store by the owner; read by everyone through public_profiles.';

-- Appending a column at the end is allowed by CREATE OR REPLACE VIEW and keeps
-- the existing grants. Same security-definer-view tradeoff as before: the view
-- exists precisely to bypass profiles'' own-row SELECT policy.
create or replace view public.public_profiles as
select
  id,
  personal_username,
  display_name,
  avatar_url,
  bio,
  hide_store_stats
from public.profiles;
