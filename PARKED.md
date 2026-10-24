# Parked for simplicity

Everything here is **built and working, just hidden** on `sellers-only` to keep Oakmonte simple
while it's young. Nothing was deleted: each one comes back by flipping one switch or uncommenting
one block. Bring them back one at a time as the product grows. `oakmonte-master-piece` still has
all of them.

When you park something new, add it here in the same commit.

## Switches (flip to `true`)

| What | Where | What it brings back |
| --- | --- | --- |
| Identifiers (SKU, barcodes) | `IDENTIFIERS_ENABLED`, `src/lib/features.ts` | The Identifiers card on every inventory page, plain product and each variant. SKUs and barcodes already saved are kept. |
| Wardrobe / Gallery | `WARDROBE_ENABLED`, `src/lib/features.ts` | The Wardrobe tab on profiles ("Gallery" on Artist stores) and /create/store-piece. |
| Offline videos | `OFFLINE_VIDEOS_ENABLED`, `src/lib/features.ts` | "Save for offline" in a post's share sheet and the /offline-videos page. |
| Necessities | `NECESSITIES_ENABLED`, `src/lib/product-form-flags.ts` | Material, colours, weight, size chart and linked content on the product form. |
| Product tags | `TAGS_ENABLED`, `src/lib/product-form-flags.ts` | Tags on the product form. |
| Follower count and community footer | `RETIRED_BLOCKS`, `src/components/store-themes/layout-presets.ts` | Remove `"stats"` / `"footer"` from the list to bring those storefront blocks back to every theme. |

## Commented out (uncomment the block)

| What | Where |
| --- | --- |
| Buyer-protection note on the product page | `src/components/store-themes/ProductPage.tsx` (search "Buyer-protection note") |
| Share title and share targets on Share profile | `src/components/profile/ShareProfileOverlay.tsx` (search "hidden for now") |
| Visit store button on the dashboard | `src/components/store/dashboard/IdentityBlock.tsx` (search "Visit store") |
| Product tag tool in the video editor | `src/components/studio/StudioToolbar.tsx` (search "Product tag switched off") |

## Not built yet (shows "coming soon")

| What | Where |
| --- | --- |
| Make Offer | Product page and the product tile's ⋯ menu say "Offers are coming soon". |
| Website visit from the theme preview | The preview's Open website button says "Website visit not yet authorised". |
