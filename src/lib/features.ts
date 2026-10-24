/** Features parked to keep Oakmonte simple for now -- built and working, just
 *  hidden. Flip a switch to `true` to bring that feature back; nothing else
 *  needs to change. */

/** The Wardrobe tab on profiles (shown as "Gallery" on Artist stores), backed
 *  by `store_pieces` and /create/store-piece. */
export const WARDROBE_ENABLED = false;

/** "Save for offline" in a post's share sheet and the /offline-videos page
 *  behind it (lib/offline-videos.ts). Parked: storefront buyers get "Save
 *  video" (watermarked, to their gallery) instead. */
export const OFFLINE_VIDEOS_ENABLED = false;

/** The Identifiers card (SKU and barcodes) on every inventory page -- a plain
 *  product and each variant alike. Parked to keep listing simple; existing
 *  SKUs and barcodes are kept and still saved, just not shown. */
export const IDENTIFIERS_ENABLED = false;
