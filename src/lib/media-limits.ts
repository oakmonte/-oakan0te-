// Upload and length limits shared by the screens that enforce them and, for
// posts, the server that re-checks them (api.posts.ts).

/** Photos on a product (the base product; collections share the picker). */
export const MAX_PRODUCT_PHOTOS = 8;
/** Photos on one variant. */
export const MAX_VARIANT_PHOTOS = 8;
/** Items in one carousel post. */
export const MAX_CAROUSEL_ITEMS = 50;
/** Clips on one video editor timeline: plenty for a short post, and keeps the
 *  export (decoded and re-encoded on the phone) within what a phone can do. */
export const MAX_VIDEO_EDITOR_CLIPS = 20;
/** A product description, in characters (Instagram captions stop at 2,200). */
export const MAX_DESCRIPTION_CHARS = 2000;
