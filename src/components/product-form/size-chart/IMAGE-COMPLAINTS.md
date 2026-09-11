# Size-chart image audit

The following assets were visually reviewed on 2026-09-07. Opaque filenames are retained so existing user files are not renamed without a confirmed import migration.

| Filename                                   | Visual observation                                                                                                                         | Likely category              | Confidence | Decision                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `d14b3ab7-705b-4c48-abc3-6a259805b09d.png` | Quarter-zip pullover with long sleeves and ribbed cuffs                                                                                    | Sweatshirts or track jackets | Medium     | Not wired separately; choose the seller's category because the construction overlaps both.        |
| `0244efa2-4c1b-4f4d-a567-5dd73e0da9d0.png` | Long-sleeve button-down shirt; labels include shoulder, body length, chest, hem width, and sleeve rather than the shared chart's neck line | Dress Shirts                 | High       | Not wired; needs a dedicated five-line button-down definition before use.                         |
| `1abdc2d5-b4e4-45dd-afa3-7dca971e035e.png` | Bomber jacket; labels include shoulder, chest, body length, hem width, and sleeve                                                          | Bomber Jackets               | High       | Not wired; needs a jacket-specific definition.                                                    |
| `45c51773-30f3-4cd3-9f69-a85551fc973a.png` | Track jacket; labels include shoulder, chest, body length, hem width, and sleeve                                                           | Track Jackets                | High       | Not wired; needs a jacket-specific definition.                                                    |
| `abf40f57-07cd-4cb8-8620-98bfc1b4334b.png` | Sleeveless sweater vest; labels include shoulder, chest, body length, hem width, and armhole                                               | Vests                        | High       | Not wired; needs a sleeveless-top definition.                                                     |
| `image (11).jpg`                           | Camisole/tank silhouette with a reduced set of body measurements                                                                           | Camisoles or Tank Tops       | High       | Not wired; its labels do not match the five-line shared top chart.                                |
| `image (12).jpg`                           | Strapless/tube top with bust, waist, body length, and side/curve measurement                                                               | Tube Tops                    | High       | No Tube Tops category exists; needs a category decision and dedicated definition.                 |
| `image (13).jpg`                           | Long-sleeve blouse with bust, waist, body length, sleeve, and neck measurements                                                            | Blouses                      | High       | Not wired; needs a blouse-specific definition because its first two lines are not shoulder/chest. |
| `d29148e4-b788-4519-bf48-a840c56e9586.png` | Corset rear-view guide, matching the front corset artwork                                                                                  | Corsets & Bustiers           | High       | Near-duplicate rear view; the front guide is the canonical flow image.                            |
| `image (8).jpg`                            | Corset front view with lace panels and tie closure                                                                                         | Corsets & Bustiers           | High       | Near-duplicate of the registered corset guide; no separate category.                              |
| `image (9).jpg`                            | Corset rear view with lace-up sides                                                                                                        | Corsets & Bustiers           | High       | Near-duplicate rear view; retained as an audit asset.                                             |
| `image (10).jpg`                           | Long-sleeve bodysuit                                                                                                                       | Bodysuits                    | High       | Same measurement contract as the registered bodysuit guide; no separate category.                 |

## Removed 2026-09-10

| Filename                                   | Was wired to        | Now uses                                               |
| ------------------------------------------ | ------------------- | ------------------------------------------------------ |
| `053b7d8c-1e27-4fbe-8a98-88532ad416d1.png` | `activewear-tshirt` | `T-shirt-Guide.webp`                                   |
| `cf79b982-6990-45dd-8732-f0fe2f803ac2.png` | `sweatshirt`        | `bfe78330-f0f6-4946-afb6-288072187b84.png` (overshirt) |

Deleted at the owner's request. Both guides use `STANDARD_TOP_LINES` — the same five measurements
under the same five letters as the artwork they now borrow — so no chart lost its labelling. Note
that deleting an image without also updating `guide-images.ts` breaks the **production build only**:
the import resolves to `any` under `vite/client`'s module declaration, so `bun run typecheck` and
`bun run lint` both stay green while `bun run build` fails with `UNRESOLVED_IMPORT`, and Lovable then
refuses to preview or publish. Run `bun run build` after touching anything in this folder.

Search ambiguity addressed: `Volleyball Shorts` is now a distinct category leaf mapped to the generic shorts guide. `Dolphin Shorts` remains a separate exact category and is not used as a volleyball alias.

## Added 2026-09-11

The named 2026-09-11 batch was visually inspected. The following assets are wired to
dedicated guide keys and category leaves where the lettered contract is readable:

