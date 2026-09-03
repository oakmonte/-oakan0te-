import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type PublicProfileRow = {
  id: string;
  personal_username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

async function fetchPublicProfile(username: string): Promise<PublicProfileRow | null> {
  // public_profiles, not profiles: profiles' SELECT policy is auth.uid() =
  // id, so it can only ever return the signed-in user's own row. The view
  // exposes just the columns the profile page renders publicly.
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, personal_username, display_name, avatar_url, bio")
    .eq("personal_username", username)
    .single();
  // id/personal_username are NOT NULL on the base table — the view's
  // generated type just can't express that for a view's columns.
  if (error || !data || !data.id || !data.personal_username) return null;
  return { ...data, id: data.id, personal_username: data.personal_username };
}

// 30s staleTime is what actually makes the router's `intent` preload (see
// router.tsx) pay off: the fetch that fires on hover/touch-start is still
// "fresh" by the time the tap completes and the route's loader checks the
// cache again, so navigation reuses it instead of firing the exact same
// request a few hundred ms later. Router-level defaultPreloadStaleTime is 0
// (a *different* cache, the router's own loader-result cache) — this
// query's own staleTime is what matters here since the loader delegates to
// queryClient.ensureQueryData rather than returning data itself.
export function profileQueryOptions(username: string) {
  return queryOptions({
    queryKey: ["public-profile", username] as const,
    queryFn: () => fetchPublicProfile(username),
    staleTime: 30_000,
  });
}

export type ProfileStats = {
  following_count: number;
  followers_count: number;
  rating: number;
  rating_count: number;
};

const EMPTY_STATS: ProfileStats = {
  following_count: 0,
  followers_count: 0,
  rating: 0,
  rating_count: 0,
};

/** Follower/following/rating counts. These live on the profile_stats view,
 *  not on profiles — asking profiles for them makes PostgREST reject the
 *  whole select, so this stays its own query rather than folding into
 *  profileQueryOptions.
 *
 *  Cached like everything else the profile page reads: uncached, the counts
 *  flashed 0 → real value on every single visit. */
export function profileStatsQueryOptions(profileId: string | undefined) {
  return queryOptions({
    queryKey: ["profile-stats", profileId] as const,
    queryFn: async (): Promise<ProfileStats> => {
      if (!profileId) return EMPTY_STATS;
      const { data } = await supabase
        .from("profile_stats")
        .select("following_count, followers_count, rating, rating_count")
        .eq("id", profileId)
        .maybeSingle();
      if (!data) return EMPTY_STATS;
      return {
        following_count: data.following_count ?? 0,
        followers_count: data.followers_count ?? 0,
        rating: data.rating ?? 0,
        rating_count: data.rating_count ?? 0,
      };
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });
}

export type OwnedStore = {
  id: string;
  store_username: string;
  brand_name: string;
  theme_id: string | null;
};

/** Every store this profile owns, oldest first — same tie-break as
 *  useOwnStores, so "the" store is the same row everywhere. An account can
 *  own more than one (the dashboard's store switcher), so this is a list
 *  read, never .maybeSingle(). */
export function profileStoresQueryOptions(profileId: string | undefined) {
  return queryOptions({
    queryKey: ["profile-stores", profileId] as const,
    queryFn: async (): Promise<OwnedStore[]> => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("stores")
        .select("id, store_username, brand_name, theme_id")
        .eq("owner_id", profileId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) {
        console.error("profileStoresQueryOptions: failed to load stores", error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });
}

/** Whether `viewerId` already follows `profileId`. Disabled (and never
 *  fetched) when there's no viewer or you're looking at your own profile. */
export function followStatusQueryOptions(
  viewerId: string | undefined,
  profileId: string | undefined,
) {
  const enabled = !!viewerId && !!profileId && viewerId !== profileId;
  return queryOptions({
    queryKey: ["follow-status", viewerId, profileId] as const,
    queryFn: async (): Promise<boolean> => {
      if (!enabled) return false;
      const { data, error } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", viewerId!)
        .eq("following_id", profileId!)
        .maybeSingle();
      if (error) {
        console.error("followStatusQueryOptions: failed to check follow status", error);
        return false;
      }
      return !!data;
    },
    enabled,
    staleTime: 30_000,
  });
}
