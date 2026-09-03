import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { preloadStoreThemeAssets } from "../lib/preload-store-theme-assets";
import { useSession } from "../hooks/use-session";
import { useBuildFreshness } from "../hooks/use-build-freshness";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // Deliberately no interactive-widget=overlays-content here — that made
      // the on-screen keyboard cover the focused input instead of the page
      // resizing/scrolling to reveal it, on every route including onboarding,
      // which never compensates for it (unlike the camera/after-shot editor,
      // which does and needs it — see useLockedViewport). Normal pages get
      // the ordinary "keyboard pushes the page up" behavior every other site
      // has; the few fixed-layout screens that need overlays-content opt in
      // themselves via useLockedViewport.
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      // Every route is black; this tells the browser to color its own chrome
      // (iOS Safari's status bar and bottom toolbar, Android's address bar)
      // to match instead of defaulting to white at the page's edges.
      { name: "theme-color", content: "#000000" },
      // Without this, Android Chrome's "force dark" / "auto dark theme for
      // web contents" setting (on by default on plenty of Android devices)
      // treats an undeclared page as fair game and auto-inverts its colors —
      // most of the store is a deliberate white background, and that
      // heuristic doesn't know that. Declaring "light" here (not "light
      // dark") tells the browser this site has its own light design and
      // opts it out of that auto-theming entirely, until dark mode is built
      // for real. Paired with the `color-scheme: light` CSS declaration in
      // styles.css, which some engines honor more reliably than the meta tag
      // alone, especially for native form control theming.
      { name: "color-scheme", content: "light" },
      // Read back by useBuildFreshness to detect a newer deploy — see that
      // file. Must stay a plain meta tag (not injected via JS) since the
      // freshness check reads it out of a freshly-fetched page's raw HTML.
      { name: "build-id", content: __BUILD_ID__ },
      { title: "Oakmonte — Share your style" },
      {
        name: "description",
        content:
          "Oakmonte is an ecosystem for vetted sellers, honest creators and style curators — a content-driven fashion marketplace.",
      },
      { property: "og:title", content: "Oakmonte — Share your style" },
      {
        property: "og:description",
        content:
          "Oakmonte is an ecosystem for vetted sellers, honest creators and style curators — a content-driven fashion marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Oakmonte — Share your style" },
      {
        name: "twitter:description",
        content:
          "Oakmonte is an ecosystem for vetted sellers, honest creators and style curators — a content-driven fashion marketplace.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f8681243-4127-4116-ad0f-6a2b00b242ff/id-preview-d738abaa--20ab012d-c075-4dc0-92ec-39b0c7e4fbaa.lovable.app-1784296325715.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f8681243-4127-4116-ad0f-6a2b00b242ff/id-preview-d738abaa--20ab012d-c075-4dc0-92ec-39b0c7e4fbaa.lovable.app-1784296325715.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        // Core faces only. The ~35 store-theme families load on demand via
        // ensureThemeFont / ensureThemePickerFonts in store-themes/fonts.ts.
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Anton&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  useBuildFreshness();

  // Fires the instant a session exists — right after sign-in and equally
  // right after finishing seller account creation, since both land here
  // with a fresh session. Not gated to sellers specifically: the payload is
  // a handful of small placeholder photos, cheap enough that warming it for
  // every signed-in visitor beats adding a role check to decide who gets it.
  useEffect(() => {
    if (user) preloadStoreThemeAssets();
  }, [user]);

  // The seller dashboard (/store, /store/*) is white — everywhere else on
  // the site (profile, the public storefront at /store-profile/*, etc.) is
  // deliberately black at the scroll-bounce/toolbar edges (see the
  // html/body rule in styles.css). That rule is global, so it has to be
  // overridden per-route here rather than in the dashboard's own layout:
  // several /store/* routes (store.products_.new.tsx and friends) escape
  // the store layout's <Outlet /> entirely via the trailing-underscore
  // convention (see routes/README.md) and would never see a layout-scoped
  // effect. `/store-profile/...` starts with "/store" as a string but isn't
  // part of the dashboard, hence the explicit second check below.
  useEffect(() => {
    const isStoreDashboard = pathname === "/store" || pathname.startsWith("/store/");
    const bg = isStoreDashboard ? "#fff" : "";
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
