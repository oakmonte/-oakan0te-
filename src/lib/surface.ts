/** Which of the app's visual surfaces a pathname belongs to.
 *
 *  The app is black almost everywhere — the feed, the camera, the studio,
 *  the public storefront. Three areas are deliberately not: the seller
 *  dashboard and the publish screen, and /home + /messages, which follow the
 *  phone's light/dark setting (the "social" surface). That distinction drives three things that
 *  used to be decided in three different places and could drift apart:
 *
 *    1. `<html data-surface>`, which scopes the dashboard's light/dark tokens
 *       (see the --sd-* block in styles.css).
 *    2. The scroll-bounce / toolbar edge colour (--oak-edge, same file).
 *    3. The `theme-color` meta pair rendered in __root.tsx's RootShell, which
 *       is what iOS and Android paint their own chrome with.
 *
 *  A pure function on the pathname rather than a route match, deliberately:
 *  it is one answer for the whole app, it is testable without a router, and it
 *  cannot drift if the route tree is reshaped. */
export type Surface = "store" | "publish" | "social" | null;

export function surfaceForPathname(pathname: string): Surface {
  // The trailing slash is load-bearing. "/store-profile/diadem" is the PUBLIC
  // storefront, not the seller dashboard, and it starts with "/store" as a
  // plain string -- matching it here would paint a shopper's storefront in the
  // dashboard's chrome. Matching "/store/" instead of "/store" excludes it,
  // while "/store/products/new" and friends still match: the trailing-underscore
  // routes are nested under the /store route, they only opt out of an
  // intermediate layout (see routes/README.md).
  if (pathname === "/store" || pathname.startsWith("/store/")) return "store";
  // The publish screen is white, a deliberate exception to the rest of the
  // create/after-shot flow (camera, filters, crop) which stays black like every
  // other camera-app editor.
  if (pathname === "/create/after-shot/publish") return "publish";
  // Home and Messages follow the phone's light/dark setting (the chat-* token
  // block in styles.css). Exact matches: /home's Explore overlay is state on
  // the same route and paints its own black, and nothing nested under either
  // path is part of this.
  if (pathname === "/home" || pathname === "/messages") return "social";
  return null;
}

/** Dashboard routes held in the LIGHT scheme even when the phone is in dark.
 *
 *  Two different reasons feed this list -- don't collapse them back into one
 *  comment, they get deleted on different conditions:
 *
 *  1. Temporary, and deliberately narrow. /store/products/new,
 *     /store/products/:id and /store/collections/new render the shared
 *     product-form components as the WHOLE page, top to bottom, and
 *     product-form (39 files) has not been moved onto the --sd-* tokens yet
 *     -- it is shared with the create flow and under active work by another
 *     developer, so converting it is being agreed separately rather than
 *     done in passing. Left in dark, its hardcoded dark text would sit on a
 *     dark page and simply disappear. Delete these entries (and this
 *     paragraph) once product-form is on the tokens.
 *
 *  2. A permanent product decision, independent of any conversion. The theme
 *     picker: every card is a swatch of a storefront's real colours, and half
 *     of those are dark grounds that read as one black smear on a dark page.
 *     /store/drops/new and /store/drops/:id, since 2026-09-25: unlike the
 *     product-form hold above, these were already written in --sd-* tokens
 *     (only the embedded cover-photo picker wasn't) and used to follow the
 *     phone -- Diadem asked for them to stop, so they read the same as New
 *     Product/New Collection instead of switching dark while everything
 *     alongside them stays light. Don't delete these when group 1 goes.
 *
 *  Routes that use product-form only as a modal/sheet over a scrim, or as one
 *  inline piece of an otherwise --sd-* page, are NOT held: a white sheet (or a
 *  white MediaSection) over a dark page is inconsistent but perfectly
 *  legible, and holding the WHOLE page in light to avoid it would cost far
 *  more than it saves. */
export function isHeldLight(pathname: string): boolean {
  if (pathname === "/store/theme") return true;
  if (pathname === "/store/products/new") return true;
  if (pathname === "/store/collections/new") return true;
  if (pathname === "/store/drops/new") return true;
  // /store/products/:id -- but not the two sibling screens that share the
  // prefix and are fully converted.
  const productId = /^\/store\/products\/([^/]+)$/.exec(pathname);
  if (productId && productId[1] !== "upload" && productId[1] !== "newcomer") return true;
  // /store/drops/:id -- same product decision as /store/drops/new above.
  return /^\/store\/drops\/[^/]+$/.test(pathname);
}
