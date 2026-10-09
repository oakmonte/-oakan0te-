import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicStorefront } from "@/components/store-themes/full-previews";
import { supabase } from "@/lib/integrations/my-supabase/client";

// A store's website: the storefront, full screen, and nothing else. Since the
// sellers-only pivot this is what buyers land on; the store profile no longer
// carries the storefront. The seller's own preview of it is the Website tab
// (/home), which renders the same PublicStorefront.
export const Route = createFileRoute("/shop/$storeUsername")({
  head: () => ({ meta: [{ title: "Shop — Oakmonte" }] }),
  component: ShopPage,
});

function ShopPage() {
  const { storeUsername } = useParams({ from: "/shop/$storeUsername" });
  // undefined while loading, null when there's no such store.
  const [storeId, setStoreId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setStoreId(undefined);
    supabase
      .from("stores")
      .select("id")
      .eq("store_username", storeUsername)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStoreId(data?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [storeUsername]);

  if (storeId === undefined) return <div className="min-h-dvh bg-black" />;
  if (storeId === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-10 text-center text-white">
        <p className="text-[20px] font-bold">This store doesn&apos;t exist</p>
        <p className="mt-2 text-[14.5px] text-white/55">Check the link and try again.</p>
      </div>
    );
  }
  return (
    <div className="min-h-dvh">
      <PublicStorefront storeId={storeId} paintChrome />
    </div>
  );
}
