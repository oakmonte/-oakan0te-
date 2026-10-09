import { useQuery } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";

export class InsightsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Minutes east of UTC, so days on the chart are the seller's days. Read once:
// it cannot change while the page is open in any way worth refetching for.
const TZ_OFFSET = typeof window === "undefined" ? 60 : -new Date().getTimezoneOffset();

/** Reads one of the api.store.insights.* endpoints for `storeId`.
 *
 *  The store id rides along so a seller with two stores sees the one they
 *  switched to; the server still checks it belongs to them. Cached through
 *  react-query so hopping between the dashboard and these screens repaints
 *  instantly and revalidates behind it. Changing period keeps the previous
 *  answer on screen while the new one loads -- but never across stores, where
 *  the "previous answer" would be someone else's numbers under this name. */
export function useStoreInsights<T>(
  storeId: string | null,
  endpoint: string,
  params: Record<string, string> = {},
) {
  return useQuery({
    queryKey: ["store-insights", storeId, endpoint, params] as const,
    enabled: !!storeId,
    staleTime: 30_000,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === storeId && previousQuery?.queryKey[2] === endpoint
        ? previous
        : undefined,
    queryFn: async (): Promise<T> => {
      const search = new URLSearchParams({ ...params, tz: String(TZ_OFFSET) });
      if (storeId) search.set("store", storeId);
      const res = await authedFetch(`/api/store/insights/${endpoint}?${search}`);
      const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok || !body) {
        throw new InsightsError(body?.error ?? "Something went wrong", res.status);
      }
      return body;
    },
    // A 404 is an answer (a customer key that doesn't exist), not a blip.
    retry: (count, err) => !(err instanceof InsightsError && err.status < 500) && count < 2,
  });
}
