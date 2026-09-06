# Loading screen copy and typography update

## What we're changing

Update the black session-loading screen (the one that currently says **"One moment…"**) so it communicates Oakmonte's value while the app checks the user session.

## Scope

- `src/components/onboarding/OnboardingShell.tsx` — `OnboardingChecking` component only.
- `src/routes/__root.tsx` — add one Google Font to the existing core-fonts link.

## Plan

1. **Headline copy**
   - Replace `"One moment…"` with `"we take the headaches so you stay creative."`
   - Render it in a striking, "crazy" display font: **Rubik Glitch** (added to the Google Fonts link in `__root.tsx`).
   - Keep it centered, white/light on the existing black `bg-brand-bg` background, at a readable size.

2. **Subtext**
   - Add `"loading….."` directly beneath the headline.
   - Use the existing normal body font (Inter/system) at a smaller size and lower opacity so it reads as a status line.

3. **Layout / motion**
   - Keep the full-screen centered flex layout.
   - Optionally add a very subtle fade/slide-in so the new line appears with a touch of polish, but keep it short since this screen is usually visible for <1s.

## Out of scope

- No changes to the welcome page typing animation.
- No changes to route logic or session checking.
- No other loading placeholders in the app.
