-- product_variant_barcodes had RLS switched on with no policies at all, so
-- every write from the product form failed ("new row violates row-level
-- security policy") the moment a seller added a barcode. Same shape as
-- product_variants: anyone may read (a storefront shows nothing of it today,
-- but it is catalogue data, not private), only the store's owner may write,
-- checked through the variant with the existing owns_variant() helper.

create policy product_variant_barcodes_read
  on public.product_variant_barcodes for select
  using (true);

create policy product_variant_barcodes_insert
  on public.product_variant_barcodes for insert to authenticated
  with check (public.owns_variant(variant_id));

create policy product_variant_barcodes_update
  on public.product_variant_barcodes for update to authenticated
  using (public.owns_variant(variant_id))
  with check (public.owns_variant(variant_id));

create policy product_variant_barcodes_delete
  on public.product_variant_barcodes for delete to authenticated
  using (public.owns_variant(variant_id));
