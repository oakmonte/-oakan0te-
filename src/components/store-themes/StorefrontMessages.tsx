import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

type Seller = {
  ownerId: string;
  ownerUsername: string | null;
  brandName: string;
  logoUrl: string | null;
};

/** The storefront's Messages tab. A buyer on a store's website only ever
 *  needs one person -- the seller -- so this lists exactly that one contact,
 *  and tapping it opens the real chat with them. The seller looking at their
 *  own store sees themselves here too, but can't open a chat with themselves. */
export function StorefrontMessages({ storeId }: { storeId: string }) {
  const navigate = useNavigate();
  const { user } = useSession();
  const [seller, setSeller] = useState<Seller | null>(null);

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
        brandName: store.brand_name,
        logoUrl: store.logo_url,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const isSelf = !!user && !!seller && user.id === seller.ownerId;

  return (
    <div
      className="min-h-full bg-black px-4 pb-32 text-white"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">Messages</h1>
      {seller && (
        <button
          type="button"
          disabled={isSelf || !seller.ownerUsername}
          onClick={() =>
            void navigate({ to: "/messages", search: { to: seller.ownerUsername ?? undefined } })
          }
          className="mt-4 flex w-full items-center gap-3 rounded-[18px] bg-white/[0.07] px-3 py-3 text-left transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100"
        >
          <span className="grid h-[54px] w-[54px] shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-[20px] font-bold">
            {seller.logoUrl ? (
              <img src={seller.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              seller.brandName.slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold">
              {seller.brandName}
              {isSelf && <span className="font-normal text-white/50"> (you)</span>}
            </span>
            <span className="block text-[14px] leading-snug text-white/55">
              {isSelf
                ? "Buyers on your website message you here."
                : "Ask about sizes, delivery, anything."}
            </span>
          </span>
          {!isSelf && <ChevronRight size={20} className="shrink-0 text-white/40" />}
        </button>
      )}
    </div>
  );
}