| Filename | Observed garment and contract | Guide key / decision |
| --- | --- | --- |
| `A-line-dress guide.png` | A-line dress; full length, chest, waist, hem | `a-line-dress`; wired to A-Line Dresses |
| `Bermuda-shorts guide.png` | Bermuda shorts; waist, hip, outseam, leg opening | `bermuda-shorts`; wired to Bermudas |
| `Biker-shorts guide.png` | Fitted biker shorts; waist, hip, outseam, leg opening | `biker-shorts`; wired to Biker Shorts |
| `Compression-shirt guide.png` | Fitted long-sleeve base layer; body, chest, shoulder, sleeve | `compression-shirt`; wired to Compression Shirts |
| `Flared-pants guide.png`, `Harem-pants guide.png`, `Leather-pants guide.png`, `Linen-pants guide.png`, `Palazzo guide.png`, `Parachute-pants guide.png`, `Leggings guide.png` | Trouser/legging silhouettes; waist, hip, inseam, leg opening | Dedicated keys; wired to their precise pants leaves |
| `Football-jersey guide.png` | Short-sleeve football jersey; body, chest, shoulder, sleeve | `football-jersey`; wired as the active four-line football contract. The earlier five-line `Football-Jersey-Guide.webp` remains in the folder but is no longer imported because its neck row does not match this batch. |
| `Gilet guide.png` | Sleeveless padded vest; body, chest, shoulder | `gilet`; wired to Gilets |
| `Henley guide.png` | Long-sleeve henley; body, chest, shoulder, sleeve | `henley`; wired to Henley Shirts |
| `Leather-Jacket guide.png`, `Parka guide.png`, `Track-jacket guide.png`, `Trucker-jacket guide.png` | Long-sleeve outerwear; body, chest, shoulder, sleeve | Dedicated keys; wired to precise jacket leaves |
| `Off-shoulder-dress guide.png`, `Shirt-dress guide.png`, `Slip-dress guide.png`, `wrap-dress guide.png` | Dress silhouettes with distinct body/chest/waist/hip contracts; sleeve where shown | Dedicated keys; wired to precise dress leaves |
| `Senator-wear guide.png` | Long-sleeve, collared, belted tunic/kurta-style garment; body, chest, shoulder, sleeve | `senator-wear`; wired to a new Senator Wear leaf. The name is regionally ambiguous and should be reviewed if sellers use a different product concept. |
| `Sports-bra guide.png` | Racerback sports bra; body, chest, hem | `sports-bra`; wired to Sports Bras |
| `Sweater-vest guide.png` | Sleeveless V-neck sweater vest; body, chest, shoulder | Near-duplicate of the already imported `sweater vest guide.png` with the same readable five-line contract. Existing import is retained; the new duplicate is not separately wired. |
| `Tunic guide.png` | Long-sleeve tunic; body, chest, shoulder, sleeve | `tunic`; wired to Tunics |
| `corset guide.png` | Structured corset; body, chest, waist | `corset`; wired to Corsets & Bustiers |
| `peplum-top guide.png` | Short-sleeve peplum top; body, chest, shoulder, sleeve, hem | `peplum-top`; wired to Peplum Tops |

The earlier `Football-Jersey-Guide.webp` is retained as an unimported comparison asset. Its
five-line contract is not compatible with the new four-line `Football-jersey guide.png`, so the
active category map now uses the new PNG and no longer asks sellers for a nonexistent neck row.

## Added 2026-09-10

The following newly added assets were visually checked against their filenames before wiring:

| Filename                  | Visual observation                                                                                                               | Decision                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `blouse guide.jpg`        | Camisole/tank silhouette, not a conventional blouse; its letter labels also repeat `a` for two different spans.                  | Not wired. Use the existing Tank Tops or Camisoles category only after confirming the intended garment and measurement contract. |
| `Bodycon-dress guide.png` | One-piece long-sleeve garment with a possible trouser-leg/inseam construction; it may be a jumpsuit rather than a bodycon dress. | Not wired until the garment identity is confirmed; Bodycon Dresses remains on manual measurements.                               |
| `Jumpsuit-guide.png`      | One-piece long-sleeve garment with full-body and leg measurements.                                                               | Mapped to Jumpsuits; verify against the Bodycon asset before removing either guide.                                              |
| `swimsuit guide.jpg`      | Long-sleeve turtleneck top, not a swimsuit.                                                                                      | Used as the turtleneck artwork because the visual garment is clear; filename remains unchanged pending an explicit rename.       |
| `turtle neck guide.png`   | Sleeveless tank top, not a turtleneck.                                                                                           | Not wired; do not use this image for turtleneck measurements.                                                                    |
| `Mini-dress guide.png`    | Dress silhouette with long sleeves; the pictured hem may be longer than a typical mini dress.                                    | Mapped provisionally to Mini Dresses from the filename; review if the intended category is a general dress.                      |

The remaining added guides were visually consistent with their names and are wired to matching categories: basketball jersey, cardigan, cargo pants, crop top, hoodie, jumpsuit, mini skirt, pleated skirt, puffer jacket, romper, short-sleeve shirt, sports shorts, sweater vest, sweatshirt, tank top, turtleneck, and varsity jacket. Bodycon Dresses and Swimsuit remain on manual measurements until their artwork is confirmed.
