-- Saving an edited product, in one transaction, keeping variant ids.
--
-- The product form's edit used to delete every product_variants and
-- product_options row and insert them again, from the browser, one table at a
-- time. Two problems:
--   1. Variant ids changed on every save. offers.variant_id cascades on delete,
--      so fixing a typo in a title deleted every open offer on the product, and
--      buyers' bags (which hold variant ids) turned unavailable.
--   2. Nothing was atomic: a failed insert after the deletes left the product
--      with no variants at all.
--
-- The caller (src/lib/product-save.ts, planning ids with
-- src/lib/product-variant-ids.ts) sends the full desired state WITH ids --
-- existing ids for rows that survive the edit, fresh ones for new rows. This
-- function upserts those by id and deletes whatever of the product's options,
-- values and variants isn't listed. Per-variant children (links, stock,
-- barcodes) and the product-level lists (measurements, collections, tags,
-- post links) carry no outside references, so they are simply rewritten.
--
-- SECURITY INVOKER: every statement runs under the caller's RLS policies
-- (owns_product / owns_variant / owns_option ...), exactly as the old direct
-- writes did. The explicit owns_product check up front just turns "someone
-- else's product" into one clear error instead of a policy violation halfway
-- through. Any error rolls the whole save back.
--
-- Arguments (jsonb shapes):
--   p_product   {title, description_short, product_type, status, is_complete,
--                pass_fees_to_buyer, manual_size_value, manual_size_system}
--   p_options   [{id, name, position, values: [{id, value, position}]}]
--   p_variants  [{id, <product_variants columns>, links: [{option_id, value_id}],
--                 stock: [{location_id, quantity}],
--                 barcodes: [{type, value, position}]}]
--   p_measurements [{size_value, measurement_key, value_cm}]
create or replace function public.save_product_edit(
  p_product_id uuid,
  p_product jsonb,
  p_options jsonb,
  p_variants jsonb,
  p_measurements jsonb,
  p_collection_ids uuid[],
  p_tag_ids uuid[],
  p_post_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_option_ids uuid[];
  v_value_ids uuid[];
  v_variant_ids uuid[];
begin
  if not public.owns_product(p_product_id) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  p_options := coalesce(p_options, '[]'::jsonb);
  p_variants := coalesce(p_variants, '[]'::jsonb);
  p_measurements := coalesce(p_measurements, '[]'::jsonb);

  select coalesce(array_agg((o ->> 'id')::uuid), '{}')
    into v_option_ids from jsonb_array_elements(p_options) o;
  select coalesce(array_agg((v ->> 'id')::uuid), '{}')
    into v_value_ids
    from jsonb_array_elements(p_options) o, jsonb_array_elements(o -> 'values') v;
  select coalesce(array_agg((v ->> 'id')::uuid), '{}')
    into v_variant_ids from jsonb_array_elements(p_variants) v;

  -- An id that already belongs to a different product would otherwise be
  -- "updated" across onto this one.
  if exists (select 1 from public.product_options
             where id = any (v_option_ids) and product_id <> p_product_id)
     or exists (select 1 from public.product_option_values pov
                join public.product_options po on po.id = pov.option_id
                where pov.id = any (v_value_ids) and po.product_id <> p_product_id)
     or exists (select 1 from public.product_variants
                where id = any (v_variant_ids) and product_id <> p_product_id) then
    raise exception 'Variant or option belongs to another product' using errcode = '22023';
  end if;

  -- handle, source_platform, external_handle and category_id deliberately
  -- untouched: handle is the public URL, the rest is provenance.
  update public.products set
    title = p_product ->> 'title',
    description_short = p_product ->> 'description_short',
    product_type = p_product ->> 'product_type',
    status = p_product ->> 'status',
    is_complete = (p_product ->> 'is_complete')::boolean,
    pass_fees_to_buyer = (p_product ->> 'pass_fees_to_buyer')::boolean,
    manual_size_value = p_product ->> 'manual_size_value',
    manual_size_system = p_product ->> 'manual_size_system'
  where id = p_product_id;

  -- ------------------------------------------------ removed rows go first
  -- (cascades: a removed variant takes its links, stock, barcodes and offers;
  -- a removed option takes its values and their links.)
  delete from public.product_variants
    where product_id = p_product_id and id <> all (v_variant_ids);
  delete from public.product_options
    where product_id = p_product_id and id <> all (v_option_ids);
  delete from public.product_option_values pov
    using public.product_options po
    where po.id = pov.option_id and po.product_id = p_product_id
      and pov.id <> all (v_value_ids);

  -- ---------------------------------------------------- options + values
  -- (product_id, position) and (option_id, position) are unique and checked
  -- row by row, so park surviving rows on negative positions before writing
  -- the real ones, or reordering two options collides with itself.
  update public.product_options set position = -position - 1
    where product_id = p_product_id;
  update public.product_option_values pov set position = -pov.position - 1
    from public.product_options po
    where po.id = pov.option_id and po.product_id = p_product_id;

  insert into public.product_options (id, product_id, name, position)
  select (o ->> 'id')::uuid, p_product_id, o ->> 'name', (o ->> 'position')::integer
  from jsonb_array_elements(p_options) o
  on conflict (id) do update set name = excluded.name, position = excluded.position;

  insert into public.product_option_values (id, option_id, value, position)
  select (v ->> 'id')::uuid, (o ->> 'id')::uuid, v ->> 'value', (v ->> 'position')::integer
  from jsonb_array_elements(p_options) o, jsonb_array_elements(o -> 'values') v
  on conflict (id) do update
    set option_id = excluded.option_id, value = excluded.value, position = excluded.position;

  -- ------------------------------------------------------------ variants
  -- Both representations, as on every variant write: the flat option1_*
  -- columns here and the normalized links below (canonical-product-schema).
  insert into public.product_variants (
    id, product_id,
    option1_name, option1_value, option2_name, option2_value, option3_name, option3_value,
    price, compare_at_price, cost_price, stock_qty, sku, continue_selling_out_of_stock,
    main_image_url, additional_image_urls, material, material_feel, colors, weight_grams
  )
  select
    r.id, p_product_id,
    r.option1_name, r.option1_value, r.option2_name, r.option2_value, r.option3_name, r.option3_value,
    r.price, r.compare_at_price, r.cost_price, r.stock_qty, r.sku,
    coalesce(r.continue_selling_out_of_stock, false),
    r.main_image_url, r.additional_image_urls, r.material, r.material_feel, r.colors, r.weight_grams
  from jsonb_array_elements(p_variants) v
  cross join lateral jsonb_populate_record(null::public.product_variants, v) r
  on conflict (id) do update set
    option1_name = excluded.option1_name, option1_value = excluded.option1_value,
    option2_name = excluded.option2_name, option2_value = excluded.option2_value,
    option3_name = excluded.option3_name, option3_value = excluded.option3_value,
    price = excluded.price,
    compare_at_price = excluded.compare_at_price,
    cost_price = excluded.cost_price,
    stock_qty = excluded.stock_qty,
    sku = excluded.sku,
    continue_selling_out_of_stock = excluded.continue_selling_out_of_stock,
    main_image_url = excluded.main_image_url,
    additional_image_urls = excluded.additional_image_urls,
    material = excluded.material,
    material_feel = excluded.material_feel,
    colors = excluded.colors,
    weight_grams = excluded.weight_grams;

  -- --------------------------------------- per-variant children, rewritten
  delete from public.product_variant_options where variant_id = any (v_variant_ids);
  insert into public.product_variant_options (variant_id, option_id, value_id)
  select (v ->> 'id')::uuid, (l ->> 'option_id')::uuid, (l ->> 'value_id')::uuid
  from jsonb_array_elements(p_variants) v,
       jsonb_array_elements(coalesce(v -> 'links', '[]'::jsonb)) l;

  delete from public.product_variant_stock where variant_id = any (v_variant_ids);
  insert into public.product_variant_stock (variant_id, location_id, quantity)
  select (v ->> 'id')::uuid, (s ->> 'location_id')::uuid, (s ->> 'quantity')::integer
  from jsonb_array_elements(p_variants) v,
       jsonb_array_elements(coalesce(v -> 'stock', '[]'::jsonb)) s;

  delete from public.product_variant_barcodes where variant_id = any (v_variant_ids);
  insert into public.product_variant_barcodes (variant_id, type, value, position)
  select (v ->> 'id')::uuid, b ->> 'type', b ->> 'value', (b ->> 'position')::integer
  from jsonb_array_elements(p_variants) v,
       jsonb_array_elements(coalesce(v -> 'barcodes', '[]'::jsonb)) b;

  -- -------------------------------------------- product-level lists
  delete from public.product_size_measurements where product_id = p_product_id;
  insert into public.product_size_measurements (product_id, size_value, measurement_key, value_cm)
  select p_product_id, m ->> 'size_value', m ->> 'measurement_key', (m ->> 'value_cm')::numeric
  from jsonb_array_elements(p_measurements) m;

  delete from public.product_collections where product_id = p_product_id;
  insert into public.product_collections (product_id, collection_id)
  select p_product_id, unnest(coalesce(p_collection_ids, '{}'));

  delete from public.product_tags where product_id = p_product_id;
  insert into public.product_tags (product_id, tag_id)
  select p_product_id, unnest(coalesce(p_tag_ids, '{}'));

  delete from public.post_product_tags where product_id = p_product_id;
  insert into public.post_product_tags (product_id, post_id)
  select p_product_id, unnest(coalesce(p_post_ids, '{}'));
end;
$$;

revoke execute on function
  public.save_product_edit(uuid, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[])
from public, anon;
grant execute on function
  public.save_product_edit(uuid, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[])
to authenticated;
