import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowLeftRight, Share2, Search, Menu, Star, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { BottomNav } from "@/components/BottomNav";
import { ProfileTabEmptyState } from "@/components/ProfileTabEmptyState";
import { PublicStorefront } from "@/components/store-themes/full-previews";
import { Stat, MenuRow } from "@/components/profile/profile-chrome";
import { TABS, type TabKey } from "@/components/profile/profile-tabs";

export const Route = createFileRoute("/store-profile/$storeUsername")({
  head: () => ({ meta: [{ title: "Store — Oakmonte" }] }),
  component: StoreProfilePage,
});

// The same profile shell as /profile/$username, wearing a store's identity
// instead of a person's — brand_name/store_username/logo stand in for
// display_name/personal_username/avatar_url. Every tab except Store (the
// one thing the two profiles deliberately share — see StoreFrontGrid) is
// intentionally separate content, not a re-show of the owner's personal
// posts/wardrobe/etc: there's no schema linking those to a store, and a
// store isn't the same identity as the person who owns it.
type StoreRow = {
  id: string;
  store_username: string;
  brand_name: string;
  bio: string | null;
  owner_id: string;
  logo_url: string | null;
};

function StoreProfilePage() {
  const navigate = useNavigate();
  const { storeUsername } = useParams({ from: "/store-profile/$storeUsername" });
  const { user } = useSession();
  const [store, setStore] = useState<StoreRow | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("store");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<TabKey, HTMLButtonElement | null>>(
    {} as Record<TabKey, HTMLButtonElement | null>,
  );

  const isOwnStoreProfile = !!user && !!store && user.id === store.owner_id;

  const tabIndex = TABS.findIndex((t) => t.key === activeTab);

  const goToTab = (nextIndex: number) => {
    if (nextIndex >= 0 && nextIndex < TABS.length) {
      setActiveTab(TABS[nextIndex].key);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setStoreLoading(true);
    // stores has RLS off project-wide today (see supabase-data-access
    // skill), so a plain select works for any viewer, same as the seller
    // dashboard's own reads.
    supabase
      .from("stores")
      .select("id, store_username, brand_name, bio, owner_id")
      .eq("store_username", storeUsername)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          console.error("StoreProfilePage: failed to load store", error);
          setStoreLoading(false);
          return;
        }

        const { data: theme } = await supabase
          .from("store_theme_customizations")
          .select("logo_image_url")
          .eq("store_id", data.id)
          .maybeSingle();
        if (cancelled) return;

        setStore({ ...data, logo_url: theme?.logo_image_url ?? null });
        setStoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeUsername]);

  useEffect(() => {
    if (!store) {
      setProductCount(0);
      setOwnerUsername(null);
      return;
    }
    let cancelled = false;

    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("status", "active")
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) console.error("StoreProfilePage: failed to count products", error);
        setProductCount(count ?? 0);
      });

    // public_profiles, not profiles: same RLS reason as /profile/$username —
    // profiles only ever returns the signed-in user's own row.
    supabase
      .from("public_profiles")
      .select("personal_username")
      .eq("id", store.owner_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("StoreProfilePage: failed to load owner", error);
        setOwnerUsername(data?.personal_username ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  useEffect(() => {
    const btn = tabButtonRefs.current[activeTab];
    if (btn) {
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeTab]);

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <button onClick={() => navigate({ to: ".." })} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-5">
          <button aria-label="Share">
            <Share2 size={20} />
          </button>
          <button
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
            className="transition-transform duration-200 active:scale-90"
          >
            <Search size={22} className={searchOpen ? "text-[#FF7300]" : "text-white"} />
          </button>
          {ownerUsername && (
            <button
              onClick={() =>
                navigate({ to: "/profile/$username", params: { username: ownerUsername } })
              }
              aria-label="Switch to personal profile"
              className="transition-transform duration-200 active:scale-90"
            >
              <ArrowLeftRight size={20} />
            </button>
          )}
          {isOwnStoreProfile && (
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
              className="transition-transform duration-200 active:scale-90"
            >
              <Menu size={22} />
            </button>
          )}
        </div>
      </div>

      {/* Store info */}
      <div className="flex flex-col items-center gap-4 px-6 mt-2">
        <img
          src={store?.logo_url || "https://placehold.co/135x139"}
          alt={storeUsername}
          className="w-[110px] h-[110px] rounded-full border-[3px] border-white object-cover"
        />
        <div className="text-center">
          <div className="text-[15px] font-bold">
            {storeLoading ? "…" : store?.brand_name || storeUsername}
          </div>
          <div className="text-[11px] font-bold text-[#B0ADAD] mt-0.5">
            @{store?.store_username || storeUsername}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <div className="flex items-center gap-[2px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className="fill-[#FF7300] text-[#FF7300]" />
              ))}
            </div>
            <span className="text-[11px] font-medium">(0)</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <Stat value={String(productCount)} label="Products" />
        </div>

        {store?.bio && <p className="text-[14px] font-bold text-center">{store.bio}</p>}
      </div>

      {/* Tab row */}
      <div className="mt-6 border-b border-[#474747]">
        <div
          ref={tabScrollRef}
          className="grid grid-flow-col auto-cols-[20%] gap-x-2 px-6 overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
        >
          {TABS.map(({ key, label, Icon, size }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                ref={(el) => {
                  tabButtonRefs.current[key] = el;
                }}
                onClick={() => setActiveTab(key)}
                aria-label={label}
                className="flex flex-col items-center gap-2 snap-start pt-3 pb-2 transition-transform duration-150 active:scale-90"
              >
                <Icon
                  className={`${size ?? "w-[21px] h-[21px]"} transition-all duration-200 ${
                    isActive ? "text-white opacity-100" : "text-white/40 opacity-100"
                  }`}
                />
                <span
                  className={`block h-[2px] rounded-full bg-white transition-all duration-300 ease-out ${
                    isActive ? "w-6 opacity-100" : "w-0 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline search */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          searchOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`px-6 pt-3 pb-1 transition-opacity duration-300 ${
              searchOpen ? "opacity-100 delay-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center gap-2.5 rounded-xl border border-[#FFFBFB] px-4 py-2.5">
              <Search size={18} className="text-white shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-[16px] placeholder:text-white/50 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} aria-label="Clear search">
                  <X size={16} className="text-white/60" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="overflow-hidden pb-24">
        <AnimatePresence mode="wait" custom={tabIndex}>
          <motion.div
            key={activeTab}
            custom={tabIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) goToTab(tabIndex + 1);
              else if (info.offset.x > 60) goToTab(tabIndex - 1);
            }}
            className={activeTab === "store" && store ? "" : "px-1 pt-4"}
          >
            {activeTab === "store" && store ? (
              <PublicStorefront storeId={store.id} />
            ) : (
              <ProfileTabEmptyState tab={activeTab} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hamburger side panel */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
        <div
          className={`absolute right-0 top-0 h-full w-[280px] bg-black border-l border-white/10 px-5 py-6 transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <button onClick={() => setMenuOpen(false)} className="mb-6" aria-label="Close menu">
            <ArrowLeft size={20} />
          </button>

          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Store</div>
          <MenuRow label="Manage store" onClick={() => navigate({ to: "/store" })} />
          {ownerUsername && (
            <MenuRow
              label="Return to personal profile"
              onClick={() =>
                navigate({ to: "/profile/$username", params: { username: ownerUsername } })
              }
            />
          )}

          <div className="mt-6 pt-4 border-t border-white/10">
            <MenuRow label="Settings and privacy" onClick={() => navigate({ to: "/settings" })} />
          </div>
        </div>
      </div>

      {/* Bottom nav — shown only when viewing your own store profile */}
      {isOwnStoreProfile && ownerUsername && (
        <BottomNav active="profile" ownUsername={ownerUsername} />
      )}
    </div>
  );
}
