Update the hero section on `/OakmonteLanding` to replace the email capture bar and "Show me how!" button with a vertically stacked, clearly demarcated CTA section.

## What we'll change
- Remove the `hero-cta-row` containing the email form and the "Show me how!" ghost button from the hero section.
- Add a new full-width section directly below the hero copy that contains three vertically stacked CTAs:
  1. **Set Up A Store** → links to `/set-up-store`
  2. **Become A Creator** → links to `/become-a-creator`
  3. **Define Your Wardrobe** → links to `/become-a-curator`
- Use TanStack `Link` components for client-side navigation instead of plain `<a>` tags.

## Visual approach
- Keep the existing Oakmonte Landing aesthetic: black (`#0A0A0A`), white, and the blue accent (`#2151F5`), Inter + Archivo Black typography.
- The new CTA section will be a vertically demarcated block — top and bottom border lines using `var(--line)` — to separate it clearly from the hero text and the media below.
- CTAs will be large, full-width rectangles with rounded corners (`border-radius: 18px` or `rounded-2xl`), not pill shapes.
- Each CTA will have a bold uppercase label, a subtle supporting one-liner, and an arrow/"→" indicator.
- Hover state: lift slightly (`translateY(-2px)`) and switch background to the Oakmonte blue, keeping the transition consistent with the existing `.cta-btn` hover.
- Add a small "No catch — free to get started" reassurance line below the CTAs, matching the trust tone used elsewhere.

## Files to edit
- `src/routes/OakmonteLanding.tsx` — update the hero JSX and add inline styles for the new CTA section.
- Clean up the now-unused `.email-capture` and `.hero-cta-row` CSS if appropriate, but keep the rest of the page untouched.

## Verification
- Run the dev build and preview the `/OakmonteLanding` route to confirm the email bar is gone, the three CTAs are visible, and each links to the correct route.
- Check that the section is vertically well-demarcated and the CTAs use rounded rectangles with consistent hover animation.