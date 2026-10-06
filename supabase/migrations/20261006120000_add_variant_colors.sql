-- A regular (single-variant) product's colour(s).
--
-- Variant products already express colour as a buyer-selectable option axis
-- (product_options "Color"). A regular product has no axis -- giving it a
-- product_options row would make the edit page reload it as a variant
-- product -- so its colour lives on its one product_variants row instead,
-- next to material, which is stored the same way for the same reason.
--
-- Additive and nullable: existing rows and existing writers are unaffected.
alter table public.product_variants
  add column if not exists colors text[];
