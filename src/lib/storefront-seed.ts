import { createContext, useContext } from "react";
import type { StorefrontData } from "./storefront-data";

// Kept apart from storefront-data.ts (which imports the hooks' fetch code) so
// the hooks can import this without an import cycle.

/** Set by /shop/$storeUsername around PublicStorefront. */
export const StorefrontDataContext = createContext<StorefrontData | null>(null);

/** The preloaded data, but only if it's for `storeId` -- a hook asked about
 *  some other store (or with none) gets null and fetches as it always did. */
export function useStorefrontSeed(storeId: string | null | undefined): StorefrontData | null {
  const data = useContext(StorefrontDataContext);
  return data && storeId && data.store.id === storeId ? data : null;
}
