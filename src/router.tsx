import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Cross-fades/slides same-document navigations where the browser supports
    // it. Direction comes from the data-nav-dir attribute on <html> (see
    // nav-direction.ts), not from view-transition types, because a
    // history.go() pop never routes through navigate().
    defaultViewTransition: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
