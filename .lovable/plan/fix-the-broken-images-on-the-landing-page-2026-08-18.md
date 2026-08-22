# Fix the broken images on the landing page

## What's wrong

`src/routes/OakmonteLanding.tsx` hardcodes four CDN image URLs (logo, hero, story, scale). None of those asset IDs exist in this project — every one returns 404, so all four images render blank.

## Fix

Reuse real files instead of generating new ones:

- **Logo** — point to the logo already in the project (`src/assets/oakmonte-o-mark.png.asset.json`), the same one the main homepage uses.
- **Hero / story / scale** — download the two editorial photos still hosted on the original style-connect-start site (`hero-editorial`, `fabric-detail`), upload them to this project's CDN, and use them for the hero and story slots. The third slot ("scale") has no counterpart on the source site — I'll reuse one of the two rather than invent an image, unless you'd rather supply your own.

No layout, styling, or copy changes.

## Technical notes

- `curl` the two JPGs, `lovable-assets create` each, commit the `.asset.json` pointers under `src/assets/`.
- Replace the four `IMG_*` constants in `OakmonteLanding.tsx` with imports of those pointer files.
- Verify all image URLs return 200 in the preview afterwards.
