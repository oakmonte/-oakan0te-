// Where each screen sits in the app, as opposed to where the user happens to
// have been. The iOS edge-swipe walks the browser's history stack, which is
// every screen ever visited in order; native apps walk the hierarchy instead,
// so Settings always goes up to Profile no matter how you arrived. We cannot
// intercept the gesture — no web API touches it — so the only lever is keeping
// the history stack shallow and shaped like this tree. See use-back.ts.
import type { FileRouteTypes } from "@/routeTree.gen";

export type AppTo = FileRouteTypes["to"];

export type NavTarget = {
  to: AppTo;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

export type HierarchyContext = {
  /** The signed-in user's personal username, for anything whose parent is
   *  their own profile. Absent until the profile row loads — callers fall
   *  back to /home, which is a root either way. */
  ownUsername?: string;
};

/** Screens with nothing above them. Swiping back from one of these should
 *  leave the app, which it does once they sit at history index 0. */
const ROOT_PATHS = new Set(["/", "/home", "/messages", "/cart"]);

/** Trees this module deliberately does not manage.
 *
 *  `/create` is Kim's — the flow returns by origin rather than by stack
 *  (publish reads media.origin, after-shot self-evicts once the capture is
 *  consumed, the camera uses getLastNonCreateRoute because history.back() is
 *  unreliable inside the Instagram/TikTok webview). Those resolvers are
 *  correct; a generic parent would fight them.
 *
 *  Onboarding is a linear funnel with its own previousStep() and its own
 *  shell, not a hierarchy. */
const UNMANAGED_PREFIXES = ["/create", "/auth"];
const UNMANAGED_PATHS = new Set([
  // Public legal pages. Reachable from the landing footer as well as from
  // Settings, so they have no single parent — and sending a signed-out reader
  // "up" to /settings would put them in front of a sign-in wall. With a
  // shallow stack the plain back gesture already does the right thing here.
  "/terms",
  "/privacy",
  "/sign-in",
  "/no-account",
  "/create-password",
  "/passkey",
  "/welcome",
  "/set-up-store",
  "/become-a-creator",
  "/become-a-curator",
  "/seller-type",
  "/choose-username",
  "/name-your-store",
  "/whats-your-style",
  "/find-your-fit",
  "/where-did-you-hear-about-us",
  "/switching-roles",
]);

export function isUnmanaged(pathname: string): boolean {
  return (
    UNMANAGED_PATHS.has(pathname) ||
    UNMANAGED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

function ownProfile(ctx: HierarchyContext): NavTarget {
  return ctx.ownUsername
    ? { to: "/profile/$username", params: { username: ctx.ownUsername } }
    : { to: "/home" };
}

function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/**
 * The screen directly above `pathname`, or null when there is nothing above it
 * — either because it is a root, or because its tree manages its own returns.
 * Callers treat null as "do nothing; the gesture belongs to the OS".
 */
export function parentOf(
  pathname: string,
  search: Record<string, unknown>,
  ctx: HierarchyContext = {},
): NavTarget | null {
  if (ROOT_PATHS.has(pathname) || isUnmanaged(pathname)) return null;

  const seg = segments(pathname);

  // Your own profile is a tab root. Someone else's is a screen you pushed
  // into from the feed, so it goes back up to the feed.
  if (seg[0] === "profile") {
    if (ctx.ownUsername && seg[1] === ctx.ownUsername) return null;
    return { to: "/home" };
  }

  // The storefront is an identity swap off your own profile, not a
  // destination reached from anywhere else in the app today.
  if (seg[0] === "store-profile") return ownProfile(ctx);

  if (seg[0] === "store") {
    // Deep-linked from the setup checklist, which lives on /store itself.
    // These screens carry ?checklist=true precisely so they can return to it.
    if (search.checklist === true) return { to: "/store" };

    // /store is the dashboard root, entered from the profile drawer.
    if (seg.length === 1) return ownProfile(ctx);

    // The trailing-underscore routes escape the /store layout: their parent is
    // the list they were opened from, not the dashboard.
    if (seg[1] === "products" && seg.length > 2) return { to: "/store/products" };
    if (seg[1] === "collections" && seg.length > 2) return { to: "/store/collections" };
    if (seg[1] === "locations" && seg.length > 2) return { to: "/store" };

    // Everything else under /store is a drawer sibling.
    return { to: "/store" };
  }

  switch (pathname) {
    case "/settings":
      return ownProfile(ctx);
    // Reachable from Settings AND straight from the profile header, so the
    // static answer is only a fallback — useBack prefers whichever of the two
    // is actually behind us in the stack.
    case "/edit-profile":
      return ownProfile(ctx);
    case "/activity":
    case "/studio":
    case "/offline-videos":
      return ownProfile(ctx);
    default:
      return { to: "/home" };
  }
}

/** Resolve a NavTarget to the pathname it would land on, so the stack mirror
 *  can be searched for it. Mirrors TanStack's param interpolation for the only
 *  two dynamic segments this app has. */
export function targetPathname(target: NavTarget): string {
  let out: string = target.to;
  for (const [key, value] of Object.entries(target.params ?? {})) {
    out = out.replace(`$${key}`, value);
  }
  return out;
}

/** Wrap an already-resolved pathname as a target. For the handful of screens
 *  that compute their own return path at runtime (the new-collection and
 *  new-location forms, which go back to whichever product form opened them) —
 *  those strings are built from real route paths, which the route-path union
 *  cannot express statically. */
export function pathTarget(pathname: string): NavTarget {
  return { to: pathname as AppTo };
}
