-- drops, drop_products and drop_collections had RLS on with no policies, so
-- the browser (DropsPanel, drop-form.ts, the storefront's live-drop banner)
-- could neither read nor write them. Reads are public: a live drop is shown to
-- shoppers on the storefront. Writes are the store owner's only -- drops by
-- their store_id, the join tables through their drop.

create or replace function public.owns_drop(did uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.drops d join public.stores s on s.id = d.store_id
    where d.id = did and s.owner_id = auth.uid());
$$;

create policy drops_read on public.drops for select using (true);
create policy drops_insert on public.drops for insert to authenticated
  with check (public.owns_store(store_id));
create policy drops_update on public.drops for update to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));
create policy drops_delete on public.drops for delete to authenticated
  using (public.owns_store(store_id));

create policy drop_products_read on public.drop_products for select using (true);
create policy drop_products_insert on public.drop_products for insert to authenticated
  with check (public.owns_drop(drop_id) and public.owns_product(product_id));
create policy drop_products_delete on public.drop_products for delete to authenticated
  using (public.owns_drop(drop_id));

create policy drop_collections_read on public.drop_collections for select using (true);
create policy drop_collections_insert on public.drop_collections for insert to authenticated
  with check (public.owns_drop(drop_id) and public.owns_collection(collection_id));
create policy drop_collections_delete on public.drop_collections for delete to authenticated
  using (public.owns_drop(drop_id));
