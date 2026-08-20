import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Wallet, Package } from "lucide-react";
import { useEffect, useState } from "react";

// TODO: dev-only, matches store.products_.new.tsx / store.products.tsx.
// Revert before launch.
const DEV_STORE_ID = "4a492d4d-66bd-4d14-a5dc-e6d8d1723023";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

function StoreHome() {
  const [payoutSet, setPayoutSet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/store/payout?storeId=${DEV_STORE_ID}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setPayoutSet(!!body.account);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      label: "Pick a store theme",
      description: "Choose how your store should look like.",
      to: "/store/theme",
      icon: Palette,
      badge: false,
    },
    {
      label: "Set up payments",
      description: payoutSet
        ? "Payout account added — pending verification."
        : "Add your payout details so you can get paid.",
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
  ];

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Your online store is starting to take shape</h1>
      <p className="text-sm text-gray-500 mb-6">What do you want to work on next?</p>

      <div className="flex flex-col gap-3">
        {cards.map(({ label, description, to, icon: Icon, badge }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50"
          >
            <div className="p-2 rounded-full bg-gray-100 relative">
              <Icon size={18} />
              {badge && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
