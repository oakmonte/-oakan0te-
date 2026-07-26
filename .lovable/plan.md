## Problem

`public/favicon.ico` is an 826 KB PNG file with a `.ico` extension (the Oakmonte O logo renamed). Browsers can't parse it as an ICO, so they fall back to the default Lovable icon.

## Fix

1. Save the Oakmonte O mark as a real PNG at `public/favicon.png` (copy from the existing `oakmonte-o-mark.png` asset, which is already 162 KB and square).
2. Delete the invalid `public/favicon.ico`.
3. In `src/routes/__root.tsx`, replace the favicon link:
   ```ts
   { rel: "icon", type: "image/png", href: "/favicon.png" }
   ```
4. Hard-refresh the preview (browsers cache favicons aggressively — a normal reload often won't pick up the change).

No other files touched.