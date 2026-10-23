-- Eight spec themes (theme-specs.ts): four rooted in West African cloth and
-- climate (Adire, Ankara Sun, Kente Gold, Harmattan) and four modern looks
-- (Lagos Night, Raw Denim, Chrome, Olive Grove).
--
-- Same reason as 20260912090000_seed_spec_store_themes.sql: selectTheme looks
-- a theme up BY SLUG and does nothing when the row is missing, so a theme in
-- code with no row here looks selectable and then silently reverts on reload.
-- Additive only; sort_order continues after Burgundy (141).
insert into store_themes (slug, name, preview_url, is_active, sort_order) values
  ('adire', 'Adire', '/themes/adire', true, 142),
  ('ankara-sun', 'Ankara Sun', '/themes/ankara-sun', true, 143),
  ('kente-gold', 'Kente Gold', '/themes/kente-gold', true, 144),
  ('harmattan', 'Harmattan', '/themes/harmattan', true, 145),
  ('lagos-night', 'Lagos Night', '/themes/lagos-night', true, 146),
  ('raw-denim', 'Raw Denim', '/themes/raw-denim', true, 147),
  ('chrome', 'Chrome', '/themes/chrome', true, 148),
  ('olive-grove', 'Olive Grove', '/themes/olive-grove', true, 149)
on conflict (slug) do update
  set name = excluded.name,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;
