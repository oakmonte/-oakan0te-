Fix the Apple logo SVG shape on the auth pages.

1. Replace the custom `AppleIcon` path in `src/routes/set-up-store.tsx`, `src/routes/become-a-creator.tsx`, and `src/routes/become-a-curator.tsx` with a cleaner, standard Apple glyph that removes the unnecessarily extended top-right curve.
2. Extract `GoogleIcon` and `AppleIcon` into a shared `src/components/auth-icons.tsx` component so all three auth pages use the same icons and stay consistent.
3. Verify the updated icon renders correctly in the preview and matches the reference proportions.