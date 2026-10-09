/**
 * The activity centre on the client: fetching the feed, and the "seen up to"
 * watermark that decides what counts as new.
 *
 * The watermark lives in localStorage, per account, on purpose for now: there
 * is no notifications table to keep read state in (see activity-model.ts), and
 * a per-device "last opened" is all a badge needs. The cost is that opening
 * activity on one phone doesn't clear the badge on another. When the
 * notifications table lands, its read_at column is where this moves.
 *
 * useUnseenActivityCount is the export for other screens -- a bell, a dot on
 * the profile menu. It shares the activity screen's query cache, so mounting a
 * bell on a screen costs no request the activity screen hasn't already made.
 */
import { useSyncExternalStore } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useSession } from "@/hooks/use-session";
import {
  countUnseen,
  lastSeenStorageKey,
  parseLastSeen,
  type ActivityFeed,
} from "@/lib/activity-model";

export * from "@/lib/activity-model";

export class ActivityLoadError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? "Not signed in" : "Couldn't load your activity");
  }
}

async function fetchActivity(): Promise<ActivityFeed> {
  const res = await authedFetch("/api/activity");
  if (!res.ok) throw new ActivityLoadError(res.status);
  return (await res.json()) as ActivityFeed;
}

/** Keyed by account so a sign-out/sign-in on the same phone never shows the
 *  previous person's feed from cache. */
export function activityQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: ["activity", userId] as const,
    queryFn: fetchActivity,
    enabled: !!userId,
    // A minute keeps a bell on every screen from refetching on each
    // navigation; focus refetch (react-query's default) still catches up when
    // the app comes back to the foreground.
    staleTime: 60_000,
    retry: (failures, error) =>
      !(error instanceof ActivityLoadError && error.status === 401) && failures < 2,
  });
}

/* ---------- the last-seen watermark ---------- */

// Same-tab writes don't fire "storage" (that event is for OTHER tabs), so the
// activity screen announces its own writes for any bell on the same page.
const SEEN_EVENT = "oak:activity-seen";

/** When this account last looked at the activity centre, in ms, or null if
 *  never (or storage is unavailable -- private mode, blocked site data). */
export function readLastSeen(userId: string): number | null {
  try {
    return parseLastSeen(window.localStorage.getItem(lastSeenStorageKey(userId)));
  } catch {
    return null;
  }
}

/** Moves the watermark forward to `at`. Never backward: a stale tab writing
 *  an older time must not resurrect items already seen elsewhere. */
export function markActivitySeen(userId: string, at: number) {
  const current = readLastSeen(userId);
  if (current !== null && current >= at) return;
  try {
    window.localStorage.setItem(lastSeenStorageKey(userId), String(Math.floor(at)));
  } catch {
    // Storage blocked: the badge just won't clear on this device. Nothing to
    // recover -- the feed itself still works.
    return;
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener(SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The watermark as live state: re-renders when the activity screen (this tab
 *  or another) marks things seen. Null during SSR and when signed out. */
export function useLastSeenActivity(userId: string | null): number | null {
  return useSyncExternalStore(
    subscribeSeen,
    () => (userId ? readLastSeen(userId) : null),
    () => null,
  );
}

/** How many activity items arrived since the signed-in user last opened
 *  /activity. 0 when signed out or before the first load -- a badge should
 *  never flash a number it isn't sure of. Cap it for display yourself ("9+"). */
export function useUnseenActivityCount(): number {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const { data } = useQuery({
    ...activityQueryOptions(userId),
    // A bell stays mounted while the user sits on a screen; poll gently so it
    // can light up without them navigating.
    refetchInterval: 120_000,
  });
  const lastSeen = useLastSeenActivity(userId);
  if (!userId || !data) return 0;
  return countUnseen(data.items, lastSeen);
}
