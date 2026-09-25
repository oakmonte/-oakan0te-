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
import { attachNavStack } from "@/lib/nav-stack";
import { EdgeSwipeBack } from "@/components/EdgeSwipeBack";
import { isHeldLight, surfaceForPathname } from "@/lib/surface";
import { useDarkOverlayActive } from "@/lib/dark-overlay";

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
  // Rendered inside the router tree (around the root match), so this re-runs on
  // navigation AND the attribute below is present in the SSR'd HTML -- which is
  // the point. Deciding the surface in an effect instead, as this used to, meant
  // every cold load of the white dashboard painted black first and was only
  // corrected a frame after hydration.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const surface = surfaceForPathname(pathname);
  // A few dashboard screens are held in the light scheme until the shared
  // product-form components are on the tokens -- see isHeldLight().
  const heldLight = surface === "store" && isHeldLight(pathname);
  // A black full-screen overlay over a light screen (the Explore feed on
  // /home) — status strip and scroll edge go black with it. See dark-overlay.ts.
  const darkOverlay = useDarkOverlayActive();
  return (
    // Drives the dashboard's light/dark tokens, the scroll-bounce edge colour
    // (--oak-edge) and `color-scheme`, all in styles.css. See lib/surface.ts.
    <html
      lang="en"
      data-surface={surface ?? undefined}
      data-scheme={heldLight ? "light" : undefined}
      data-overlay={surface === "social" && darkOverlay ? "dark" : undefined}
    >
      <head>
        {/* The dashboard (and, below, the social surface) have both a light
            and a dark theme, so they need a theme-color per scheme -- and
            a `media` pair cannot be expressed through head(), because TanStack
            dedupes <meta> by `name` alone (media is not part of the key) and
            collapses the two into whichever came last. Hence literal JSX, here,
            ahead of <HeadContent />.

            Deliberately NOT rendered for other surfaces. A browser uses the
            FIRST theme-color in tree order whose media matches, so an
            unconditional pair here would outrank the sixteen auth/onboarding
            routes that declare their own #ffffff in head() -- handing every one
            of them back the black status strip above a white screen that was
            fixed on 2026-09-16. Those routes, and the root's #000000 default
            for the dark screens, keep working exactly as before. */}
        {surface === "store" && (
          <>
            <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
            {/* The dashboard's dark page background (--sd-bg in the dark
                block). A held-light screen keeps white, or a phone in dark
                mode would get a black status strip over a white page -- the
                exact bug this pair exists to prevent. */}
            <meta
              name="theme-color"
              media="(prefers-color-scheme: dark)"
              content={heldLight ? "#ffffff" : "#000000"}
            />
          </>
        )}
        {/* /home and /messages follow the phone too — see the "social" block
            in styles.css. Their own head() declares no theme-color, so this
            pair is the first match and wins over the root's #000000. */}
        {surface === "social" && (
          <>
            <meta
              name="theme-color"
              media="(prefers-color-scheme: light)"
              content={darkOverlay ? "#000000" : "#ffffff"}
            />
            <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
          </>
        )}
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
  const router = useRouter();
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

  // Mirrors the history stack so back navigation can pop to an ancestor
  // rather than push on top of it. Mounted at the root because the mirror has
  // to see every navigation, including ones no screen is listening for.
  useEffect(() => attachNavStack(router.history), [router]);
  // Re-read theme-color when a black overlay opens or closes over a light
  // screen, too — see the effect below.
  const darkOverlay = useDarkOverlayActive();

  // The scroll-bounce/toolbar edge colour used to be set from here, by writing
  // document.documentElement.style.backgroundColor per route. It now lives in
  // styles.css, keyed off the `data-surface` attribute RootShell renders.
  //
  // Deleted rather than adapted, deliberately. An inline style beats every
  // stylesheet rule at any specificity short of !important, so leaving this in
  // place would pin the dashboard to #fff and no amount of CSS could give it a
  // dark scheme -- the same class of bug as the black strip, mirrored. It also
  // ran only after hydration, so a cold load of the white dashboard painted
  // black first.
  //
  // (The old comment here claimed store.products_.new.tsx and friends "escape
  // the store layout's <Outlet /> entirely". They do not: routeTree.gen.ts has
  // them parented to StoreRoute. The trailing underscore opts a route out of an
  // INTERMEDIATE layout -- store.products.tsx -- not out of store.tsx.)

  // Nudge iOS into re-reading theme-color after a client-side navigation.
  //
  // In a standalone (Add to Home Screen) web app, WebKit samples theme-color
  // when the app launches and then stops looking. Each route already declares
  // the right value -- #ffffff on /store and the publish screen, #000000 at the
  // root -- and TanStack does swap the tag's `content` on navigation, but
  // editing the attribute in place is precisely what WebKit ignores. Launch on
  // the profile, walk into the dashboard, and the white screen keeps the black
  // status strip it inherited. Reported on device 2026-09-22.
  //
  // Detaching and reinserting the ELEMENT is what tends to make WebKit
  // re-evaluate. The same node goes back in the same position with the same
  // attributes, so any reference TanStack's head management holds stays valid
  // and this cannot fight it -- unlike cloning or appending a second tag, which
  // would either strand that reference or leave two theme-color tags with the
  // first one winning.
  //
  // Deliberately route-agnostic: it re-reads whatever the current route
  // declared rather than repeating the light/dark list above, which would
  // drift from the head() blocks that own those values.
  //
  // querySelectorAll, not querySelector: the dashboard renders a PAIR of
  // theme-color tags (light and dark, see RootShell), and re-inserting only the
  // first would leave the other stale -- so a seller whose phone is in dark mode
  // would get a status bar the page had already stopped agreeing with. Each tag
  // is detached and put back before its own original next-sibling, so relative
  // order is preserved and the "first matching tag wins" rule still resolves the
  // way the markup says it should.
  //
  // If this turns out not to move the status bar on a real device, the cause is
  // a WebKit limitation rather than this code, and the alternatives are a
  // design decision -- see the status-bar-style note in this file's head().
  useEffect(() => {
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      const parent = meta.parentNode;
      if (!parent) continue;
      const next = meta.nextSibling;
      parent.removeChild(meta);
      parent.insertBefore(meta, next);
    }
  }, [pathname, darkOverlay]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes.
          EdgeSwipeBack is the installed iOS app's back swipe; everywhere else it
          renders two plain divs and attaches nothing. */}
      <EdgeSwipeBack>
        <Outlet />
      </EdgeSwipeBack>
      <PostUploadToast />
      <ProductSaveToast />
      <BackgroundUploadToast />
    </QueryClientProvider>
  );
}
