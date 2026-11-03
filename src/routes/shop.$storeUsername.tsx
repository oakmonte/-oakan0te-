import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { useEffect } from "react";
import { PublicStorefront } from "@/components/store-themes/full-previews";
import { HERO_SLIDESHOW_IMAGES } from "@/components/store-themes/hero-placeholders";
import { cdnSrcSet, IMAGE_SIZES } from "@/lib/cdn-image";
import {
  STOREFRONT_CACHE_CONTROL,
  loadStorefrontData,
  type StorefrontData,
} from "@/lib/storefront-data";
import { StorefrontDataContext } from "@/lib/storefront-seed";

// A store's website: the storefront, full screen, and nothing else. Since the
// sellers-only pivot this is what buyers land on; the store profile no longer
// carries the storefront. The seller's own preview of it is the Website tab
// (/home), which renders the same PublicStorefront.
//
// Its first screen is ONE data request. On a direct visit the loader runs on
// the server, next to the database, and the storefront arrives rendered in the
// HTML; on an in-app navigation it's one GET to /api/storefront/<handle>.
// Either way PublicStorefront's hooks read it from StorefrontDataContext
// instead of each fetching their own piece (lib/storefront-data.ts).

const getStorefront = createIsomorphicFn()
  .server(async (handle: string): Promise<StorefrontData | null> => {
    const data = await loadStorefrontData(handle);
    // The page is public and the same for everyone (the session lives in the
    // browser, never in this HTML), so the edge may cache it.
    setResponseHeader("Cache-Control", STOREFRONT_CACHE_CONTROL);
    return data;
  })
  .client(async (handle: string): Promise<StorefrontData | null> => {
    const res = await fetch(`/api/storefront/${encodeURIComponent(handle)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Couldn't load this store (${res.status})`);
    return (await res.json()) as StorefrontData;
  });

/** The first hero photo -- the page's largest paint on a phone. */
function heroImage(data: StorefrontData): string {
  return data.customization?.slideshowImages[0] ?? HERO_SLIDESHOW_IMAGES[0];
}

export const Route = createFileRoute("/shop/$storeUsername")({
  loader: ({ params }) => getStorefront(params.storeUsername),
  // Matches the edge cache: going back to a store within a minute reuses it.
  staleTime: 60_000,
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Shop — Oakmonte" }] };
    const hero = heroImage(loaderData);
    const srcSet = cdnSrcSet(hero);
    return {
      meta: [{ title: `${loaderData.store.brand_name || "Shop"} — Oakmonte` }],
      links: [
        {
          rel: "preload",
          as: "image",
          href: hero,
          fetchPriority: "high",
          ...(srcSet ? { imageSrcSet: srcSet, imageSizes: IMAGE_SIZES.hero } : {}),
        },
      ],
    };
  },
  component: ShopPage,
});

/** The storefront a buyer last had open (read by the cart). */
export const LAST_STORE_KEY = "oakmonte:last-store";

function ShopPage() {
  const data = Route.useLoaderData();
  const { storeUsername } = Route.useParams();

  useEffect(() => {
    if (!data) return;
    // So the cart's "Start shopping" can send a buyer back to this store.
    try {
      localStorage.setItem(LAST_STORE_KEY, storeUsername);
    } catch {
      // Storage blocked: the cart falls back to going back.
    }
  }, [data, storeUsername]);

  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-10 text-center text-white">
        <p className="text-[20px] font-bold">This store doesn&apos;t exist</p>
        <p className="mt-2 text-[14.5px] text-white/55">Check the link and try again.</p>
      </div>
    );
  }
  return (
    <StorefrontDataContext.Provider value={data}>
      <div className="min-h-dvh">
        <PublicStorefront storeId={data.store.id} paintChrome />
      </div>
    </StorefrontDataContext.Provider>
  );
}
