-- Non-sellable "pieces" a store shows on its profile -- a lightweight
-- lookbook/portfolio distinct from its sellable product catalogue. Labeled
-- "Gallery" for store_type = 'Artist' and "Wardrobe" for everyone else (see
-- storeTabsFor in profile-tabs.tsx) -- same underlying rows either way.
--
-- Modeled on `posts` (photo + caption + draft/published) but scoped by
-- store_id, not user_id -- a store is a seller identity, not the person who
-- owns it, and this needs to show up on the STORE's profile regardless of
-- who's signed in. Single photo per piece, not a carousel -- see the posts
-- carousel migration (20260906120000_add_post_media_carousel.sql) for the
-- child-table shape to add later if that's ever wanted; deliberately left out
-- now to keep this genuinely lightweight.
create table public.store_pieces (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  media_url text not null,
  caption text,
  status text not null default 'published' check (status in ('published', 'draft')),
  created_at timestamptz not null default now()
);

create index store_pieces_store_id_created_at_idx on public.store_pieces (store_id, created_at desc);

-- Explicit despite the rls_auto_enable() event trigger already turning this
-- on -- see 20260820160000_harden_rls_auto_enable.sql -- same
-- belt-and-suspenders style post_media uses.
alter table public.store_pieces enable row level security;

-- Unlike the legacy catalogue tables in POSTPONED.md §1.1, this is a brand
-- new table -- it ships with real, working RLS from day one and is NOT part
-- of that held migration.
create policy "Public reads published pieces, store owner reads all"
  on public.store_pieces
  for select
  using (
    status = 'published'
    or exists (
      select 1 from public.stores s
      where s.id = store_pieces.store_id and s.owner_id = auth.uid()
    )
  );

create policy "Store owners insert their own pieces"
  on public.store_pieces
  for insert
  with check (
    exists (
      select 1 from public.stores s
      where s.id = store_pieces.store_id and s.owner_id = auth.uid()
    )
  );

create policy "Store owners update their own pieces"
  on public.store_pieces
  for update
  using (
    exists (select 1 from public.stores s where s.id = store_pieces.store_id and s.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.stores s where s.id = store_pieces.store_id and s.owner_id = auth.uid())
  );

create policy "Store owners delete their own pieces"
  on public.store_pieces
  for delete
  using (
    exists (select 1 from public.stores s where s.id = store_pieces.store_id and s.owner_id = auth.uid())
  );
