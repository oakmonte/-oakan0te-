-- A store's shipping policy: free text the seller writes in Settings, shown
-- to buyers in a pop-up from the storefront footer. Null/empty = the footer
-- shows no Shipping Policy link (nothing is written on the seller's behalf).

alter table public.stores add column if not exists shipping_policy text;

alter table public.stores drop constraint if exists stores_shipping_policy_length;
alter table public.stores add constraint stores_shipping_policy_length
  check (shipping_policy is null or char_length(shipping_policy) <= 2000);

-- stores is column-granted for reads (20261009120000_store_catalogue_rls.sql):
-- buyers read storefront columns only. The policy is public by design.
grant select (shipping_policy) on public.stores to anon, authenticated;
