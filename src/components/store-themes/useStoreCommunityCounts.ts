import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type StoreCommunityCounts = {
  /** People following the seller who owns this store. */
  followers: number;
  /** Items this seller has sold — what the footer block means by "wearing it". */
  wearing: number;
};

const EMPTY: StoreCommunityCounts = { followers: 0, wearing: 0 };

// The community numbers a storefront shows. Every theme used to hardcode
// these ("2.7K+ followers love this store", "142 people wearing it today"),
// which read as a real credential on a store that had neither — the same
// reason the star-rating badge was pulled out of StatsRow. The wording around
// them is still the seller's to edit; the numbers are not.
//
// Counts live on the profile_stats view keyed by PROFILE id, and a storefront
// only knows its store id, so this resolves stores.owner_id first. Asking
// profiles for these columns makes PostgREST reject the whole select — see
// the note on profileStatsQueryOptions.
//
// Through react-query rather than a bare effect so the two blocks that need
// it (StatsRow and FooterTeaser, both rendered by every theme) share one
// fetch instead of firing the same pair of requests twice.
export function useStoreCommunityCounts(storeId: string | null) {
  const { data } = useQuery({
    queryKey: ["store-community-counts", storeId] as const,
    queryFn: async (): Promise<StoreCommunityCounts> => {
      if (!storeId) return EMPTY;
      const { data: store } = await supabase
        .from("stores")
        .select("owner_id")
        .eq("id", storeId)
        .maybeSingle();
      if (!store?.owner_id) return EMPTY;
      const { data: stats } = await supabase
        .from("profile_stats")
        .select("followers_count, sold_items_count")
        .eq("id", store.owner_id)
        .maybeSingle();
      return {
        followers: stats?.followers_count ?? 0,
        wearing: stats?.sold_items_count ?? 0,
      };
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
  return data ?? EMPTY;
}

// 4 digits stay exact (1..9999); past that the K/M short forms keep a long
// number from pushing the copy beside it out of a tile. Never padded or
// rounded up — a store with 0 shows 0.
export function formatCommunityCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
