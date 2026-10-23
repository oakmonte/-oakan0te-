import { createContext, useContext, useEffect } from "react";

/** The seller dashboard's bottom nav shows on every /store page. A page with a
 *  bottom bar of its own (an order's Book courier bar, the Products and
 *  Collections select bar) hides it while that bar is up, so the two never
 *  stack. The layout counts the pages asking, so overlapping asks can't
 *  bring the nav back early. */
export const StoreNavHideContext = createContext<() => () => void>(() => () => {});

/** Hide the store nav while `hide` is true. */
export function useHideStoreNav(hide: boolean) {
  const register = useContext(StoreNavHideContext);
  useEffect(() => (hide ? register() : undefined), [hide, register]);
}
