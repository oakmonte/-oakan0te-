-- Burgundy, the 50th theme (theme-specs.ts). Same reason as
-- 20260912090000_seed_spec_store_themes.sql: stores.theme_id is a FK into
-- this table and selectTheme looks the slug up before writing it, so a theme
-- that exists in code but not here looks selectable and then silently
-- reverts. sort_order 141 follows Walnut (140), the last one added.
--
-- store_themes is a public read-only catalogue; this only adds a row.
insert into store_themes (slug, name, preview_url, is_active, sort_order)
values ('burgundy', 'Burgundy', '/themes/burgundy', true, 141)
on conflict (slug) do update
  set name = excluded.name, is_active = true, sort_order = excluded.sort_order;
