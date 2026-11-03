import { createMyAnonClient, type MySupabaseClient } from "@/lib/integrations/my-supabase/client";
import { DROPS_ENABLED, type LiveDrop } from "@/lib/drops";
import { fetchCatalog, type StorefrontCatalog } from "@/components/store-themes/storefront-catalog";
import {
  CUSTOMIZATION_SELECT,
  parseCustomizationRow,
  type SavedThemeCustomization,
} from "@/components/store-themes/useThemeCustomization";
import type { StoreCommunityCounts } from "@/components/store-themes/useStoreCommunityCounts";

/** Everything the first screen of a public storefront (/shop/<handle>) reads,
 *  fetched in one go on the server (lib/storefront-data.server.ts) and handed
 *  down through StorefrontDataContext. Before this, each hook fetched its own
 *  piece from the browser: ~19 REST calls in four waves, `stores` six times.
 *
 *  Public columns only. The fetch runs with the publishable (anon) key and no
 *  session, so the private `stores` columns (contact, pickup address,
 *  Shopify/Bumpa) can't be selected even by mistake -- anon has no grant on
 *  them. Every hook below still fetches for itself when there's no seed (the
 *  seller's Home preview, the theme editor), so nothing else changed. */
export type StorefrontData = {
  store: {
    id: string;
    brand_name: string;
    owner_id: string;
    logo_url: string | null;
    store_username: string;
    shipping_policy: string | null;
  };
  /** The theme the seller picked; null when they never did. */
  themeSlug: string | null;
  /** Saved customization for the theme that renders (themeSlug ?? default). */
  customization: SavedThemeCustomization | null;
  catalog: StorefrontCatalog;
  drops: LiveDrop[];
  counts: StoreCommunityCounts;
};

/** What renders for a store that never picked a theme (useStoreTheme). */
export const DEFAULT_THEME_SLUG = "motion";

export async function fetchStorefrontData(
  client: MySupabaseClient,
  handle: string,
): Promise<StorefrontData | null> {
  // The one lookup everything else depends on.
  const { data: store, error } = await client
    .from("stores")
    .select(
      "id, brand_name, owner_id, logo_url, store_username, shipping_policy, store_themes(slug)",
    )
    .eq("store_username", handle)
    .maybeSingle();
  if (error) throw new Error(`storefront: store lookup failed: ${error.message}`);
  if (!store) return null;

  const themeSlug = store.store_themes?.slug ?? null;
  const [custom, catalog, drops, stats] = await Promise.all([
    client
      .from("store_theme_customizations")
      .select(CUSTOMIZATION_SELECT)
      .eq("store_id", store.id)
      .eq("theme_slug", themeSlug ?? DEFAULT_THEME_SLUG)
      .maybeSingle(),
    fetchCatalog(store.id, client),
    DROPS_ENABLED
      ? client
          .from("drops")
          .select("id, title, starts_at, ends_at")
          .eq("store_id", store.id)
          .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
          .limit(20)
      : Promise.resolve({ data: [] as LiveDrop[], error: null }),
    client
      .from("profile_stats")
      .select("followers_count, sold_items_count")
      .eq("id", store.owner_id)
      .maybeSingle(),
  ]);
  // A failed customization read would render the theme's defaults over what
  // the seller designed; better to fail the request (not cached) and retry.
  if (custom.error) throw new Error(`storefront: customization failed: ${custom.error.message}`);
  if (drops.error) console.error("storefront: drops", drops.error);
  if (stats.error) console.error("storefront: stats", stats.error);

  return {
    store: {
      id: store.id,
      brand_name: store.brand_name ?? "",
      owner_id: store.owner_id,
      logo_url: store.logo_url,
      store_username: store.store_username,
      shipping_policy: store.shipping_policy,
    },
    themeSlug,
    customization: custom.data ? parseCustomizationRow(custom.data) : null,
    catalog,
    drops: drops.data ?? [],
    counts: {
      followers: stats.data?.followers_count ?? 0,
      wearing: stats.data?.sold_items_count ?? 0,
    },
  };
}

/** Edge cache for storefront data and the page that carries it. Public data,
 *  so a CDN may share it between visitors; a minute fresh, then served stale
 *  for up to ten while one request refreshes it in the background. A seller's
 *  edit shows on their public site within about a minute (their own Home
 *  preview reads live). The browser itself doesn't keep it (max-age=0). */
export const STOREFRONT_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=600";

/** Handles are what the store_username column allows; anything else can't be
 *  a store, so it's answered without a query. */
const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

let anonClient: MySupabaseClient | undefined;

/** The storefront for `handle` with the anon key, from wherever this runs
 *  (the SSR loader and /api/storefront/$handle, both on the server). */
export function loadStorefrontData(handle: string): Promise<StorefrontData | null> {
  if (!HANDLE_RE.test(handle)) return Promise.resolve(null);
  anonClient ??= createMyAnonClient();
  return fetchStorefrontData(anonClient, handle);
}
