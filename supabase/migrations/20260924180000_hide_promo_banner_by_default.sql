-- createInitialEditState() now defaults hiddenBlocks to ["promo"] (the
-- promo/drop banner announces a drop that doesn't exist yet -- see
-- edit-types.ts). But PublicStorefront and ThemePreviewSheet both do
-- `{ ...createInitialEditState(), ...saved }`, so any store that already has
-- a store_theme_customizations row carries the OLD default, an explicit
-- `hidden_blocks: '{}'`, which would override the new default and keep
-- showing the banner. Backfill those rows the same way the new default would
-- have started them, without touching a row where a seller already chose to
-- hide something else -- or already restored "promo" themselves, which this
-- correctly leaves alone since the `not (... = any(...))` guard only touches
-- rows missing it.
--
-- store_theme_customizations has RLS disabled (deliberate, not an oversight
-- -- see 20260821192846_disable_rls_store_theme_customizations.sql), same as
-- stores/products/product_variants. A plain UPDATE from a migration bypasses
-- RLS regardless, but it's worth naming here so the next person auditing a
-- write against this table doesn't have to go looking for why.
update store_theme_customizations
set hidden_blocks = array_append(hidden_blocks, 'promo')
where not ('promo' = any(hidden_blocks));
