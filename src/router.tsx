import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Deliberately NO defaultViewTransition. It was tried and reverted on
    // 2026-09-22: the flag wraps EVERY navigate() in startViewTransition, so a
    // search-param change, a tab tap and a replace all got the same 280ms
    // full-screen slide as a real push -- "everything I tap triggers a swipe".
    //
    // It cannot be made symmetric either. A history.go() pop never routes
    // through navigate(), so a forward slide can be armed but the matching
    // back one cannot, and any direction flag left on <html> goes stale and
    // slides the next unrelated navigation the wrong way.
    //
    // If page transitions come back, they need a per-call-site opt-in on real
    // pathname changes only, and a direction set synchronously before the
    // navigation -- not a global default.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
