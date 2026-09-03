import { createFileRoute, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, type ReactElement } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  Share2,
  Search,
  Menu,
  Star,
  X,
  Pencil,
  Bell,
  BellRing,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { useOwnStores } from "@/hooks/use-own-store";
import { BottomNav } from "@/components/BottomNav";
import { ProfileTabEmptyState } from "@/components/ProfileTabEmptyState";
import { PostsGrid } from "@/components/profile/PostsGrid";
import { PublicStorefront } from "@/components/store-themes/full-previews";
import { Stat, MenuRow } from "@/components/profile/profile-chrome";
import { TABS, type TabKey } from "@/components/profile/profile-tabs";
import { TabPager } from "@/components/profile/TabPager";
import { ProfileTabStrip } from "@/components/profile/ProfileTabStrip";
import { ShareProfileOverlay } from "@/components/profile/ShareProfileOverlay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  profileQueryOptions,
  profileStatsQueryOptions,
  profileStoresQueryOptions,
  followStatusQueryOptions,
} from "@/lib/queries/profile";

export const Route = createFileRoute("/profile/$username")({
  // Fire-and-forget: starts this fetch as early as `intent` preload allows
  // (hover/touch-start on a Link to this route — see router.tsx) without
  // making navigation wait on it. The component below still reads the same
  // query via useQuery in its ordinary non-suspending loading/data pattern,
  // so a cold visit (no preload — e.g. a direct URL) behaves exactly as
  // before; a preloaded one just finds the data already there.
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(profileQueryOptions(params.username));
  },
  head: () => ({ meta: [{ title: "Profile — Oakmonte" }] }),
  component: ProfilePage,
});

type ProfileRow = {
  id: string;
  personal_username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  following_count: number;
  followers_count: number;
  rating: number;
  rating_count: number;
};

const PROFILE_SELLER_PROMPT_KEY = "oak-profile-seller-prompt-seen";

