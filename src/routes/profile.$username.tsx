import { createFileRoute, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  type ReactElement,
} from "react";
import {
  motion,
  AnimatePresence,
  useDragControls,
  useMotionValue,
  useTransform,
} from "framer-motion";
import type { MotionValue } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  Share2,
  Search,
  Menu,
  Star,
  Store,
  X,
  Bell,
  BellRing,
  Send,
  ChevronUp,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { useOwnStores } from "@/hooks/use-own-store";
import { useStoreSetupStatus } from "@/hooks/use-store-setup-status";
import { useStoreCatalogReadiness, isStorefrontVisible } from "@/hooks/use-store-catalog-readiness";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
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
  // Drawers and sheets each take a history entry, so one back press closes
  // the thing on top rather than leaving the profile.
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useOverlayHistory(menuOpen, closeMenu);
  const { data: stores = [] } = useQuery(profileStoresQueryOptions(baseProfile?.id));
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const closeStorePicker = useCallback(() => setStorePickerOpen(false), []);
  useOverlayHistory(storePickerOpen, closeStorePicker);
  const [shareOpen, setShareOpen] = useState(false);
  // Oldest-first, same tie-break as useOwnStores — "the" store for anything
  // on this page that isn't multi-store aware yet (the Store tab preview).
  const store = stores[0] ?? null;
  // theme_id stays null until the seller explicitly saves a theme (see
  // useStoreTheme.ts) — a store row exists as soon as onboarding names it,
  // well before there's anything real to preview, so this is the signal for
  // "actually set up" rather than just "a stores row exists".
  const storeIsSetUp = !!store?.theme_id;
  const isOwnProfile = !!user && !!profile && user.id === profile.id;
  // Full four-step checklist (payout, pickup location, a product listed, a
  // theme picked) — the same "done" store.index.tsx's own cards use, and a
  // stricter bar than storeIsSetUp above (which only checks the theme, for
  // the narrower "is there enough to preview a storefront" question). This
  // one gates the seller prompt below: a store row existing, or even having
  // a theme, isn't "already set up my store" the way a seller means it.
  //
  // Null for anyone else's profile, which is most views of this page. `store`
  // above belongs to the profile being *viewed*, so passing it unconditionally
  // fired four round trips — three Supabase counts plus an authed payout
  // fetch — against a stranger's store on every visit, and RLS is off on
  // `stores`/`products`, so they succeeded rather than coming back empty.
  // Every value it returns is read behind `isOwnProfile` anyway.
  const storeSetupStatus = useStoreSetupStatus(isOwnProfile ? (store?.id ?? null) : null);
  // The reverse scope of storeSetupStatus above: only fetched for a NON-owner
  // viewer, because the owner must always be able to see and edit their own
  // in-progress storefront regardless of catalog state -- only a stranger is
  // gated on whether there's actually anything real to show them (see
  // storefrontVisible below, and useStoreCatalogReadiness's own comment for
  // why CollectionsGrid's demo-product fallback makes this necessary).
  //
  // Gated on the session having actually resolved (same condition
  // `ownershipKnown` below uses), not just `!isOwnProfile` -- before the
  // session loads, `isOwnProfile` reads false for EVERYONE, including the
  // store's own owner, which used to fire this against the owner's own store
  // on every visit and throw the result away the instant `user` resolved.
  const catalogReadiness = useStoreCatalogReadiness(
    !sessionLoading && !!profile && !isOwnProfile ? (store?.id ?? null) : null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Where the Store sheet's top edge should sit — near the TOP of the avatar
  // circle, so the sheet covers most of the avatar plus the name/rating/
  // stats/bio below it, with only a sliver of the avatar and the header bar
  // left showing (dimmed by the backdrop). Tracked continuously (not just on the tap that opens it) in
  // case layout shifts, e.g. once the avatar image finishes loading.
  const avatarRef = useRef<HTMLImageElement>(null);
  const [sheetTop, setSheetTop] = useState(0);
  // Which tab was active right before Store was opened — tapping outside the
  // sheet, or dragging it down, restores this instead of always landing on
  // Posts.
  const previousTabRef = useRef<TabKey>("posts");
  // Drag-to-dismiss is started by hand from the sheet's grab strip rather
  // than by a dragListener on the sheet itself: the sheet's body is a
  // scrolling storefront whose product tiles are horizontal carousels, and a
  // listener spanning all of it would swallow both of those gestures.
  const storeSheetDrag = useDragControls();
  // Where a pull-past-the-end gesture began, or null when it didn't start at
  // the bottom of the storefront. See the sheet's scroller.
  const pullOutRef = useRef<number | null>(null);
  const { data: isFollowing = false, isPending: followPending } = useQuery(
    followStatusQueryOptions(user?.id, baseProfile?.id),
  );
  const [followBusy, setFollowBusy] = useState(false);
  // Whether the bell shows as "on" — the follows table has no notify column
  // yet, so this is visual/session-only, not persisted.
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [messageHint, setMessageHint] = useState<string | null>(null);
  const [sellerPromptOpen, setSellerPromptOpen] = useState(false);

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
      storeSetupStatus.loading ||
      // Already finished the checklist — the prompt's whole job was getting
      // them through onboarding, and it has nothing left to nudge them
      // toward. Without this a fully set-up seller would see "Set up my
      // store" forever, once per session, for no reason.
      storeSetupStatus.complete ||
      hasSeenSellerPrompt(user.id)
    ) {
      return;
    }

    markSellerPromptSeen(user.id);
    setSellerPromptOpen(true);
  }, [
    isOwnProfile,
    ownedStores,
    ownedStoresLoading,
    ownershipKnown,
    storeSetupStatus.complete,
    storeSetupStatus.loading,
    user,
  ]);

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
      // A fifth of the way down the avatar, not its middle: the sheet sat a
      // little low, and the storefront deserves the extra ~30px. Still low
      // enough that the top of the avatar shows above it.
      setSheetTop(rect.top + rect.height * 0.2);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
    // Re-measured when the tab changes (i.e. when Store opens) rather than on
    // every scroll event. This used to listen to window scroll and setState on
    // each one, which re-rendered the WHOLE profile — pager, grids and all — on
    // every frame of a scroll, and was the main reason scrolling here felt
    // heavy. The value only matters at the moment the sheet rises, and the
    // page is scroll-locked while it's up, so it can't drift underneath.
  }, [profile?.id, activeTab]);

  // --- TikTok-style scroll ----------------------------------------------------
  // The header (avatar, name, stats, bio) scrolls away; the top bar and the tab
  // strip stay pinned, and the top bar picks up the name once the big one has
  // gone. Each tab remembers how far down it was: switching tabs while the
  // strip is pinned lands the new tab where you left it (or at its top), with
  // the strip still pinned — instead of the page jumping by however much
  // taller or shorter the new tab's content is.
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarH, setTopBarH] = useState(48);
  useLayoutEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const measure = () => setTopBarH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nameRef = useRef<HTMLDivElement>(null);
  const [nameScrolledAway, setNameScrolledAway] = useState(false);
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    // An observer, not a scroll listener: it fires on the crossing only.
    const io = new IntersectionObserver(
      ([entry]) => {
        setNameScrolledAway(!entry.isIntersecting && entry.boundingClientRect.top < topBarH);
      },
      { rootMargin: `-${Math.round(topBarH)}px 0px 0px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [topBarH, profile?.id]);

  const stripAnchorRef = useRef<HTMLDivElement>(null);
  const tabScroll = useRef<Partial<Record<TabKey, number>>>({});
  const lastTabRef = useRef(activeTab);
  useLayoutEffect(() => {
    const prev = lastTabRef.current;
    lastTabRef.current = activeTab;
    // Store is a sheet over the page, not a page in the scroll — and the body
    // is scroll-locked while it's up.
    if (prev === activeTab || prev === "store" || activeTab === "store") return;
    const anchor = stripAnchorRef.current;
    if (!anchor) return;
    const stickAt = anchor.getBoundingClientRect().top + window.scrollY - topBarH;
    const y = window.scrollY;
    tabScroll.current[prev] = y;
    // Header still (partly) showing: leave the page where it is, like TikTok.
    if (y < stickAt - 1) return;
    const target = Math.max(stickAt, tabScroll.current[activeTab] ?? stickAt);
    // Two frames: TabPager sizes itself to the incoming page in an effect, and
    // a scroll written before that lands is clamped to the OLD page's height.
    // "instant" because html has scroll-behavior: smooth, and a restore that
    // glides reads as the page moving by itself.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.scrollTo({ top: target, behavior: "instant" })),
    );
  }, [activeTab, topBarH]);

  // A visitor should never land on a storefront with nothing real behind it —
  // CollectionsGrid fills an empty catalog with fake demo products and
  // collections indistinguishable from real ones, which is fine for the
  // owner previewing their own in-progress store, not fine as what a
  // stranger sees. The owner is exempt (see catalogReadiness above); a
  // non-owner whose store fails this falls through to the existing
  // ProfileTabEmptyState below, same as any other empty tab. See
  // isStorefrontVisible for why `loading` counts as visible, not hidden.
  const storefrontVisible = isStorefrontVisible(store?.theme_id, isOwnProfile, catalogReadiness);

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
    />
  );

  const storeSheetOpen = activeTab === "store" && !!store && storefrontVisible;
  const closeStoreSheet = () => setActiveTab(previousTabRef.current);

  // The last sheet on this page that the back gesture could not see. It has a
  // scrim, drag-to-dismiss, a scroll lock and a depth cue on the page behind
  // it -- it is an overlay by every other measure -- so swiping back while it
  // was open left the profile entirely instead of closing it.
  useOverlayHistory(storeSheetOpen, closeStoreSheet);

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
        // hamburger panel, ShareProfileOverlay, and the Store sheet itself
        // from the real viewport if this scale lived on the page root.
        animate={{ scale: storeSheetOpen ? 0.97 : 1 }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Top bar — pinned. Picks up the name once the big one below has
            scrolled under it. */}
        <div
          ref={topBarRef}
          className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-black px-6 pt-4 pb-2"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="w-[22px] shrink-0">
              <BackButton />
            </div>
            <span
              aria-hidden={!nameScrolledAway}
              className={`truncate text-[15px] font-bold transition-[opacity,transform] duration-200 ${
                nameScrolledAway ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
              }`}
            >
              {profile?.display_name || profile?.personal_username || username}
            </span>
          </div>
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
            {ownershipKnown &&
              isOwnProfile &&
              store &&
              storeIsSetUp &&
              !store.personal_storefront_only && (
                <button
                  onClick={() => setStorePickerOpen(true)}
                  aria-label="Switch to store profile"
                  className="transition-transform duration-200 active:scale-90"
                >
                  <Store size={20} />
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
              <div
                ref={nameRef}
                className={`text-[15px] font-bold ${profileLoading ? "opacity-40" : ""}`}
              >
                {profile?.display_name || profile?.personal_username || username}
              </div>
              {isOwnProfile && (
                <button
                  onClick={() => navigate({ to: "/edit-profile" })}
                  aria-label="Edit profile"
                  className="text-[11px] font-bold text-white/50 hover:text-white transition-colors border border-white/30 hover:border-white/60 rounded-full px-2 py-0.5"
                >
                  Edit
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
                // Disabled until the follow query resolves: tapping while it
                // defaulted to "Follow" fired an insert on a row that might
                // already exist, and the optimistic flip bounced back.
                //
                // Signed OUT is the exception, and it has to be. With no viewer
                // the query is `enabled: false`, so isPending never stops being
                // true — which left a visitor staring at a permanently greyed
                // Follow button with no way to reach sign-in from it. There's no
                // status to wait on when nobody's signed in; the tap should just
                // take them to sign-in, which toggleFollow already does.
                disabled={followBusy || (!!user && followPending)}
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
            <div ref={stripAnchorRef} className="mt-6" />
            <div
              className="sticky z-20 border-b border-[#474747] bg-black"
              style={{ top: topBarH }}
            >
              {tabRow}
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

            {/* Content pager. Every tab is a real page in one horizontal
              track that follows the finger 1:1 — see TabPager for what this
              replaces and why. Pages stay mounted, so paging back is
              instant and nothing refetches. */}
            {/* min-height so a short tab (an empty state) can still be
                scrolled to the point where the strip is pinned — otherwise
                switching to it while pinned would yank the header back. */}
            <div className="pb-24" style={{ minHeight: `calc(100dvh - ${topBarH + 48}px)` }}>
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
                        emptyState={
                          <ProfileTabEmptyState tab="posts" isOwnProfile={isOwnProfile} />
                        }
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
      </motion.div>

      {/* Store sheet — Store is the one tab that rises up over the rest of
          the page instead of sitting flat under the tab row like every other
          tab. Swiping INTO it from an adjacent tab still works — that is the
          pager behind it — but once it is up, horizontal gestures stay
          inside: the storefront's tiles are photo carousels, and paging a tab
          out from under someone mid-swipe was the wrong trade. Leaving is a
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
            // Elastic stays high, and only downward. Pinned constraints with
            // a near-zero elastic clamp the visible travel to a few px, so
            // the sheet reads as unresponsive even while the drag is being
            // tracked; 0 at the top stops it lifting off the screen edge.
            // Constraints alone spring it back on release, so no
            // dragSnapToOrigin — that would fight the exit animation on the
            // release that actually dismisses.
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) closeStoreSheet();
            }}
            style={{ top: sheetTop }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
          >
            {/* No black strip here on purpose — the theme's own background
                (set on PublicStorefront's outer div, different per theme)
                runs all the way up into the rounded corners. The grabber
                floats over it instead of owning its own row: mix-blend-
                difference gives it contrast against ANY theme color without
                per-theme casing. This strip is also the sheet's drag handle —
                the one place a downward drag dismisses it — so unlike before
                it takes pointer events; the pill inside stays inert so the
                whole 36px strip is grabbable, not just the 4px pill. */}
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
            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              // Scrolling past the end of the storefront brings you out onto
              // Posts: pull up another ~80px while already at the bottom and
              // the sheet closes onto the Posts tab. Only counts a gesture
              // that STARTED at the bottom, so ordinary momentum reaching the
              // end never throws anyone out.
              onTouchStart={(e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
                pullOutRef.current = atBottom ? e.touches[0].clientY : null;
              }}
              onTouchMove={(e) => {
                const startY = pullOutRef.current;
                if (startY === null) return;
                if (startY - e.touches[0].clientY > 80) {
                  pullOutRef.current = null;
                  setActiveTab("posts");
                }
              }}
              onTouchEnd={() => {
                pullOutRef.current = null;
              }}
            >
              {store && <PublicStorefront storeId={store.id} />}
              <button
                type="button"
                onClick={() => setActiveTab("posts")}
                className="flex w-full flex-col items-center gap-1 bg-black py-5 text-[13px] font-medium text-white/60"
              >
                <ChevronUp size={18} />
                Keep scrolling for posts
              </button>
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

          <div className="text-[12px] uppercase tracking-wide text-white/40 mb-2">
            Creation &amp; business
          </div>
          <MenuRow label="Oakmonte Studio" onClick={() => navigate({ to: "/studio" })} />
          <MenuRow label="Oakmonte Store" onClick={() => navigate({ to: "/store" })} />

          <div className="text-[12px] uppercase tracking-wide text-white/40 mt-6 mb-2">
            Personal
          </div>
          <MenuRow label="Activity centre" onClick={() => navigate({ to: "/activity" })} />
          <MenuRow label="Offline videos" onClick={() => navigate({ to: "/offline-videos" })} />

          <div className="mt-6 pt-4 border-t border-white/10">
            <MenuRow label="Settings and privacy" onClick={() => navigate({ to: "/settings" })} />
          </div>
        </div>
      </div>

      {/* Store switcher — the header's store icon always opens this sheet,
          even for the common case of a single store, rather than jumping
          straight there. One consistent destination regardless of store
          count, instead of the tap meaning something different once a
          seller owns a second store. */}
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
            {stores
              .filter((s) => !s.personal_storefront_only)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  // Deliberately does NOT close the picker here. Closing it in
                  // the same click that navigates tears this button out of the
                  // DOM mid-click and the navigation never fires at all — the
                  // store drawer had the identical bug, and watching
                  // history.pushState from the page showed no push and no
                  // growth in history.length. Leaving the sheet up lets the
                  // route change unmount it a moment later, which also means
                  // useOverlayHistory sees the router has already moved and
                  // correctly leaves its history entry alone.
                  onClick={() =>
                    navigate({
                      to: "/store-profile/$storeUsername",
                      params: { storeUsername: s.store_username },
                    })
                  }
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

      {/* One action, on purpose. This used to offer a second button, "Upload or
          create content", which navigated nowhere and only closed the dialog --
          so it was a choice between doing something and doing nothing, dressed
          as a real fork. It names the next outstanding step rather than saying
          "set up my store", so the seller doesn't have to work out where they
          got to either.

          Still a Radix Dialog rather than one of the hand-rolled sheets: this
          opens by itself, without being asked for, so focus trapping and
          escape-to-close are not optional. The classes below only move it to
          the bottom of the screen in the house sheet shape. */}
      <Dialog open={sellerPromptOpen} onOpenChange={setSellerPromptOpen}>
        <DialogContent className="left-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-t-[28px] rounded-b-none border-0 bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] text-gray-900 shadow-[0_-20px_60px_rgba(0,0,0,0.18)] duration-300 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:left-[50%] sm:max-w-sm sm:translate-x-[-50%] sm:rounded-t-[28px] sm:rounded-b-none">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[20px] tracking-[-0.02em]">
              Your store isn&rsquo;t live yet
            </DialogTitle>
            <DialogDescription className="pt-1.5 text-sm leading-5 text-gray-500">
              {storeSetupStatus.nextStepLabel
                ? `Next up: ${storeSetupStatus.nextStepLabel.toLowerCase()}. It takes a minute.`
                : "A few steps left before people can buy from you."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setSellerPromptOpen(false);
                navigate({ to: "/store" });
              }}
              className="oak-motion-control w-full rounded-full bg-black py-4 text-[15px] font-semibold text-white active:scale-[0.98]"
            >
              {storeSetupStatus.nextStepLabel ?? "Finish setting up"}
            </button>
            <button
              type="button"
              onClick={() => setSellerPromptOpen(false)}
              className="oak-motion-control w-full rounded-full py-3 text-[15px] font-medium text-gray-500"
            >
              Later
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
