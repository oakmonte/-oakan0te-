-- "story" (Interactive Story) was removed from the app entirely; deactivate
-- rather than delete so any historical store_theme_customizations row tied to
-- it (theme_slug FK) doesn't get orphaned by a cascade.
update store_themes set is_active = false where slug = 'story';

insert into store_themes (slug, name, preview_url, sort_order, config) values
  ('verdant', 'Verdant Noir', '', 5, '{"eyebrow":"BOTANICAL · MOODY · GROUNDED","description":"Deep black grounded by a single living green — for brands rooted in craft.","accent":"#3fae63","demoBrand":"Fern & Co."}'::jsonb),
  ('monochrome', 'Monochrome', '', 6, '{"eyebrow":"STARK · GRAPHIC · TIMELESS","description":"Just black and white — nothing to distract from the product.","accent":"#111111","demoBrand":"NOIR/BLANC"}'::jsonb),
  ('gilded', 'Gilded', '', 7, '{"eyebrow":"OPULENT · RICH · REGAL","description":"Black lacquered in gold, for stores that want to feel like an occasion.","accent":"#d4af37","demoBrand":"Aurum House"}'::jsonb),
  ('obsidian', 'Obsidian', '', 8, '{"eyebrow":"MINIMAL · MONOLITHIC · SEVERE","description":"One shade of black, layered on itself — as pared-back as a storefront gets.","accent":"#6b6b6b","demoBrand":"VOID"}'::jsonb);
