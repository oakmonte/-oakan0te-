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
