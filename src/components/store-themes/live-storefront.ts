import { createContext, useContext, useEffect, useRef } from "react";

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

/** The live storefront's full-screen pages (product, collection). They count
 *  as part of the Shop tab: while one is open the bottom bar stays on top of
 *  it with Shop lit, and any tab in the bar closes it. Each page registers its
 *  own animated close; PublicStorefront provides this. Null elsewhere (theme
 *  previews, the social Shop feed), where the hook below does nothing. */
export const StorefrontPagesContext = createContext<{
  register: (close: () => void) => () => void;
} | null>(null);

/** Registers a storefront page with the bottom bar while `active`. */
export function useStorefrontPage(active: boolean, close: () => void) {
  const pages = useContext(StorefrontPagesContext);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!pages || !active) return;
    return pages.register(() => closeRef.current());
  }, [pages, active]);
}
