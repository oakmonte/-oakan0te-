import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { MessagesView, type SellerOnly } from "@/routes/messages";

/** The storefront's Messages tab: the app's Messages page, scoped to the one
 *  person a buyer on this website needs -- the seller. Everything else about
 *  the page (search, folders, rows, the chat itself) is the real thing. The
 *  seller looking at their own store sees themselves but can't open a chat. */
export function StorefrontMessages({
  storeId,
  onThreadOpenChange,
}: {
  storeId: string;
  onThreadOpenChange: (open: boolean) => void;
}) {
  const [seller, setSeller] = useState<SellerOnly | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: store } = await supabase
        .from("stores")
        .select("owner_id, brand_name, logo_url")
        .eq("id", storeId)
        .maybeSingle();
      if (!store || cancelled) return;
      // public_profiles, not profiles: profiles only returns your own row.
      const { data: owner } = await supabase
        .from("public_profiles")
        .select("personal_username")
        .eq("id", store.owner_id)
        .maybeSingle();
      if (cancelled) return;
      setSeller({
        ownerId: store.owner_id,
        ownerUsername: owner?.personal_username ?? null,
        name: store.brand_name,
        avatarUrl: store.logo_url,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  if (!seller) return <div className="min-h-full bg-chat-bg" />;
  return <MessagesView sellerOnly={seller} onThreadOpenChange={onThreadOpenChange} />;
}
