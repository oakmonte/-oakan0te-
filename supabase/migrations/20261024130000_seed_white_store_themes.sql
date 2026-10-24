-- Two white spec themes (theme-specs.ts): Paper and Linen White. Same reason
-- as the earlier seed migrations: selectTheme looks a theme up BY SLUG and
-- does nothing when the row is missing. Additive only; sort_order continues
-- after Olive Grove (149). (The picker's own order is PINNED in types.ts.)
insert into store_themes (slug, name, preview_url, is_active, sort_order) values
  ('paper', 'Paper', '/themes/paper', true, 150),
  ('linen-white', 'Linen White', '/themes/linen-white', true, 151)
on conflict (slug) do update
  set name = excluded.name,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;
