import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useCallback, useState, useEffect } from "react";
import {
  Menu,
  X,
  Home,
  ShoppingBag,
  Package,
  Layers,
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
import { StoreHeaderProvider } from "@/context/store-header-provider";
import { useStoreHeader } from "@/hooks/use-store-header";

export const Route = createFileRoute("/store")({
  // Overrides root's #000000 theme-color for the whole dashboard (this
  // covers the trailing-underscore routes too — see __root.tsx's comment on
  // why the scroll-edge background itself has to be set there instead).
  head: () => ({ meta: [{ name: "theme-color", content: "#ffffff" }] }),
  component: StoreLayout,
});

const NAV_ITEMS = [
  { label: "Home", to: "/store", icon: Home },
  { label: "Orders", to: "/store/orders", icon: ShoppingBag },
  { label: "Products", to: "/store/products", icon: Package },
  { label: "Collections", to: "/store/collections", icon: Layers },
  { label: "Customers", to: "/store/customers", icon: Users },
  { label: "Growth", to: "/store/growth", icon: TrendingUp },
  { label: "Discounts", to: "/store/discounts", icon: Tag },
  { label: "Content", to: "/store/content", icon: ImageIcon },
  { label: "Finance", to: "/store/finance", icon: Wallet },
];

function StoreLayoutInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useOverlayHistory(drawerOpen, closeDrawer);

  // Close the drawer when the route has actually changed, NOT in the click that
  // starts the navigation.
  //
  // Every link in here used to carry onClick={() => setDrawerOpen(false)}, which
  // tore the drawer down in the middle of the same click that was supposed to
  // navigate — and the navigation then never happened at all. Watching
  // history.pushState from the page confirmed it: clicking "Return to profile"
  // produced no push, and history.length never grew.
  //
  // It is also what made the overlay's history entry impossible to clean up
  // correctly, since at cleanup time the router had not committed anywhere yet
  // and the sheet looked like it had been dismissed in place.
  //
  // Driving it off the committed pathname instead means the close always
  // happens after the navigation, so neither problem can arise. The backdrop
  // and the X still close it directly — those really are dismissals in place.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);
  const { user } = useSession();
  const [username, setUsername] = useState<string | null>(null);
  const { store, stores, setActiveId } = useActiveStore();
  const { rightAction } = useStoreHeader();

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
      <div className="fixed inset-x-0 top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
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
        <div className="flex items-center justify-end min-w-[28px]">{rightAction}</div>
      </div>

      <div className="pt-14">
        <Outlet />
      </div>

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

            {/* The scrolling region. `flex-1` takes the space the header and the
                footer below do not, and `min-h-0` is what actually lets it
                scroll — without it a flex child refuses to shrink past its
                content and the list just overflows the panel silently, which is
                what it was doing with nine items on a short screen.
                `overscroll-contain` stops a flick at the end of the list
                scrolling the page underneath. The native scrollbar track is
                already hidden globally, see styles.css. */}
            <nav className="flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain">
              {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex shrink-0 items-center gap-3.5 px-3 py-4 rounded-xl hover:bg-white/10 text-base transition-colors duration-150"
                  activeProps={{ className: "bg-white/10" }}
                  activeOptions={{ exact: true }}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              ))}
            </nav>

            {/* Stays pinned below the scrolling list rather than scrolling away
                with it. oak-safe-bottom keeps it clear of the home indicator in
                the installed app, where this panel runs to the physical edge. */}
            <div className="shrink-0 mt-3 pt-3 border-t border-white/10 oak-safe-bottom">
              {username && (
                <Link
                  to="/profile/$username"
                  params={{ username }}
                  className="flex items-center gap-3.5 px-3 py-4 rounded-xl hover:bg-white/10 text-base text-gray-300 transition-colors duration-150"
                >
                  <ArrowLeftCircle size={20} />
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

function StoreLayout() {
  return (
    <StoreHeaderProvider>
      <StoreLayoutInner />
    </StoreHeaderProvider>
  );
}
