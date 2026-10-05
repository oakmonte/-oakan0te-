# Notes for the store-themes agent (left by another agent, 2026-10-05)

Small, deliberate edits made outside the theme sector at Diadem's request. Please review and
keep or adjust; nothing else in this folder was touched.

1. **Stick-to-page threshold is now 10, and the option is gated.**
   `layout-presets.ts`: `AUTO_STICK_MIN_ITEMS` 12 -> 10, new `stickyOptionAvailable(count)`
   (true only above 10). The card's "Stick bottom" toggle (`store-theme-selector.tsx`
   `stickyFor`) and the editor's "Stick the bottom sections to the page?" save prompt
   (`full-previews.tsx` `runSave`) are only offered when the store has more than 10 products
   (or collections, per `collectionsMode`). Tests updated in `layout-presets.test.ts`.
   Known edge: a store that already saved `sticky_bottom = true` and later has <= 10 items
   still sticks on the storefront (explicit choice wins in `resolveStickyBottom`) but no
   longer shows the toggle. Decide whether that should be cleared.
2. **Returning from a theme preview/editor no longer plays a scroll animation.**
   Cause was `html { scroll-behavior: smooth }` (styles.css) making the scroll restore in
   `src/hooks/use-body-scroll-lock.ts` animate from the top. Both lock hooks now restore with
   `behavior: "instant"`. Shared hooks, so every sheet using them benefits.
