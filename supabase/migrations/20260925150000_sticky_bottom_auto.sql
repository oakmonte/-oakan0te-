-- sticky_bottom becomes three-state. null = the seller hasn't chosen, so the
-- storefront decides: stick when the grid holds more than 12 items (active
-- products or collections, whichever it shows -- see resolveStickyBottom in
-- layout-presets.ts). true/false = the seller's explicit choice, from the
-- save prompt or the theme card's toggle, which always wins.
--
-- Existing false values become null: until now false was only ever the
-- column default, not a choice anyone could be told apart from, and the
-- column is a few hours old. Explicit true (sellers who switched it on) stays.
alter table store_theme_customizations
  alter column sticky_bottom drop not null,
  alter column sticky_bottom drop default;

update store_theme_customizations
set sticky_bottom = null
where sticky_bottom = false;
