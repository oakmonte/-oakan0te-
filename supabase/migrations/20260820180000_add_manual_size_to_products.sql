-- Optional, single-value manual size pick for products with no Variant Size
-- axis (regular products, or variant products that only vary by e.g. Color/
-- Material). Lives directly on products since it's 1:1, not a list — a
-- separate table would be overkill for a singleton value. system matches
-- one of the SIZE_SYSTEMS keys in OptionEditorSheet.tsx (XXL/US/UK/Words).
-- Saved even with zero rows in product_size_measurements for this product:
-- the size itself is useful data on its own.
alter table public.products
  add column manual_size_value text,
  add column manual_size_system text;

comment on column public.products.manual_size_value is
  'Seller-picked size (e.g. "M") for products with no Variant Size option. Independent of product_size_measurements, which may be empty even when this is set.';
comment on column public.products.manual_size_system is
  'Which SIZE_SYSTEMS key manual_size_value was picked from (XXL | US | UK | Words).';
