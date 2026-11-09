-- Stock a seller holds without having added a pickup location yet.
--
-- A null location_id is the "No location added" row in the product form's
-- Inventory sheet: sellers who skip pickup locations during setup can still
-- record how many they have, and every seller keeps it as an option under
-- their real locations. Additive only -- existing rows all have a location.
--
-- unique (variant_id, location_id) treats nulls as distinct, so a separate
-- partial index keeps it to one unlocated row per variant.

alter table public.product_variant_stock
  alter column location_id drop not null;

create unique index if not exists product_variant_stock_one_unlocated
  on public.product_variant_stock (variant_id)
  where location_id is null;
