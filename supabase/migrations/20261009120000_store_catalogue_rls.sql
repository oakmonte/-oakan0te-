-- Row-level security for the store and catalogue tables the seller dashboard
-- writes to straight from the browser (POSTPONED §1.1).
--
-- Before this, RLS was off on all of them and anon/authenticated held INSERT,
-- UPDATE and DELETE: the publishable key in the JS bundle could rewrite or
-- delete any store's catalogue. Anonymous sign-ins (on since 2026-10-09)
-- don't widen that, but real sellers are about to land on it.
--
-- Shape:
--   * Reads stay public (USING true) on everything the storefront shows, so
--     no public page changes behaviour. store_locations (street addresses) is
--     the exception: owner-only, it's only read in the dashboard.
--   * Writes are owner-only, through SECURITY DEFINER helpers that walk each
--     row back to stores.owner_id. Server routes and the import worker use
--     the service role and bypass RLS, as before.
--   * stores is publicly readable row-wise, but its private columns (contact
--     details, pickup address, Shopify/Bumpa credentials) lose SELECT for
--     anon/authenticated via column grants. The browser never reads those
--     columns; it only writes business_email, which needs INSERT/UPDATE, not
--     SELECT.
--   * Anonymous accounts can't create a store.

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so a policy on one table can look through stores/products
-- without those tables' own policies recursing. Empty search_path, every name
-- qualified.

create or replace function public.owns_store(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.stores s where s.id = sid and s.owner_id = auth.uid());
$$;

create or replace function public.owns_product(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p join public.stores s on s.id = p.store_id
    where p.id = pid and s.owner_id = auth.uid());
$$;

create or replace function public.owns_variant(vid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.stores s on s.id = p.store_id
    where v.id = vid and s.owner_id = auth.uid());
$$;

create or replace function public.owns_option(oid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.product_options o
    join public.products p on p.id = o.product_id
    join public.stores s on s.id = p.store_id
    where o.id = oid and s.owner_id = auth.uid());
$$;

create or replace function public.owns_collection(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collections c join public.stores s on s.id = c.store_id
    where c.id = cid and s.owner_id = auth.uid());
$$;

create or replace function public.owns_tag(tid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tags t join public.stores s on s.id = t.store_id
    where t.id = tid and s.owner_id = auth.uid());
$$;

create or replace function public.owns_location(lid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_locations l join public.stores s on s.id = l.store_id
    where l.id = lid and s.owner_id = auth.uid());
$$;

-- Not callable by signed-out visitors over the REST API.
revoke execute on function
  public.owns_store(uuid), public.owns_product(uuid), public.owns_variant(uuid),
  public.owns_option(uuid), public.owns_collection(uuid), public.owns_tag(uuid),
  public.owns_location(uuid)
from public, anon;
grant execute on function
  public.owns_store(uuid), public.owns_product(uuid), public.owns_variant(uuid),
  public.owns_option(uuid), public.owns_collection(uuid), public.owns_tag(uuid),
  public.owns_location(uuid)
to authenticated;

-- ---------------------------------------------------------------- stores
alter table public.stores enable row level security;
drop policy if exists "Owners can insert their own store" on public.stores;
drop policy if exists "Owners can update their own store" on public.stores;
drop policy if exists "Owners can view their own store" on public.stores;

create policy stores_read on public.stores for select using (true);
create policy stores_insert on public.stores for insert to authenticated
  with check (
    owner_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
create policy stores_update on public.stores for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy stores_delete on public.stores for delete to authenticated
  using (owner_id = auth.uid());

revoke select on public.stores from anon, authenticated;
grant select (
  id, owner_id, brand_name, store_username, product_category, bio, created_at,
  offers_custom_orders, store_type, theme_id, personal_storefront_only, logo_url,
  onboarded_at, store_profile_only
) on public.stores to anon, authenticated;

-- ------------------------------------------------- store-scoped (store_id)
do $$
declare t text;
begin
  foreach t in array array['products', 'collections', 'tags', 'store_theme_customizations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.owns_store(store_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.owns_store(store_id)) with check (public.owns_store(store_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.owns_store(store_id))',
      t || '_delete', t);
  end loop;
end $$;

-- Street addresses: owner-only, reads included.
alter table public.store_locations enable row level security;
create policy store_locations_owner on public.store_locations for all to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- ------------------------------------------------ product-scoped (product_id)
do $$
declare t text;
begin
  foreach t in array array['product_variants', 'product_options', 'product_size_measurements']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.owns_product(product_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.owns_product(product_id)) with check (public.owns_product(product_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.owns_product(product_id))',
      t || '_delete', t);
  end loop;
end $$;

-- ------------------------------------------------------------ join tables
alter table public.product_collections enable row level security;
create policy product_collections_read on public.product_collections for select using (true);
create policy product_collections_write on public.product_collections for all to authenticated
  using (public.owns_product(product_id) and public.owns_collection(collection_id))
  with check (public.owns_product(product_id) and public.owns_collection(collection_id));

alter table public.product_tags enable row level security;
create policy product_tags_read on public.product_tags for select using (true);
create policy product_tags_write on public.product_tags for all to authenticated
  using (public.owns_product(product_id) and public.owns_tag(tag_id))
  with check (public.owns_product(product_id) and public.owns_tag(tag_id));

alter table public.product_option_values enable row level security;
create policy product_option_values_read on public.product_option_values for select using (true);
create policy product_option_values_write on public.product_option_values for all to authenticated
  using (public.owns_option(option_id)) with check (public.owns_option(option_id));

alter table public.product_variant_options enable row level security;
create policy product_variant_options_read on public.product_variant_options for select using (true);
create policy product_variant_options_write on public.product_variant_options for all to authenticated
  using (public.owns_variant(variant_id) and public.owns_option(option_id))
  with check (public.owns_variant(variant_id) and public.owns_option(option_id));

alter table public.product_variant_stock enable row level security;
create policy product_variant_stock_read on public.product_variant_stock for select using (true);
create policy product_variant_stock_write on public.product_variant_stock for all to authenticated
  using (public.owns_variant(variant_id) and (location_id is null or public.owns_location(location_id)))
  with check (public.owns_variant(variant_id) and (location_id is null or public.owns_location(location_id)));
