import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Wallet, Package } from "lucide-react";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

const CARDS = [
  {
    label: "Pick a store theme",
    description: "Choose how your store should look like.",
    to: "/store/theme",
    icon: Palette,
  },
  {
    label: "Set up payments",
    description: "Add your payout details so you can get paid.",
    to: "/store/finance",
    icon: Wallet,
  },
  {
    label: "List products",
    description: "Add items or import your existing catalog.",
    to: "/store/products",
    icon: Package,
  },
];

function StoreHome() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Your online store is starting to take shape</h1>
      <p className="text-sm text-gray-500 mb-6">What do you want to work on next?</p>

      <div className="flex flex-col gap-3">
        {CARDS.map(({ label, description, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50"
          >
            <div className="p-2 rounded-full bg-gray-100">
              <Icon size={18} />
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
