/** What's held back until launch, in one place.
 *
 *  Locked unless the build says otherwise: `sellers-only` (Vercel production),
 *  the main / sellers-only-locked previews and local dev all get the locks.
 *  Only a build with VITE_LAUNCH_UNLOCKED=true runs unlocked -- today that's
 *  the `sellers-only-test` preview (with Paystack test / Shipbubble sandbox
 *  keys), where checkout is tested ahead of launch. Launch day = add the
 *  variable (and live keys) to Production; no code change.
 *
 *  A switch rather than different code on two branches, so sellers-only and
 *  sellers-only-test carry identical code and an unlocked button can never
 *  quietly reach production. Default is locked: forgetting the variable fails
 *  safe. */
const unlocked = import.meta.env.VITE_LAUNCH_UNLOCKED === "true";

/** Buy Now shows "Sales are still locked until full launch". */
export const SALES_LOCKED = !unlocked;

/** The preview's Open website button shows "Website visits are not available
 *  for now" instead of opening /shop/$storeUsername. */
export const WEBSITE_VISITS_LOCKED = !unlocked;

/** The storefront header's share button shows "Sharing unavailable". (Its cart
 *  button follows SALES_LOCKED: "Carts unavailable".) */
export const SHARING_LOCKED = !unlocked;
