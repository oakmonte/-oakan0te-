-- The 35 spec-driven themes (src/components/store-themes/theme-specs.ts).
--
-- stores.theme_id is a FK into this table, and useStoreTheme.selectTheme
-- looks a theme up BY SLUG before writing it, doing nothing when the row is
-- missing. A theme that exists in code but not here therefore looks
-- selectable, then silently reverts on reload with no error anywhere. These
-- rows are what make the code-side catalogue actually choosable.
--
-- RLS note: store_themes is a public read-only catalogue like the other
-- reference tables here; this migration only adds rows, it does not change
-- that.
insert into store_themes (slug, name, preview_url, is_active, sort_order) values
  ('lilac-hour', 'Lilac Hour', '/themes/lilac-hour', true, 100),
  ('orchid', 'Orchid', '/themes/orchid', true, 101),
  ('wisteria', 'Wisteria', '/themes/wisteria', true, 102),
  ('amethyst', 'Amethyst', '/themes/amethyst', true, 103),
  ('periwinkle', 'Periwinkle', '/themes/periwinkle', true, 104),
  ('mauve-studio', 'Mauve Studio', '/themes/mauve-studio', true, 105),
  ('blush', 'Blush', '/themes/blush', true, 106),
  ('rosewater', 'Rosewater', '/themes/rosewater', true, 107),
  ('fuchsia-night', 'Fuchsia Night', '/themes/fuchsia-night', true, 108),
  ('peony', 'Peony', '/themes/peony', true, 109),
  ('bubblegum', 'Bubblegum', '/themes/bubblegum', true, 110),
  ('dusty-rose', 'Dusty Rose', '/themes/dusty-rose', true, 111),
  ('black-gold', 'Black & Gold', '/themes/black-gold', true, 112),
  ('black-red', 'Black & Red', '/themes/black-red', true, 113),
  ('terracotta', 'Terracotta', '/themes/terracotta', true, 114),
  ('saffron', 'Saffron', '/themes/saffron', true, 115),
  ('clay', 'Clay', '/themes/clay', true, 116),
  ('amber-dusk', 'Amber Dusk', '/themes/amber-dusk', true, 117),
  ('copper', 'Copper', '/themes/copper', true, 118),
  ('sage', 'Sage', '/themes/sage', true, 119),
  ('eucalyptus', 'Eucalyptus', '/themes/eucalyptus', true, 120),
  ('deep-teal', 'Deep Teal', '/themes/deep-teal', true, 121),
  ('mint', 'Mint', '/themes/mint', true, 122),
  ('forest-ink', 'Forest Ink', '/themes/forest-ink', true, 123),
  ('cobalt', 'Cobalt', '/themes/cobalt', true, 124),
  ('midnight', 'Midnight', '/themes/midnight', true, 125),
  ('ice', 'Ice', '/themes/ice', true, 126),
  ('navy-linen', 'Navy Linen', '/themes/navy-linen', true, 127),
  ('bone', 'Bone', '/themes/bone', true, 128),
  ('graphite', 'Graphite', '/themes/graphite', true, 129),
  ('oat', 'Oat', '/themes/oat', true, 130),
  ('porcelain', 'Porcelain', '/themes/porcelain', true, 131),
  ('charcoal-rose', 'Charcoal Rose', '/themes/charcoal-rose', true, 132),
  ('electric-lime', 'Electric Lime', '/themes/electric-lime', true, 133),
  ('tangerine-pop', 'Tangerine Pop', '/themes/tangerine-pop', true, 134)
on conflict (slug) do update
  set name = excluded.name,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;

-- Retire rows with no theme behind them in code. This table carried a 'story'
-- ("Interactive Story") row that no ThemeId, component or spec has ever
-- matched. useStoreTheme casts the stored slug straight to ThemeId, so such a
-- row handed FullPreview a value matching no case and the switch fell through
-- to undefined -- which React throws on, white-screening a public storefront.
-- FullPreview has a default now, but an orphan should still not be offered.
update store_themes
set is_active = false
where slug not in (
  'motion', 'banner', 'atelier', 'circuit', 'verdant', 'monochrome',
  'gilded', 'obsidian', 'lilac-hour', 'orchid', 'wisteria', 'amethyst',
  'periwinkle', 'mauve-studio', 'blush', 'rosewater', 'fuchsia-night',
  'peony', 'bubblegum', 'dusty-rose', 'black-gold', 'black-red',
  'terracotta', 'saffron', 'clay', 'amber-dusk', 'copper', 'sage',
  'eucalyptus', 'deep-teal', 'mint', 'forest-ink', 'cobalt', 'midnight',
  'ice', 'navy-linen', 'bone', 'graphite', 'oat', 'porcelain',
  'charcoal-rose', 'electric-lime', 'tangerine-pop'
);
