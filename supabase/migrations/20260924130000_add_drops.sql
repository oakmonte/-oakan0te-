-- Drops: a seller-curated release, wrapping either an existing collection
-- (collection_id set, membership read live off product_collections) or a
-- hand-picked product set (collection_id null, membership in drop_products).
-- starts_at/ends_at are both optional -- null/null is a plain "new drop"
-- announcement with no timer at all.
create table public.drops (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  title text not null,
  cover_image_url text,
  collection_id uuid references public.collections(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only populated in product-set mode (drops.collection_id is null). A drop
-- built from a collection has no rows here -- its products are whatever the
-- collection currently contains.
create table public.drop_products (
  drop_id uuid not null references public.drops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drop_id, product_id)
);

-- RLS intentionally left disabled, matching collections/product_collections
-- and products/product_variants (see root CLAUDE.md's Pre-launch state and
-- the supabase-data-access skill) -- the browser client writes these
-- directly from store.drops_.new.tsx the same way it writes collections.
-- This is a known, tracked pre-launch gap, not new scope: fold these two
-- tables into the already-drafted RLS-enable migration when that lands.
comment on table public.drops is
  'RLS disabled -- see collections/products for rationale. Fold into the pending RLS-enable migration (POSTPONED.md 1.1) when it lands.';
comment on table public.drop_products is
  'RLS disabled -- see collections/products for rationale. Fold into the pending RLS-enable migration (POSTPONED.md 1.1) when it lands.';
