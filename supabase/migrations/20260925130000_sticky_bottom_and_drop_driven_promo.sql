-- Two changes to store_theme_customizations, both from the same round of
-- theme work.
--
-- 1. sticky_bottom: the seller's choice to pin the blocks that sit BELOW the
--    collections/products grid (which ones depends on the layout) to the
--    bottom of the screen, so a big catalogue scrolls under them instead of
--    burying them. Per theme customization, like every other editor choice.
--    Off by default: a small store shouldn't have its grid covered.
alter table store_theme_customizations
  add column if not exists sticky_bottom boolean not null default false;

-- 2. Undo 20260924180000_hide_promo_banner_by_default.sql. That backfill put
--    'promo' in every row's hidden_blocks because the banner announced a
--    drop that didn't exist. The banner is now driven by the drops table
--    itself: it renders only while the store has a real drop that hasn't
--    ended (see useStoreLiveDrop). Left in place, the backfilled 'promo'
--    would keep the banner hidden even after a seller announces a real drop.
--    hidden_blocks goes back to meaning only "the seller removed this".
--
--    Accepted cost: a seller who removed the banner themselves before the
--    backfill can't be told apart from a backfilled row, so theirs comes
--    back too. That only matters once they have a live drop, and they can
--    remove it again. Pre-launch, so no real storefronts are affected.
update store_theme_customizations
set hidden_blocks = array_remove(hidden_blocks, 'promo')
where 'promo' = any(hidden_blocks);

-- RLS is disabled on this table (see
-- 20260821192846_disable_rls_store_theme_customizations.sql); this changes
-- nothing about that.
