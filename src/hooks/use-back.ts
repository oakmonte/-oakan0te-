// The one back action in the app. Every chevron, every overlay dismissal and
// the tab bar all route through here, so that "back" means the same thing
// everywhere and — crucially — SHRINKS the history stack instead of growing
// it. See nav-hierarchy.ts for why that matters on iOS.
import { useCallback } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { parentOf, targetPathname, type NavTarget } from "@/lib/nav-hierarchy";
import { currentIndex, findAncestor, readIndex } from "@/lib/nav-stack";
import { useOwnUsername } from "@/hooks/use-own-username";

/** How long we wait for a history.go() to take effect before giving up on it.
 *  Inside the Instagram/TikTok in-app webview, go()/back() compete with the
 *  host app's own handling and can simply not happen — the reason
 *  last-visited-route.ts exists. We must never depend on it landing. */
const GO_TIMEOUT_MS = 300;

export function useBackTarget(): NavTarget | null {
  const location = useRouterState({ select: (s) => s.location });
  const ownUsername = useOwnUsername();
  return parentOf(location.pathname, location.search as Record<string, unknown>, {
    ownUsername,
  });
}

/**
 * Go to a specific screen the way "back" should: pop to it if it is behind us,
 * otherwise replace. Exposed separately because a few screens legitimately
 * know their own parent better than the hierarchy does — /store/collections/new
 * and /store/locations/new return to whichever form opened them, which the
 * pathname alone cannot tell you.
 */
export function useNavigateUp() {
  const router = useRouter();
  const navigate = useNavigate();

  return useCallback(
    (target: NavTarget) => {
      // Prefer a real pop. It shrinks the stack, hands us the browser's own
      // back animation and restores scroll position for free. Searching
      // backwards means the nearest ancestor wins, which is what resolves
      // /edit-profile's two possible parents correctly.
      const depth = findAncestor(targetPathname(target));
      if (depth >= 0) {
        router.history.go(depth - currentIndex());
        return;
      }

      // Nothing behind us: a deep link, a shared URL, or a fresh launch of the
      // installed app. Go up the hierarchy anyway, without growing the stack.
      void navigate({ ...target, replace: true } as Parameters<typeof navigate>[0]);
    },
    [router, navigate],
  );
}

export function useBack(explicit?: NavTarget): { back: () => void; canGoUp: boolean } {
  const navigateUp = useNavigateUp();
  const derived = useBackTarget();
  const target = explicit ?? derived;

  const back = useCallback(() => {
    if (target) navigateUp(target);
  }, [target, navigateUp]);

  return { back, canGoUp: target !== null };
}

/**
 * Navigate to a root tab, leaving it at history index 0 so that swiping back
 * from it has nowhere to go and the user leaves the app — which is what every
 * native app does at a tab root.
 */
export function useGoRoot() {
  const router = useRouter();
  const navigate = useNavigate();

  return useCallback(
    (target: NavTarget) => {
      const land = () =>
        void navigate({ ...target, replace: true } as Parameters<typeof navigate>[0]);

      const idx = readIndex(router.history.location.state);
      if (idx === 0) {
        land();
        return;
      }

      // Unwind to the bottom of the stack first, then replace what is there.
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        unsubscribe();
        clearTimeout(timer);
        land();
      };
      const unsubscribe = router.history.subscribe(() => {
        if (readIndex(router.history.location.state) === 0) finish();
      });
      const timer = setTimeout(finish, GO_TIMEOUT_MS);
      router.history.go(-idx);
    },
    [router, navigate],
  );
}
