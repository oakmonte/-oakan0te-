import placeholderPhoto1 from "@/assets/Store theme placeholder images/photo_1_2026-08-22_00-20-52.jpg";
import placeholderPhoto2 from "@/assets/Store theme placeholder images/photo_2_2026-08-22_00-20-52.jpg";
import placeholderPhoto3 from "@/assets/Store theme placeholder images/photo_3_2026-08-22_00-20-52.jpg";
import placeholderPhoto4 from "@/assets/Store theme placeholder images/photo_4_2026-08-22_00-20-52.jpg";
import productPlaceholder from "@/assets/Store theme placeholder images/Products and collection image placeholder.jpg";

// Every image any store theme's preview/edit view can show before a seller
// uploads their own — the same 4 hero-slideshow photos and 1 collection/
// product placeholder every theme falls back to (see full-previews.tsx and
// full-preview-blocks.tsx). Imported here from the exact same paths so the
// URLs match what those components actually request — the browser cache
// only pays off if this warms the same bytes they'll ask for.
const STORE_THEME_IMAGE_URLS = [
  placeholderPhoto1,
  placeholderPhoto2,
  placeholderPhoto3,
  placeholderPhoto4,
  productPlaceholder,
];

let preloaded = false;

// Call once per app session (on sign-in / seller account creation — see
// __root.tsx) so that by the time a seller opens the theme picker, every
// theme's photos are already sitting in the browser cache instead of
// loading in front of them.
export function preloadStoreThemeAssets() {
  if (preloaded) return;
  preloaded = true;
  for (const url of STORE_THEME_IMAGE_URLS) {
    const img = new Image();
    img.src = url;
  }
}
