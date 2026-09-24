-- collection_id was ON DELETE SET NULL. The app reads "collection_id is
-- null" as "this drop is a hand-picked product set" (see drop_products'
-- comment in the prior migration), so deleting the wrapped collection was
-- silently reclassifying the drop into an empty products-mode drop instead
-- of removing it. A drop with no collection and no products is meaningless,
-- so it should go with the collection it wraps.
alter table public.drops drop constraint drops_collection_id_fkey;
alter table public.drops
  add constraint drops_collection_id_fkey
  foreign key (collection_id) references public.collections(id) on delete cascade;

-- Nothing stopped an end time before the start time, which dropStatusLabel
-- would then read as "Starts in ..." forever, since it checks starts_at
-- first and never notices ends_at already passed.
alter table public.drops
  add constraint drops_ends_after_starts
  check (starts_at is null or ends_at is null or ends_at > starts_at);
