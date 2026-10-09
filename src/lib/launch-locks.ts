/** What's held back until launch, in one place.
 *
 *  Locked unless the build says otherwise: main (production), the
 *  sellers-only-locked preview and local dev all get the locks. Only a build
 *  with VITE_LAUNCH_UNLOCKED=true -- set in Vercel for the `sellers-only`
 *  branch's previews, where we build ahead of Paystack -- runs unlocked.
 *
 *  A switch rather than different code on two branches, so merging sellers-only
 *  work into the locked branch can never quietly carry an unlocked button into
 *  production. Default is locked: forgetting the variable fails safe. */
const unlocked = import.meta.env.VITE_LAUNCH_UNLOCKED === "true";

/** Buy Now shows "Sales are still locked until full launch". */
export const SALES_LOCKED = !unlocked;

/** The preview's Open website button shows "Website visits are not available
 *  for now" instead of opening /shop/$storeUsername. */
export const WEBSITE_VISITS_LOCKED = !unlocked;

/** The storefront header's share button shows "Sharing unavailable". (Its cart
 *  button follows SALES_LOCKED: "Carts unavailable".) */
export const SHARING_LOCKED = !unlocked;
