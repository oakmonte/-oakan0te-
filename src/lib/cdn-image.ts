/** Resized copies of seller photos from the Bunny pull zone (cdn.oakmonte.store),
 *  via Bunny Optimizer's `?width=` / `?quality=` query parameters.
 *
 *  OFF until Bunny Optimizer is switched on for the pull zone (Bunny dashboard
 *  -> Pull Zones -> cdn.oakmonte.store -> Optimizer, with "Automatic WebP").
 *  Checked 2026-11-03: the zone ignores `?width=` and returns the original --
 *  a 2MB PNG for a product tile -- and caches each query string separately,
 *  so turning this on before the Optimizer would make every photo a fresh
 *  full-size download. With it on, a tile is tens of KB instead of megabytes.
 *  Flip to true once `curl -I "https://cdn.oakmonte.store/<any photo>?width=360"`
 *  answers with a small Content-Length (and image/webp for a WebP Accept). */
export const CDN_RESIZE_ENABLED = false;

const CDN_HOST = "cdn.oakmonte.store";

/** Widths offered to the browser; it picks one from `sizes` and the screen's
 *  pixel density. 360 covers a 2-column tile on a phone at 2x. */
const WIDTHS = [360, 540, 720, 1080, 1440] as const;

function sized(url: URL, width: number): string {
  const u = new URL(url);
  u.searchParams.set("width", String(width));
  u.searchParams.set("quality", "80");
  return u.toString();
}

/** A `srcset` for a photo on our CDN, or undefined (use `src` as-is) for
 *  anything else -- bundled placeholders, blob: previews, other hosts -- and
 *  while resizing is off. */
export function cdnSrcSet(src: string): string | undefined {
  if (!CDN_RESIZE_ENABLED) return undefined;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return undefined;
  }
  if (url.host !== CDN_HOST) return undefined;
  return WIDTHS.map((w) => `${sized(url, w)} ${w}w`).join(", ");
}

/** `sizes` for the storefront's image slots: what each slot's CSS width is. */
export const IMAGE_SIZES = {
  /** The full-width hero slideshow. */
  hero: "100vw",
  /** A hero card (desktop "cards" style and the ring). */
  heroCard: "(min-width: 768px) 40vw, 80vw",
  /** A catalog tile: two columns on a phone, four on a wide screen. */
  tile: "(min-width: 1024px) 25vw, 50vw",
} as const;
