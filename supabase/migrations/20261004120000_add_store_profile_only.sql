-- Counterpart to personal_storefront_only. When true the owner sells from the
-- store page only: their personal /profile/$username drops its Store tab, so
-- the personal profile carries no store content. The store page, the switch
-- button and the stores row behave exactly as normal.
--
-- A store can't opt out of both selling surfaces, so the two flags are
-- mutually exclusive. Additive; defaults to false; nothing to backfill.
alter table public.stores
  add column store_profile_only boolean not null default false;

alter table public.stores
  add constraint stores_one_selling_surface
  check (not (personal_storefront_only and store_profile_only));

comment on column public.stores.store_profile_only is
  'When true, the owner sells from the store page only and their personal profile has no Store tab. Mutually exclusive with personal_storefront_only (stores_one_selling_surface).';
