import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Menu,
  X,
  Home,
  ShoppingBag,
  Package,
  Users,
  TrendingUp,
  Tag,
  Image as ImageIcon,
  Wallet,
  ArrowLeftCircle,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveStore } from "@/hooks/use-own-store";

export const Route = createFileRoute("/store")({
  component: StoreLayout,
});

const NAV_ITEMS = [
  { label: "Home", to: "/store", icon: Home },
  { label: "Orders", to: "/store/orders", icon: ShoppingBag },
  { label: "Products", to: "/store/products", icon: Package },
  { label: "Customers", to: "/store/customers", icon: Users },
  { label: "Growth", to: "/store/growth", icon: TrendingUp },
  { label: "Discounts", to: "/store/discounts", icon: Tag },
  { label: "Content", to: "/store/content", icon: ImageIcon },
  { label: "Finance", to: "/store/finance", icon: Wallet },
];

function StoreLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useSession();
  const [username, setUsername] = useState<string | null>(null);
  const { store, stores, setActiveId } = useActiveStore();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setUsername(data.personal_username);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1 -ml-1 oak-motion-control active:scale-90"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        {stores.length > 1 ? (
          <label className="relative">
            <span className="sr-only">Switch store</span>
            <select
              value={store?.id ?? ""}
              onChange={(e) => setActiveId(e.target.value)}
              className="font-semibold text-sm bg-transparent text-center appearance-none pr-4"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="font-semibold text-sm">{store?.brand_name ?? "Oakmonte Store"}</span>
        )}
        <div className="w-7" />
      </div>

      <Outlet />

      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-black text-white px-2 py-4 flex flex-col animate-in slide-in-from-left duration-300 ease-out">
            <div className="flex items-center justify-between px-3 mb-4">
              <span className="text-sm text-gray-400">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 oak-motion-control active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-sm transition-colors duration-150"
                  activeProps={{ className: "bg-white/10" }}
                  activeOptions={{ exact: true }}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-3 border-t border-white/10">
              {username && (
                <Link
                  to="/profile/$username"
                  params={{ username }}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-sm text-gray-300 transition-colors duration-150"
                >
                  <ArrowLeftCircle size={18} />
                  Return to profile
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
