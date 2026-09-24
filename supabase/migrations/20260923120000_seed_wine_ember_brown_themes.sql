-- Six spec themes: two wines (Bordeaux, Merlot), two dulled embers (Kiln,
-- Hearth) and two browns (Espresso, Walnut). See theme-specs.ts.
--
-- Same reason as 20260912090000_seed_spec_store_themes.sql: selectTheme looks
-- a theme up BY SLUG and does nothing when the row is missing, so a theme in
-- code with no row here looks selectable and then silently reverts on reload.
-- Additive only; sort_order continues after tangerine-pop (134).
insert into store_themes (slug, name, preview_url, is_active, sort_order) values
  ('bordeaux', 'Bordeaux', '/themes/bordeaux', true, 135),
  ('merlot', 'Merlot', '/themes/merlot', true, 136),
  ('kiln', 'Kiln', '/themes/kiln', true, 137),
  ('hearth', 'Hearth', '/themes/hearth', true, 138),
  ('espresso', 'Espresso', '/themes/espresso', true, 139),
  ('walnut', 'Walnut', '/themes/walnut', true, 140)
on conflict (slug) do update
  set name = excluded.name,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;