function hasSeenSellerPrompt(userId: string) {
  try {
    return sessionStorage.getItem(`${PROFILE_SELLER_PROMPT_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

function markSellerPromptSeen(userId: string) {
  try {
    sessionStorage.setItem(`${PROFILE_SELLER_PROMPT_KEY}:${userId}`, "1");
  } catch {
    return;
  }
}

function ProfilePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { username } = useParams({ from: "/profile/$username" });
  const { user, loading: sessionLoading } = useSession();
  const { stores: ownedStores, loading: ownedStoresLoading } = useOwnStores();
  const queryClient = useQueryClient();
  const { data: baseProfile, isPending: profileLoading } = useQuery(profileQueryOptions(username));
  // Every read this page does is cached. They used to be raw useEffect
  // fetches with no cache at all, which is what made the page visibly
  // reassemble itself — name "…", counts 0, empty grid — on every single
  // open, even when you'd been here seconds earlier.
  const { data: stats } = useQuery(profileStatsQueryOptions(baseProfile?.id));
  const profile: ProfileRow | null = baseProfile
    ? {
        ...baseProfile,
        following_count: stats?.following_count ?? 0,
        followers_count: stats?.followers_count ?? 0,
        rating: stats?.rating ?? 0,
        rating_count: stats?.rating_count ?? 0,
      }
    : null;
  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: stores = [] } = useQuery(profileStoresQueryOptions(baseProfile?.id));
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Oldest-first, same tie-break as useOwnStores — "the" store for anything
  // on this page that isn't multi-store aware yet (the Store tab preview).
  const store = stores[0] ?? null;
  // theme_id stays null until the seller explicitly saves a theme (see
  // useStoreTheme.ts) — a store row exists as soon as onboarding names it,
  // well before there's anything real to preview, so this is the signal for
  // "actually set up" rather than just "a stores row exists".
  const storeIsSetUp = !!store?.theme_id;
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Where the Store sheet's top edge should sit — the vertical MIDDLE of the
  // avatar circle, so the sheet rises high enough to cover the bottom half of
  // the avatar plus the name/rating/stats/bio below it, with only the top
  // half of the avatar and the header bar left showing (dimmed by the
  // backdrop). Tracked continuously (not just on the tap that opens it) in
  // case layout shifts, e.g. once the avatar image finishes loading.
  const avatarRef = useRef<HTMLImageElement>(null);
  const [sheetTop, setSheetTop] = useState(0);
  // Which tab was active right before Store was opened — tapping above the
  // sheet, or swiping out of it, restores this instead of always landing on
  // Posts.
  const previousTabRef = useRef<TabKey>("posts");
  const { data: isFollowing = false, isPending: followPending } = useQuery(
    followStatusQueryOptions(user?.id, baseProfile?.id),
  );
  const [followBusy, setFollowBusy] = useState(false);
  // Whether the bell shows as "on" — the follows table has no notify column
  // yet, so this is visual/session-only, not persisted.
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [messageHint, setMessageHint] = useState<string | null>(null);
  const [sellerPromptOpen, setSellerPromptOpen] = useState(false);

  const isOwnProfile = !!user && !!profile && user.id === profile.id;
  // Until the session resolves we don't know whose profile this is, and
  // guessing "not yours" meant your own profile briefly rendered a Follow
  // button and a Message button, with no menu and no bottom nav, before
  // swapping — the exact "page reassembling itself" this pass is fixing.
  // Owner-only chrome waits; visitor-only chrome waits too.
  const ownershipKnown = !sessionLoading && !!profile;

  useEffect(() => {
    if (
      !ownershipKnown ||
      !isOwnProfile ||
      !user ||
      ownedStoresLoading ||
      ownedStores.length === 0 ||
      hasSeenSellerPrompt(user.id)
    ) {
      return;
    }

    markSellerPromptSeen(user.id);
    setSellerPromptOpen(true);
  }, [isOwnProfile, ownedStores, ownedStoresLoading, ownershipKnown, user]);

  // Shared with TabPager so the tab strip animates off the same value the
  // content does, frame for frame.
  const pagerX = useMotionValue(0);
  const [pageWidth, setPageWidth] = useState(0);

  // findIndex can't miss (activeTab is always a TabKey), but a -1 would send
  // the pager to +pageWidth and strand it off-screen, so it's clamped.
  const tabIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === activeTab),
  );

  const goToTab = (nextIndex: number) => {
    if (nextIndex >= 0 && nextIndex < TABS.length) {
      setActiveTab(TABS[nextIndex].key);
    }
  };

  // Home and the seller dashboard are the two places people jump to next
  // from a profile most often (the bottom pill, and "Manage store" from the
  // Store sheet) — warming their route chunk here means that tap doesn't
  // pay for it. defaultPreload is "intent" (hover/touch-start), which never
  // fires on a page you're already sitting on, so this is deliberately
  // manual rather than relying on the router's own preload config.
  useEffect(() => {
    router.preloadRoute({ to: "/home" }).catch(() => {});
    router.preloadRoute({ to: "/store" }).catch(() => {});
  }, [router]);

  async function toggleFollow() {
    if (!profile || followBusy) return;
    if (!user) {
      navigate({ to: "/sign-in" });
      return;
    }
    const wasFollowing = isFollowing;
    const followKey = followStatusQueryOptions(user.id, profile.id).queryKey;
    const statsKey = profileStatsQueryOptions(profile.id).queryKey;
    const shiftFollowers = (by: number) =>
      queryClient.setQueryData(statsKey, (old) =>
        old ? { ...old, followers_count: Math.max(0, old.followers_count + by) } : old,
      );

    setFollowBusy(true);
    // Optimistic, straight into the cache so the button and the follower
    // count flip on the tap rather than on the round-trip.
    queryClient.setQueryData(followKey, !wasFollowing);
    shiftFollowers(wasFollowing ? -1 : 1);

    const { error } = wasFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
      : await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    if (error) {
      console.error("ProfilePage: failed to toggle follow", error);
      queryClient.setQueryData(followKey, wasFollowing);
      shiftFollowers(wasFollowing ? 1 : -1);
    } else if (wasFollowing) {
      setNotifyEnabled(false);
    }
    setFollowBusy(false);
  }

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
  }, [profile?.id]);

  // Body scroll lock while the Store sheet is up, same as any bottom sheet —
  // also keeps sheetTop from drifting out from under the sheet mid-view.
  useEffect(() => {
    if (activeTab === "store" && store && storeIsSetUp) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [activeTab, store, storeIsSetUp]);

  const tabRow = (
    <ProfileTabStrip
      activeTab={activeTab}
      onSelect={(key) => {
        if (key === "store") previousTabRef.current = activeTab;
        setActiveTab(key);
      }}
      pagerX={pagerX}
      pageWidth={pageWidth}
    />
  );

  const storeSheetOpen = activeTab === "store" && !!store && storeIsSetUp;

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <button onClick={() => navigate({ to: "/" })} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-5">
          {ownershipKnown && !isOwnProfile && isFollowing && (
            <button
              onClick={() => setNotifyEnabled((v) => !v)}
              aria-label={notifyEnabled ? "Turn off notifications" : "Turn on notifications"}
              className="transition-transform duration-200 active:scale-90"
            >
              {notifyEnabled ? (
                <BellRing size={20} className="text-[#FF7300]" />
              ) : (
                <Bell size={20} />
              )}
            </button>
          )}
          <button onClick={() => setShareOpen(true)} aria-label="Share profile">
            <Share2 size={20} />
          </button>
          <button
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
            className="transition-transform duration-200 active:scale-90"
          >
            <Search size={22} className={searchOpen ? "text-[#FF7300]" : "text-white"} />
          </button>
          {ownershipKnown && isOwnProfile && store && storeIsSetUp && (
            <button
              onClick={() =>
                stores.length > 1
                  ? setStorePickerOpen(true)
                  : navigate({
                      to: "/store-profile/$storeUsername",
                      params: { storeUsername: store.store_username },
                    })
              }
              aria-label="Switch to store profile"
              className="transition-transform duration-200 active:scale-90"
            >
              <ArrowLeftRight size={20} />
            </button>
          )}
          {ownershipKnown && isOwnProfile && (
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

      {/* Profile info */}
      <div className="flex flex-col items-center gap-4 px-6 mt-2">
        {/* The photo is the share affordance — tapping it opens the full-screen
            share view, same as both references. */}
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="Share profile"
          className="transition-transform duration-150 active:scale-95"
        >
          <img
            ref={avatarRef}
            src={profile?.avatar_url || "https://placehold.co/135x139"}
            alt={username}
            loading="eager"
            className="w-[110px] h-[110px] rounded-full border-[3px] border-white object-cover"
          />
        </button>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            {/* The username from the URL is already the right width and
                almost always the right text, so it stands in while the row
                loads instead of an ellipsis that then jumps to a longer
                name. */}
            <div className={`text-[15px] font-bold ${profileLoading ? "opacity-40" : ""}`}>
              {profile?.display_name || profile?.personal_username || username}
            </div>
            {isOwnProfile && (
              <button
                onClick={() => navigate({ to: "/edit-profile" })}
                aria-label="Edit profile"
                className="text-white/50 hover:text-white transition-colors"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          <div className="text-[11px] font-bold text-[#B0ADAD] mt-0.5">
            @{profile?.personal_username || username}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <div className="flex items-center gap-[2px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className="fill-[#FF7300] text-[#FF7300]" />
              ))}
            </div>
            <span className="text-[11px] font-medium">({profile?.rating_count ?? 0})</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <Stat value={String(profile?.following_count ?? 0)} label="Following" />
          <Stat value={String(profile?.followers_count ?? 0)} label="Followers" />
        </div>

        {ownershipKnown && !isOwnProfile && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleFollow}
              // Also disabled until the follow query resolves: tapping while
              // it defaulted to "Follow" fired an insert on a row that might
              // already exist, and the optimistic flip bounced back.
              disabled={followBusy || followPending}
              className={`min-w-[110px] rounded-full px-6 py-2 text-[13px] font-bold transition-colors active:scale-95 disabled:opacity-60 ${
                isFollowing ? "bg-white/10 text-white" : "bg-white text-black"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button
              onClick={() => {
                setMessageHint("Messaging is coming soon");
                setTimeout(() => setMessageHint(null), 2500);
              }}
              aria-label="Message"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-transform active:scale-90"
            >
              <Send size={15} />
            </button>
          </div>
        )}
        {messageHint && <p className="text-[11px] text-white/50">{messageHint}</p>}

        {profile?.bio && <p className="text-[14px] font-bold text-center">{profile.bio}</p>}
      </div>

      {/* Kept mounted even while the Store sheet is up. Unmounting it there
          hard-cut the pager mid-swipe: releasing a drag onto Store flipped
          storeSheetOpen in the same commit, so the settle spring never drew
          a frame and the content just vanished. The sheet is fixed z-50 over
          this anyway, so it simply settles behind the rising sheet. */}
      {
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

          {/* Content pager. Every tab is a real page in one horizontal
              track that follows the finger 1:1 — see TabPager for what this
              replaces and why. Pages stay mounted, so paging back is
              instant and nothing refetches. */}
          <div className="pb-24">
            <TabPager
              index={tabIndex}
              count={TABS.length}
              onIndexChange={goToTab}
              x={pagerX}
              onPageWidth={setPageWidth}
            >
              {TABS.map(({ key }) => (
                <div key={key} className="px-1 pt-4">
                  {profile && key === "posts" ? (
                    <PostsGrid
                      userId={profile.id}
                      status="published"
                      emptyState={<ProfileTabEmptyState tab="posts" isOwnProfile={isOwnProfile} />}
                    />
                  ) : profile && key === "drafts" && isOwnProfile ? (
                    <PostsGrid
                      userId={profile.id}
                      status="draft"
                      emptyState={<ProfileTabEmptyState tab="drafts" />}
                    />
                  ) : key === "store" && isOwnProfile && !storeIsSetUp ? (
                    <div className="flex flex-col items-center text-center px-8 pt-16 gap-3">
                      <h3 className="text-[16px] font-bold">Set up your store</h3>
                      <p className="text-[13px] text-white/50 max-w-[220px]">
                        Add your products, pickup locations, and storefront look to start selling.
                      </p>
                      <button
                        onClick={() => navigate({ to: "/store" })}
                        className="mt-1 rounded-full bg-white text-black px-6 py-2.5 text-[14px] font-semibold"
                      >
                        Set up store
                      </button>
                    </div>
                  ) : (
                    <ProfileTabEmptyState tab={key} isOwnProfile={isOwnProfile} />
                  )}
                </div>
              ))}
            </TabPager>
          </div>
        </>
      }

      {/* Store sheet — Store is the one tab that rises up over the rest of
          the page instead of sitting flat under the tab row like every other
          tab. No tab row of its own inside it: swiping left/right moves to
          the adjacent tab (same drag gesture as the flat content grid),
          closing the sheet since that tab isn't "store" anymore. Tapping
          anywhere above it (the header/top of the avatar, still visible
          above the sheet, dimmed by the backdrop) restores whichever tab was
          active before Store was opened. No explicit close button by design. */}
      <AnimatePresence>
        {storeSheetOpen && (
          <motion.div
            key="store-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/55"
            onClick={() => setActiveTab(previousTabRef.current)}
          />
        )}
        {storeSheetOpen && (
          <motion.div
            key="store-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            style={{ top: sheetTop }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
          >
            {/* No black strip here on purpose — the theme's own background
                (set on PublicStorefront's outer div, different per theme)
                runs all the way up into the rounded corners. The grabber
                floats over it instead of owning its own row: mix-blend-
                difference gives it contrast against ANY theme color without
                per-theme casing, and pointer-events-none lets the drag
                gesture below still start from underneath it. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2.5">
              <div className="h-1 w-9 rounded-full bg-white mix-blend-difference" />
            </div>
            {/* dragElastic stays high: pinned constraints with a near-zero
                elastic (what this was) clamp the visible travel to a few px,
                so the sheet read as unresponsive even though onDragEnd fired. */}
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) goToTab(tabIndex + 1);
                else if (info.offset.x > 60) goToTab(tabIndex - 1);
              }}
              className="flex-1 overflow-y-auto pb-24"
            >
              {store && <PublicStorefront storeId={store.id} />}
            </motion.div>
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

          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">
            Creation &amp; business
          </div>
          <MenuRow label="Oakmonte Studio" onClick={() => navigate({ to: "/studio" })} />
          <MenuRow label="Oakmonte Store" onClick={() => navigate({ to: "/store" })} />

          <div className="text-[11px] uppercase tracking-wide text-white/40 mt-6 mb-2">
            Personal
          </div>
          <MenuRow label="Activity centre" onClick={() => navigate({ to: "/activity" })} />
          <MenuRow label="Offline videos" onClick={() => navigate({ to: "/offline-videos" })} />

          <div className="mt-6 pt-4 border-t border-white/10">
            <MenuRow label="Settings and privacy" onClick={() => navigate({ to: "/settings" })} />
          </div>
        </div>
      </div>

      {/* Store switcher — only ever reachable once an account owns more than
          one store (not enabled anywhere yet), so this sits unused until
          then. Bottom sheet, not the ArrowLeftRight tap's old direct jump,
          since with 2+ stores that tap no longer has a single obvious
          destination. */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          storePickerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setStorePickerOpen(false)} />
        <div
          className={`absolute inset-x-0 bottom-0 rounded-t-[28px] bg-black border-t border-white/10 transition-transform duration-300 ease-out ${
            storePickerOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="h-1 w-9 rounded-full bg-white/25" />
          </div>
          <p className="px-5 pt-2 pb-1 text-[11px] font-semibold text-white/40 uppercase tracking-wide">
            Switch to
          </p>
          <div className="pb-4">
            {stores.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStorePickerOpen(false);
                  navigate({
                    to: "/store-profile/$storeUsername",
                    params: { storeUsername: s.store_username },
                  });
                }}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left active:bg-white/5 transition-colors duration-150"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white truncate">{s.brand_name}</p>
                  <p className="text-[12px] text-white/40">@{s.store_username}</p>
                </div>
                <ArrowLeftRight size={16} className="text-white/30 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav — shown only when viewing your own profile, and hidden
          while the Store sheet is up (it has no use there and just crowds
          the storefront). */}
      {isOwnProfile && !storeSheetOpen && (
        <BottomNav active="profile" ownUsername={profile?.personal_username || username} />
      )}

      <ShareProfileOverlay
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        avatarUrl={profile?.avatar_url ?? null}
        shareUrl={
          typeof window !== "undefined"
            ? `${window.location.origin}/profile/${profile?.personal_username || username}`
            : ""
        }
      />

      <Dialog open={sellerPromptOpen} onOpenChange={setSellerPromptOpen}>
        <DialogContent className="w-[calc(100%-32px)] max-w-sm rounded-xl border-gray-200 bg-white p-5 text-gray-900">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[18px]">What would you like to do?</DialogTitle>
            <DialogDescription className="pt-1 text-sm text-gray-500">
              Share something with your audience or keep building your store.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setSellerPromptOpen(false)}
              className="w-full rounded-xl bg-black py-3 text-[15px] font-semibold text-white"
            >
              Upload or create content
            </button>
            <button
              type="button"
              onClick={() => {
                setSellerPromptOpen(false);
                navigate({ to: "/store" });
              }}
              className="w-full rounded-xl border border-gray-200 py-3 text-[15px] font-medium text-gray-900"
            >
              Set up my store
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
