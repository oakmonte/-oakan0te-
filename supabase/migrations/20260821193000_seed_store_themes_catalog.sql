-- store_themes already existed (name/preview_url/is_active/config/sort_order)
-- but was never seeded and had no read policy, so it was unreachable from the
-- browser client. `slug` is the stable, human-readable key the app already
-- uses everywhere (ThemeId: "motion" | "banner" | ...) -- kept separate from
-- the uuid `id` so store_theme_customizations (added next) can key off it
-- directly instead of round-tripping through a uuid lookup. Adding a theme
-- #6+ later is just another INSERT here, no migration required.
-- preview_url is left '' -- no image hosting (bunny.net) is set up yet;
-- fill these in once it is, no schema change needed.
alter table public.store_themes
  add column slug text unique not null default '';

alter table public.store_themes
  alter column slug drop default;

comment on column public.store_themes.slug is
  'Stable app-facing theme key (matches the TS ThemeId union in src/components/store-themes/types.ts). New themes are added by inserting a row with a new slug, not by migration.';

insert into public.store_themes (slug, name, preview_url, is_active, sort_order, config)
values
  ('motion', 'Motion Grid', '', true, 0, jsonb_build_object(
    'eyebrow', 'DYNAMIC · BOLD · STREETWEAR',
    'description', 'Built for drops, statements, and products that need to move fast.',
    'accent', '#9c4dff',
    'demoBrand', 'District 17'
  )),
  ('banner', 'Immersive Banner', '', true, 1, jsonb_build_object(
    'eyebrow', 'PREMIUM · CINEMATIC · REFINED',
    'description', 'A spacious editorial storefront that puts your world front and centre.',
    'accent', '#a67c52',
    'demoBrand', 'terra'
  )),
  ('story', 'Interactive Story', '', true, 2, jsonb_build_object(
    'eyebrow', 'SOCIAL · EXPRESSIVE · ENGAGING',
    'description', 'Turn products, campaigns, and creator moments into a living feed.',
    'accent', '#ec4b9a',
    'demoBrand', 'Sunday Social'
  )),
  ('atelier', 'Gallery Edit', '', true, 3, jsonb_build_object(
    'eyebrow', 'QUIET · LUXE · CONSIDERED',
    'description', 'A hushed, gallery-lit storefront for pieces that don''t need to shout.',
    'accent', '#c9a227',
    'demoBrand', 'Atelier Noir'
  )),
  ('circuit', 'Neon Terminal', '', true, 4, jsonb_build_object(
    'eyebrow', 'FUTURIST · TECH · HIGH-CONTRAST',
    'description', 'A HUD-inspired storefront for brands building what''s next.',
    'accent', '#2dd4ff',
    'demoBrand', 'Circuit'
  ));

-- Theme catalog is public reference data, not tenant-scoped -- unlike
-- products/stores it's safe to leave world-readable. RLS was already ON with
-- zero policies (deny-all), so without this the table was 100% unreadable
-- from the browser client.
create policy "Anyone can view active store themes"
  on public.store_themes
  for select
  using (is_active = true);
