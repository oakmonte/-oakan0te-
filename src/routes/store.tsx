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
  Palette,
  MapPin,
  Store as StoreIcon,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveStore } from "@/hooks/use-own-store";
import { StoreHeaderProvider } from "@/context/store-header-provider";
import { useStoreHeader } from "@/hooks/use-store-header";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";

export const Route = createFileRoute("/store")({
  // theme-color is NOT declared here any more. The dashboard needs a different
  // value per colour scheme, which takes two <meta> tags distinguished by their
  // `media` attribute — and TanStack dedupes meta by `name` alone, so a pair
  // declared here would collapse into whichever was listed last. RootShell in
  // __root.tsx renders the pair directly instead; see the comment there.
  //
  // This one stays, and still works the old way: a leaf route's head() wins a
  // `name` collision against the root's, so this overrides the root's "light".
  // It is the meta half of the `color-scheme` CSS declaration in styles.css —
  // some engines honour the tag more reliably than the declaration for native
  // form-control theming, which is why both exist.
  head: () => ({
    meta: [
      { name: "color-scheme", content: "light dark" },
      // Belt and braces, and it costs one line. RootShell's media pair is
      // emitted ahead of <HeadContent />, so by the spec's "first tag whose
      // media matches" rule it always wins here and this is never consulted.
      // But without it the root's #000000 is what HeadContent would emit for
      // the dashboard, and a black theme-color reachable on a white screen is
      // the precise bug that shipped twice already. Overriding it to white
      // means the dashboard renders correctly even under a browser that
      // resolved these in the opposite order.
      { name: "theme-color", content: "#ffffff" },
    ],
    // Fraunces is loaded HERE rather than in __root.tsx, mirroring how the
    // landing route scopes Archivo Black to itself. CLAUDE.md's font rule is
    // that only core faces load on every route, and this face is used on
    // /store/* and nowhere else -- the feed and the camera must not pay for it.
    //
    // On this route rather than store.index.tsx because the empty-state
    // headlines it renders also appear on /store/orders, /store/customers and
    // /store/growth.
    //
    // Axis ranges are narrowed to what the two .sd-* classes actually request
    // (see styles.css). If the transferred size ever exceeds ~120KB, swap to
    // Instrument Serif 400 and accept the single weight -- this is a seller's
    // most-opened screen and often on a slow connection.
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@24..36,500..600,20..30,0..1&display=swap",
      },
    ],
  }),
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
  // Store themes has a route and has never been in this list -- until now it
  // was reachable ONLY through the setup checklist, so replacing that checklist
  // with the dashboard would have stranded a finished feature. Pickup locations
  // has the same history but no route (it is a sheet), so it is a button below
  // the list rather than an entry in it.
  { label: "Store themes", to: "/store/theme", icon: Palette },
];

function StoreLayoutInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
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
    <div className="min-h-dvh bg-sd-bg text-sd-ink">
      <div className="fixed inset-x-0 top-0 z-30 bg-sd-surface border-b border-sd-line px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => setDrawerOpen(true)}
          className="-ml-2.5 grid h-11 w-11 place-items-center oak-motion-control active:scale-90"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        {/* The title, not a control. This used to be a bare native <select>
            acting as the page title, which was the only way to switch store.
            Switching now lives in two better places -- the identity block on the
            dashboard home, and the drawer below, which reaches it from every
            screen -- and keeping the select as well would have put two
            switchers that look nothing alike on the same page. */}
        <span className="font-semibold text-sm">{store?.brand_name ?? "Oakmonte Store"}</span>
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
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-black text-white border-r border-white/10 px-2 py-4 flex flex-col animate-in slide-in-from-left duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
            <div className="flex items-center justify-between px-3 mb-4">
              <span className="text-sm text-gray-400">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="-mr-2 grid h-11 w-11 place-items-center oak-motion-control active:scale-90"
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

              {/* Pickup locations is a sheet, not a route (/store/locations does
                  not exist -- only /store/locations/new), so it cannot be a
                  Link. It belongs here regardless: like Store themes it was
                  previously reachable only from the setup checklist, and the
                  dashboard replaces that checklist. */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setLocationsOpen(true);
                }}
                className="flex shrink-0 items-center gap-3.5 px-3 py-4 rounded-xl hover:bg-white/10 text-base text-left transition-colors duration-150"
              >
                <MapPin size={20} />
                Pickup locations
              </button>
            </nav>

            {/* Switching store lives here now, not in the header. The header's
                native <select> was the only way to do it and was also acting as
                the page title; the dashboard's identity block took over the job
                but only exists on the home screen, so without this a seller with
                two stores could not switch from Products or Finance. Rendered
                only when there is something to switch between. */}
            {stores.length > 1 && (
              <div className="shrink-0 mt-3 pt-3 border-t border-white/10">
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                  Your stores
                </p>
                {stores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveId(s.id);
                      setDrawerOpen(false);
                    }}
                    className={`flex w-full shrink-0 items-center gap-3.5 px-3 py-3 rounded-xl text-left text-sm transition-colors duration-150 hover:bg-white/10 ${
                      s.id === store?.id ? "bg-white/10" : "text-gray-300"
                    }`}
                  >
                    <StoreIcon size={18} />
                    <span className="truncate">{s.brand_name}</span>
                  </button>
                ))}
              </div>
            )}

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

      {/* Rendered by the LAYOUT, not the drawer, so closing the drawer that
          opened it does not tear it down in the same breath. */}
      {locationsOpen && store && (
        <LocationsListSheet storeId={store.id} onClose={() => setLocationsOpen(false)} />
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
