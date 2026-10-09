import { createContext } from "react";

/** True only inside PublicStorefront -- the real storefront shoppers see on
 *  a profile. Theme previews and the editor render the same blocks without
 *  it, so shopper-only behaviour (the "sales are locked" notice on a product
 *  tap) stays out of the seller's way there. */
export const LiveStorefrontContext = createContext(false);

/** The live storefront's product search: what the header's search bar holds,
 *  read by the catalogue grid to narrow its tiles. Empty = everything. */
export const StorefrontSearchContext = createContext<{
  query: string;
  setQuery: (q: string) => void;
} | null>(null);
