-- RLS is disabled on public.stores (see supabase-data-access skill / the
-- rls_disabled advisory) — this column is written by the same unauthenticated
-- browser client as brand_name/store_username in name-your-store.tsx, no
-- different exposure than the rest of the row.
alter table public.stores
  add column personal_storefront_only boolean not null default false;

comment on column public.stores.personal_storefront_only is
  'When true, this store has no standalone /store-profile page — it only sells through the owner''s /profile/$username "Store" tab. The stores row and all its data (products, theme, etc.) still exist exactly as normal; this only hides the separate storefront destination.';
