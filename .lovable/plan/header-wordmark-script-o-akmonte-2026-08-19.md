# Header wordmark: script "O" + "akmonte"

Make the OakmonteLanding header brand match the index page: the script O logo image reads as the "O", followed by the plain word "akmonte".

## What changes

- In `src/routes/OakmonteLanding.tsx`, the header brand link stops showing the rounded black logo tile plus "Oakmonte" (with "monte" in blue). Instead it shows the script O mark sitting on the text baseline, immediately followed by "akmonte" — no gap, matching the reference.
- The word uses the same font treatment as the index page: Inter, normal weight, tight tracking, sized to sit level with the mark. No blue-colored segment.
- Footer logo stays as it is.

## Technical notes

- Import `logoO from "@/assets/logo-o.png"` (the same transparent script mark the index header uses) and use it for the header only; `IMG_LOGO` stays for the footer.
- Update the `.oak .brand` CSS block: `align-items: baseline`, `gap: 0`; replace `.brand-mark` for the header with a `.brand-o` rule (height ~26–28px, `width:auto`, no background/padding/radius); `.brand .word` becomes normal weight, ~22px, `letter-spacing:-.01em`, and the nested blue `span` rule is dropped.
- Verify with a typecheck and a preview screenshot of the header.
