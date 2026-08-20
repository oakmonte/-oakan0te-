create table public.tags (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  title text not null,
  created_at timestamptz not null default now()
);

create table public.product_tags (
  product_id uuid not null references public.products(id),
  tag_id uuid not null references public.tags(id),
  created_at timestamptz not null default now(),
  primary key (product_id, tag_id)
);

-- RLS intentionally left disabled here, matching the sibling collections /
-- product_collections tables: both are written directly from the browser via
-- the hardcoded DEV_STORE_ID hack in store.products_.new.tsx. Real
-- session-derived store scoping has to land before any of these five tables
-- gets policies enabled — see the pre-launch note in root CLAUDE.md.
