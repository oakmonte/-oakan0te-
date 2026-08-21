-- Per-store, per-theme saved edits from the theme preview's edit mode
-- (src/components/store-themes/edit-types.ts ThemeEditState). Keyed by
-- (store_id, theme slug) so switching between themes never discards another
-- theme's tweaks -- each of the 5 (and any future) themes keeps its own row.
--
-- text/text_fonts/hidden_blocks are jsonb/array on purpose: the set of
-- editable fields (TextFieldId) and removable blocks already grows without a
-- migration on the app side (it's a Partial<Record<...>>), so the storage
-- shape shouldn't need one either when a new field is added.
--
-- logo_image_url/slideshow_image_urls exist now but are NOT written yet --
-- there is no image host configured (bunny.net, per the user, is not set up
-- yet), so uploaded images stay session-only (blob: URLs) until that lands.
-- The columns are here so wiring real URLs in later is a code change, not a
-- migration.
--
-- RLS left OFF to match products/stores/collections/product_variants --
-- this whole area is still gated by the DEV_STORE_ID hack (see
-- store.products.tsx), not real session-derived store scoping. Revisit
-- together with those tables, not in isolation. (See the follow-up
-- disable_rls_store_theme_customizations migration -- this project
-- auto-enables RLS on every new table, so that's a second, deliberate step.)
create table public.store_theme_customizations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  theme_slug text not null references public.store_themes(slug) on delete cascade,
  layout_id text not null default 'editorial',
  logo_mode text not null default 'image',
  logo_image_url text,
  slideshow_image_urls text[] not null default '{}',
  text jsonb not null default '{}',
  text_fonts jsonb not null default '{}',
  hidden_blocks text[] not null default '{}',
  collections_mode text not null default 'collections',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, theme_slug)
);

comment on table public.store_theme_customizations is
  'One row per (store, theme): the seller''s saved logo/slideshow/text/layout edits for that theme''s preview. RLS off, matches products/stores/collections -- gated by DEV_STORE_ID until real store scoping lands.';
comment on column public.store_theme_customizations.text is
  'Keyed by TextFieldId (hero1/hero2/hero3/statsFollowersText/.../overlayLine1/overlayLine2/logoText). Present key + empty string = seller removed that line. Absent key = show the theme default.';
comment on column public.store_theme_customizations.logo_image_url is
  'Not written yet -- no image host configured. Reserved so bunny.net (or interim storage) integration is additive, not a migration.';
comment on column public.store_theme_customizations.slideshow_image_urls is
  'Not written yet -- same as logo_image_url.';
