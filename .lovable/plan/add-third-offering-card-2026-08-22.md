# Add third offering card

## Goal

Restore the "Pick your path" section to three cards by adding the missing creator card and updating the grid layout so all three sit correctly on desktop and stack cleanly on mobile.

## Changes

1. **Content — `src/routes/index.tsx` offering section**
   - Insert a third `Reveal`/`offer-card` after the existing shopper card.
   - Tag: `For Creators and Creatives`
   - Heading: `Make money from your content`
   - Body (matching the voice of the other two cards): explain that creators can tag products in their content and earn when their audience buys, with no invoices or middlemen.
   - CTA button: `Start creating!`
   - Stars line: `Loved by our early creators`

2. **Layout — offering-grid CSS in `src/routes/index.tsx`**
   - Change the desktop breakpoint from `1fr 1fr` to `repeat(3, 1fr)` so three cards share one row.
   - Keep the mobile single-column stack and existing 24px gap.
   - Preserve the `.offer-card.blue` styling on the first (seller) card; the new creator card should use the default white/card styling like the shopper card.

## Out of scope

No changes to copy on the existing seller or shopper cards, and no changes to other sections.
