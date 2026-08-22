# Plan: Hero CTA fixes and spacing

## What we’ll change

1. **Fix the disappearing CTA text on hover / click / tap**
   - Audit the `.hero-cta-card` hover, active, and focus states in `src/routes/index.tsx`.
   - Keep the `transform: translateY(-2px)` lift animation.
   - Ensure the label and hint text remain fully readable across all three card variants (`card-blue`, `card-outline`, `card-tint`) during hover, active, and touch-sticky hover states.
   - If the current color inversion is causing the text to vanish (e.g. black label on blue background or white hint on white background during transition), replace it with a subtler state change that preserves contrast: slightly darker/lighter background shift, border-color change to brand blue, and explicit per-element text colors that never match the background.

2. **Increase vertical spacing around the CTA stack**
   - Add more `margin-top` between the tagline `THE WORLD'S FIRST CONTENT OPTIMISED MARKETPLACE.` and the CTA stack.
   - Add more `margin-bottom` / `padding-bottom` between the CTA stack and the hero media image below it.
   - Keep the existing top/bottom border lines on the stack; just increase the gaps above and below the whole block.

3. **Add helper copy under the CTAs**
   - Insert a new small text element directly after the `.hero-cta-stack` (but still well above `.hero-media`).
   - Text: `"You can switch between these later"`.
   - Style it as muted secondary copy (smaller font, gray color, relaxed line-height) so it reads as a friendly note, not a new CTA.

## Files to edit

- `src/routes/index.tsx` — JSX for the helper text and CSS for hover states + spacing.

## Verification

- Run `bun run typecheck` and `bun run lint`.
- Check the live preview at `/` on desktop and mobile viewports:
  - Hover/click/tap each CTA — label and hint must stay visible.
  - Confirm extra space above the CTAs and below them before the hero image.
  - Confirm `"You can switch between these later"` appears beneath the three cards.
