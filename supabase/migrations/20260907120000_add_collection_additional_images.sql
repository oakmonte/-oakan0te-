-- More than one image per collection.
--
-- `image_url` stays the cover (first item in the gallery, same convention as
-- MediaSection uses for products). This column holds the rest, in order.
--
-- RLS note: `collections` is one of the tables where row security is still
-- off pre-launch (POSTPONED §1.1). This column inherits that, deliberately --
-- adding a column is not the change that should quietly turn it on.
alter table public.collections
  add column if not exists additional_image_urls text[];

comment on column public.collections.additional_image_urls is
  'Gallery images beyond the cover (image_url), in display order.';
