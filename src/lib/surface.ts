/** Which of the app's visual surfaces a pathname belongs to.
 *
 *  The app is black almost everywhere — the feed, the camera, the studio,
 *  messages, the public storefront. Two areas are deliberately not: the seller
 *  dashboard and the publish screen. That distinction drives three things that
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
export type Surface = "store" | "publish" | null;

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
  return null;
}
