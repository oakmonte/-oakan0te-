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
import { markStandalone } from "@/lib/standalone";
import { captureInstallPrompt, stampInstalledApp } from "@/lib/installed-app";
import { useBuildFreshness } from "../hooks/use-build-freshness";
import { PostUploadToast } from "../components/PostUploadToast";
import { ProductSaveToast } from "../components/ProductSaveToast";
import { BackgroundUploadToast } from "../components/BackgroundUploadToast";
import { setLastNonCreateRoute } from "../lib/last-visited-route";

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
      // Tells the browser to color its own chrome (iOS Safari's status bar and
      // bottom toolbar, Android's address bar) to match the page instead of
      // defaulting to white at its edges.
      //
      // This said "every route is black" and that stopped being true: auth,
      // the whole onboarding flow and /store are white now, and each was
      // inheriting a black status strip above a white screen (reported on
      // device 2026-09-16). Those routes set #ffffff in their own head(). This
      // root value is the default for the dark screens -- the feed, camera and
      // studio -- so a NEW white route must declare its own, or it inherits a
      // black band. If white ever becomes the majority, flip this and let the
      // dark routes override instead.
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
      // Installed-to-Home-Screen behaviour on iOS, which reads none of the
      // manifest's display fields. Without these, "Add to Home Screen" makes a
      // bookmark that opens in Safari — same chrome, same per-visit camera
      // prompt, none of the point.
      //
      // The install matters for more than looks: a standalone iOS web app has
      // its own permission store, so the camera grant survives between
      // launches instead of being asked for on every visit.
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      // NOT black-translucent. That ran the page under the status bar and made
      // iOS paint white text there always — which put an unexplained black
      // strip above the white screens and would have hidden the clock on them.
      // `default` leaves the strip to the page's own theme-color, which is
      // already set per route (#000000 at the root, #ffffff on /store and the
      // publish screen), so the status bar matches whatever screen you are on
      // instead of fighting it.
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Oakmonte" },
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
      { rel: "manifest", href: "/manifest.webmanifest" },
      // iOS ignores the manifest's icons entirely and reads this instead.
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        // Core faces only. The ~35 store-theme families load on demand via
        // ensureThemeFont / ensureThemePickerFonts in store-themes/fonts.ts.
        // 900 is DescriptionSheet's "heavy" bold level -- without it loaded,
        // font-weight:900 silently falls back to the nearest available face
        // (700, plain bold), making the heavy level visually indistinguishable
        // from the medium level a tap before it.
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Anton&family=Space+Grotesk:wght@300;400&display=swap",
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

  // Publishes "installed app or browser tab" onto <html data-standalone>, for
  // the CSS that has to tell them apart — see standalone.ts. Runs once here
  // rather than per-screen so there is one answer for the whole app.
  useEffect(markStandalone, []);

  // Has to be here rather than on the screen that offers the install:
  // `beforeinstallprompt` fires during page load, so a listener added when
  // /store/get-the-webapp mounts has already missed it. See installed-app.ts.
  useEffect(captureInstallPrompt, []);

  // Records the install against the account the first time the app is opened
  // standalone. Runs on every session change rather than once, because on iOS
  // the installed app starts signed out -- the launch that can finally write
  // this is the one *after* they sign in, not the first one.
  useEffect(() => {
    void stampInstalledApp(user);
  }, [user]);

  // Fires the instant a session exists — right after sign-in and equally
  // right after finishing seller account creation, since both land here
  // with a fresh session. Not gated to sellers specifically: the payload is
  // a handful of small placeholder photos, cheap enough that warming it for
  // every signed-in visitor beats adding a role check to decide who gets it.
  useEffect(() => {
    if (user) preloadStoreThemeAssets();
  }, [user]);

  // Lets the camera's exit button return to wherever the seller actually
  // came from (see last-visited-route.ts) instead of a hardcoded page — the
  // camera/after-shot flow itself is excluded so stepping between its own
  // sub-routes (filters, crop, publish, ...) never overwrites this with
  // another camera route.
  useEffect(() => {
    if (!pathname.startsWith("/create")) setLastNonCreateRoute(pathname);
  }, [pathname]);

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
    // The publish/"New post" screen is white too — a deliberate exception to
    // the rest of the create/after-shot flow (camera, filters, crop, etc.)
    // which stays black like every other camera-app editor.
    const isPublishPage = pathname === "/create/after-shot/publish";
    const bg = isStoreDashboard || isPublishPage ? "#fff" : "";
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PostUploadToast />
      <ProductSaveToast />
      <BackgroundUploadToast />
    </QueryClientProvider>
  );
}
