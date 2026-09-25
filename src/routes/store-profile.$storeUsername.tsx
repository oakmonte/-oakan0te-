import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useDragControls, useMotionValue } from "framer-motion";
import { ArrowLeft, ArrowLeftRight, Share2, Search, Menu, Star, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { fetchStoreLogoUrl } from "@/lib/store-logo";
import { useSession } from "@/hooks/use-session";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useStoreCatalogReadiness, isStorefrontVisible } from "@/hooks/use-store-catalog-readiness";
import { BottomNav } from "@/components/BottomNav";
import { ProfileTabEmptyState } from "@/components/ProfileTabEmptyState";
import { PublicStorefront } from "@/components/store-themes/full-previews";
import { Stat, MenuRow } from "@/components/profile/profile-chrome";
import { storeTabsFor, type TabKey } from "@/components/profile/profile-tabs";
import { StorePiecesGrid, StorePiecesEmptyState } from "@/components/profile/StorePiecesGrid";
import { TabPager } from "@/components/profile/TabPager";
import { ProfileTabStrip } from "@/components/profile/ProfileTabStrip";

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
  personal_storefront_only: boolean;
  theme_id: string | null;
  store_type: string | null;
};

function StoreProfilePage() {
  const navigate = useNavigate();
  const { storeUsername } = useParams({ from: "/store-profile/$storeUsername" });
  const { user, loading: sessionLoading } = useSession();
  const [store, setStore] = useState<StoreRow | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("store");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useOverlayHistory(menuOpen, closeMenu);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // See profile.$username.tsx for why this is tracked continuously rather
  // than only captured on the tap that opens the sheet — and why it targets
  // the avatar circle, not the whole info block.
  const avatarRef = useRef<HTMLImageElement>(null);
  const [sheetTop, setSheetTop] = useState(0);
  // Which tab was active right before Store was opened — see
  // profile.$username.tsx.
  const previousTabRef = useRef<TabKey>("posts");
  // Drag-to-dismiss is started by hand from the sheet's grab strip rather
  // than by a dragListener on the sheet itself: the sheet's body is a
  // scrolling storefront whose product tiles are horizontal carousels, and a
  // listener spanning all of it would swallow both of those gestures.
  const storeSheetDrag = useDragControls();

  const isOwnStoreProfile = !!user && !!store && user.id === store.owner_id;
  // Only fetched once we can actually trust `!isOwnStoreProfile` -- before
  // the session and the store row have both loaded, that reads false for
  // everyone including the true owner, which used to fire this against the
  // owner's own store on every visit and throw the result away a moment
  // later. See profile.$username.tsx's matching comment and
  // useStoreCatalogReadiness for why this check exists at all.
  const catalogReadiness = useStoreCatalogReadiness(
    !sessionLoading && !storeLoading && !isOwnStoreProfile ? (store?.id ?? null) : null,
  );

  const isArtist = store?.store_type === "Artist";
  const storeTabs = useMemo(() => storeTabsFor(store?.store_type ?? null), [store?.store_type]);

  // Shared with TabPager so the strip animates off the same value the content
  // does, frame for frame.
  const pagerX = useMotionValue(0);
  const [pageWidth, setPageWidth] = useState(0);
  const tabIndex = Math.max(
    0,
    storeTabs.findIndex((t) => t.key === activeTab),
  );

  const goToTab = (nextIndex: number) => {
    if (nextIndex >= 0 && nextIndex < storeTabs.length) {
      setActiveTab(storeTabs[nextIndex].key);
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
      .select(
        "id, store_username, brand_name, bio, owner_id, personal_storefront_only, theme_id, store_type",
      )
      .eq("store_username", storeUsername)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          console.error("StoreProfilePage: failed to load store", error);
          setStoreLoading(false);
          return;
        }

        const storeRow = data;

        // Paint the header the instant the store row resolves, with the logo
        // null until the customizations read below fills it in — this also
        // unblocks the owner-username effect below (gated on [store]) instead
        // of making it wait behind the store_theme_customizations round-trip
        // too. The caller falls back to a placeholder when logo_url is null,
        // so there's visual continuity either way.
        setStore({ ...storeRow, logo_url: null });
        setStoreLoading(false);

        // Resolved through lib/store-logo.ts, the same function the seller's
        // dashboard uses, so the two can never disagree about one store's
        // picture: the store's own logo first (stores.logo_url, set from the
        // dashboard's + button), then the logo saved on its storefront theme --
        // including the "motion" slug a store that never picked a theme is
        // silently on. That fallback's full reasoning lives there now.
        void fetchStoreLogoUrl(storeRow.id).then((logoUrl) => {
          if (cancelled) return;
          setStore((prev) =>
            prev && prev.id === storeRow.id ? { ...prev, logo_url: logoUrl } : prev,
          );
        });
      });
    return () => {
      cancelled = true;
    };
  }, [storeUsername]);

  useEffect(() => {
    if (!store) {
      setOwnerUsername(null);
      return;
    }
    let cancelled = false;

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

  // A store that opted out of a standalone storefront still has a real
  // stores row and a real Store tab — it just has no /store-profile
  // destination of its own to land on. Redirect rather than 404, since a
  // seller can flip this toggle after old links to this URL are already out
  // there (shared, bookmarked, indexed).
  useEffect(() => {
    if (store?.personal_storefront_only && ownerUsername) {
      navigate({ to: "/profile/$username", params: { username: ownerUsername }, replace: true });
    }
  }, [store, ownerUsername, navigate]);

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  useEffect(() => {
    const el = avatarRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSheetTop(rect.top + rect.height / 2);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [store]);

  // This route had no readiness gate at all before -- any store row, even one
  // with no theme picked, opened the sheet. Same shared gate
  // profile.$username.tsx uses (see isStorefrontVisible) -- worth calling out
  // here specifically that this route defaults `activeTab` to "store", so
  // getting the "loading counts as visible" half of that rule right matters
  // even more: gating on "hidden while loading" would animate the sheet open
  // on its own the instant the two count queries resolved, on every visit.
  const storefrontVisible = isStorefrontVisible(
    store?.theme_id,
    isOwnStoreProfile,
    catalogReadiness,
  );

  // Body scroll lock while the Store sheet is up, same as any bottom sheet —
  // also keeps sheetTop from drifting out from under the sheet mid-view.
  useBodyScrollLock(activeTab === "store" && !!store && storefrontVisible);

  const tabRow = (
    <ProfileTabStrip
      activeTab={activeTab}
      onSelect={(key) => {
        if (key === "store") previousTabRef.current = activeTab;
        setActiveTab(key);
      }}
      pagerX={pagerX}
      pageWidth={pageWidth}
      tabs={storeTabs}
    />
  );

  const storeSheetOpen = activeTab === "store" && !!store && storefrontVisible;
  const closeStoreSheet = () => setActiveTab(previousTabRef.current);

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <motion.div
        // Pushes back slightly while the Store sheet is up, timed to the
        // sheet's own rise/fall — a small Apple-style depth cue so the sheet
        // reads as being on top of something, not just painted over it.
        // Scoped to just this content wrapper, not the page root: framer
        // motion keeps a `transform` inline on whatever it's animating even
        // at rest, and any non-none `transform` on an ancestor becomes the
        // containing block for that ancestor's `position: fixed`
        // descendants — which would silently detach BottomNav, the
        // hamburger panel, and the Store sheet itself from the real
        // viewport if this scale lived on the page root.
        animate={{ scale: storeSheetOpen ? 0.97 : 1 }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="w-[22px]">
            <BackButton />
          </div>
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
            ref={avatarRef}
            src={store?.logo_url || "https://placehold.co/135x139"}
            alt={storeUsername}
            loading="eager"
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
            {/* A store follow relationship doesn't exist in the schema yet
              (`follows` only links profile to profile) — these sit at 0 as
              placeholders, same as sold_items_count/rating on profile_stats
              until that's wired up. */}
            <Stat value="0" label="Following" />
            <Stat value="0" label="Followers" />
            <Stat value="0" label="Sold Items" />
          </div>

          {store?.bio && <p className="text-[14px] font-bold text-center">{store.bio}</p>}
        </div>

        {!storeSheetOpen && (
          <>
            {/* Tab row */}
            <div className="mt-6 border-b border-[#474747]">{tabRow}</div>

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

            {/* Content pager — the same component the personal profile uses, so
              swiping behaves identically on both. This used to be its own
              third variant: an AnimatePresence crossfade with drag pinned to
              zero constraints at 0.15 elastic, i.e. a swipe that moved the
              content a finger's width and sprang back. */}
            <div className="pb-24">
              <TabPager
                index={tabIndex}
                count={storeTabs.length}
                onIndexChange={goToTab}
                x={pagerX}
                onPageWidth={setPageWidth}
              >
                {storeTabs.map(({ key }) => (
                  <div key={key} className="px-1 pt-4">
                    {key === "wardrobe" && store ? (
                      <StorePiecesGrid
                        storeId={store.id}
                        storeUsername={store.store_username}
                        isOwnStoreProfile={isOwnStoreProfile}
                        emptyState={
                          <StorePiecesEmptyState
                            isArtist={isArtist}
                            isOwnStoreProfile={isOwnStoreProfile}
                            storeId={store.id}
                            storeUsername={store.store_username}
                          />
                        }
                      />
                    ) : (
                      <ProfileTabEmptyState tab={key} isOwnProfile={isOwnStoreProfile} />
                    )}
                  </div>
                ))}
              </TabPager>
            </div>
          </>
        )}
      </motion.div>

      {/* Store sheet — Store is the one tab that rises up over the rest of
          the page instead of sitting flat under the tab row like every other
          tab. Swiping INTO it from an adjacent tab still works — that is the
          pager behind it — but once it is up, horizontal gestures stay
          inside, for the carousels in the storefront's tiles. Leaving is a
          tap on the blurred backdrop or a drag down on the grab strip, both
          restoring whichever tab was active before Store was opened. No
          explicit close button by design. */}
      <AnimatePresence>
        {storeSheetOpen && (
          <motion.div
            key="store-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/45"
            // Blurs what is painted beneath it rather than filtering the
            // profile page itself. A CSS filter on an ancestor makes that
            // ancestor the containing block for every fixed-position child,
            // which would drop this very sheet out of viewport positioning —
            // and it repaints the whole profile instead of compositing one
            // layer. The black is lighter than it was because the blur is
            // now doing most of the separating.
            style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
            onClick={closeStoreSheet}
          />
        )}
        {storeSheetOpen && (
          <motion.div
            key="store-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            drag="y"
            dragControls={storeSheetDrag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) closeStoreSheet();
            }}
            style={{ top: sheetTop }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
          >
            {/* See profile.$username.tsx for why there's no black strip
                here — the theme's own background runs up into the rounded
                corners, and the grabber just floats on top of it. */}
            <div
              onPointerDown={(e) => storeSheetDrag.start(e)}
              style={{ touchAction: "none" }}
              className="absolute inset-x-0 top-0 z-20 flex h-9 cursor-grab justify-center pt-2.5 active:cursor-grabbing"
            >
              <div className="pointer-events-none h-1 w-9 rounded-full bg-white mix-blend-difference" />
            </div>
            {/* Deliberately not a drag target any more. A horizontal drag
                here used to page to the adjacent tab, which made the
                storefront the one place a sideways swipe threw you out of
                what you were looking at — and it competed for the very same
                gesture as the product tiles own photo carousels. Inside the
                sheet, left/right belongs to those carousels alone. */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {store && <PublicStorefront storeId={store.id} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Bottom nav — shown only when viewing your own store profile, and
          hidden while the Store sheet is up (it has no use there and just
          crowds the storefront). */}
      {isOwnStoreProfile && ownerUsername && !storeSheetOpen && (
        <BottomNav active="profile" ownUsername={ownerUsername} />
      )}
    </div>
  );
}
