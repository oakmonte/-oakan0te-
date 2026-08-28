import { authedFetch } from "@/lib/authed-fetch";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Wallet, Package, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { LocationSheet, type PickupLocationValues } from "@/components/store/LocationSheet";

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
  const [pickupSet, setPickupSet] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [initialLocation, setInitialLocation] = useState<PickupLocationValues | null>(null);

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
      .from("stores")
      .select(
        "pickup_address_line, pickup_address_line2, pickup_city, pickup_state, pickup_country, pickup_lat, pickup_lng",
      )
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("StoreHome: failed to load pickup location", error);
          return;
        }
        setPickupSet(!!(data?.pickup_city && data?.pickup_state && data?.pickup_country));
        setInitialLocation(
          data
            ? {
                addressLine: data.pickup_address_line ?? "",
                addressLine2: data.pickup_address_line2 ?? "",
                city: data.pickup_city ?? "",
                state: data.pickup_state ?? "",
                country: data.pickup_country ?? "",
                lat: data.pickup_lat,
                lng: data.pickup_lng,
              }
            : null,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function handleSaveLocation(values: PickupLocationValues) {
    if (!storeId) return;
    const { error } = await supabase
      .from("stores")
      .update({
        pickup_address_line: values.addressLine || null,
        pickup_address_line2: values.addressLine2 || null,
        pickup_city: values.city || null,
        pickup_state: values.state || null,
        pickup_country: values.country || null,
        pickup_lat: values.lat,
        pickup_lng: values.lng,
        pickup_location_updated_at: new Date().toISOString(),
      })
      .eq("id", storeId);
    if (error) {
      console.error("StoreHome: failed to save pickup location", error);
      return;
    }
    setInitialLocation(values);
    setPickupSet(!!(values.city && values.state && values.country));
    setLocationSheetOpen(false);
  }

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
      label: "Pick a store theme",
      description: "Choose how your store should look like.",
      to: "/store/theme",
      icon: Palette,
      badge: false,
    },
  ] as const;

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Your online store is starting to take shape</h1>
      <p className="text-sm text-gray-500 mb-6">What do you want to work on next?</p>

      <div className="flex flex-col gap-3">
        {linkCards.map(({ label, description, to, icon: Icon, badge }, i) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 oak-motion-control"
          >
            <StepNumber n={i + 1} />
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

        <button
          type="button"
          onClick={() => setLocationSheetOpen(true)}
          className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 oak-motion-control text-left"
        >
          <StepNumber n={linkCards.length + 1} />
          <div className="p-2 rounded-full bg-gray-100 relative">
            <MapPin size={18} />
            {pickupSet && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white oak-motion-pop" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Set your pickup location</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {pickupSet
                ? "Riders use this to find you — tap to update."
                : "So riders know where to collect orders from."}
            </p>
          </div>
        </button>
      </div>

      {locationSheetOpen && (
        <LocationSheet
          initial={initialLocation}
          onSave={handleSaveLocation}
          onClose={() => setLocationSheetOpen(false)}
        />
      )}
    </div>
  );
}
