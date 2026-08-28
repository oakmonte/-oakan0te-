import { authedFetch } from "@/lib/authed-fetch";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Wallet, Package, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

function StepNumber({ n }: { n: number }) {
  return (
    <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-medium flex items-center justify-center shrink-0 mt-0.5">
      {n}
    </span>
  );
}

function StoreHome() {
  const { storeId } = useActiveStoreId();
  const [payoutSet, setPayoutSet] = useState(false);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [locationsSheetOpen, setLocationsSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authedFetch("/api/store/payout")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setPayoutSet(!!body.account);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("store_locations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("StoreHome: failed to load pickup location count", error);
          return;
        }
        setLocationCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const linkCards = [
    {
      label: "Get paid",
      description: payoutSet
        ? "Payout account added — pending verification."
        : "Add your bank account details so you can get paid.",
      to: "/store/finance",
      icon: Wallet,
      badge: payoutSet,
    },
    {
      label: "List products",
      description: "Add items or import your existing catalog.",
      to: "/store/products",
      icon: Package,
      badge: false,
    },
    {
      label: "Customise your store front",
      description: "Choose how your store should look like.",
      to: "/store/theme",
      icon: Palette,
      badge: false,
    },
  ] as const;

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Your online store is starting to take shape</h1>
      <p className="text-sm text-gray-500 mb-6">We recommend this order for simplicity.</p>

      <div className="flex flex-col gap-3">
        <Link
          to={linkCards[0].to}
          className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 oak-motion-control"
        >
          <StepNumber n={1} />
          <div className="p-2 rounded-full bg-gray-100 relative">
            <Wallet size={18} />
            {linkCards[0].badge && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white oak-motion-pop" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{linkCards[0].label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{linkCards[0].description}</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setLocationsSheetOpen(true)}
          className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 oak-motion-control text-left"
        >
          <StepNumber n={2} />
          <div className="p-2 rounded-full bg-gray-100 relative">
            <MapPin size={18} />
            {!!locationCount && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white oak-motion-pop" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Pickup locations</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {locationCount
                ? `${locationCount} location${locationCount === 1 ? "" : "s"} saved — tap to manage.`
                : "Add every store or warehouse riders can collect orders from."}
            </p>
          </div>
        </button>

        {linkCards.slice(1).map(({ label, description, to, icon: Icon, badge }, i) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 oak-motion-control"
          >
            <StepNumber n={i + 3} />
            <div className="p-2 rounded-full bg-gray-100 relative">
              <Icon size={18} />
              {badge && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white oak-motion-pop" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>

      {locationsSheetOpen && storeId && (
        <LocationsListSheet
          storeId={storeId}
          onClose={() => setLocationsSheetOpen(false)}
          onCountChange={setLocationCount}
        />
      )}
    </div>
  );
}
