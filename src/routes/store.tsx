import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Menu,
  ChevronLeft,
  X,
  Home,
  ShoppingBag,
  Package,
  Users,
  TrendingUp,
  Tag,
  Image as ImageIcon,
  Wallet,
} from "lucide-react";

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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/store";

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => (isHome ? setDrawerOpen(true) : navigate({ to: "/store" }))}
          className="p-1 -ml-1"
          aria-label={isHome ? "Open menu" : "Back to store home"}
        >
          {isHome ? <Menu size={22} /> : <ChevronLeft size={24} />}
        </button>
        <span className="font-semibold text-sm">Oakmonte Store</span>
        <div className="w-7" />
      </div>

      <Outlet />

      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-black text-white px-2 py-4 flex flex-col">
            <div className="flex items-center justify-between px-3 mb-4">
              <span className="text-sm text-gray-400">Menu</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-sm"
                  activeProps={{ className: "bg-white/10" }}
                  activeOptions={{ exact: true }}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
