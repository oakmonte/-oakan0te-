import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { BottomNav } from "@/components/BottomNav";
import { ProfileTabEmptyState } from "@/components/ProfileTabEmptyState";
import { PostsGrid } from "@/components/profile/PostsGrid";
import { PublicStorefront } from "@/components/store-themes/full-previews";
import { Stat, MenuRow } from "@/components/profile/profile-chrome";
import { TABS, type TabKey } from "@/components/profile/profile-tabs";

export const Route = createFileRoute("/profile/$username")({
  head: () => ({ meta: [{ title: "Profile — Oakmonte" }] }),
  component: ProfilePage,
});

const MOCK_ITEMS = [
  { id: "1", src: "https://placehold.co/400x400" },
  { id: "2", src: "https://placehold.co/400x400" },
  { id: "3", src: "https://placehold.co/400x400" },
  { id: "4", src: "https://placehold.co/400x400" },
  { id: "5", src: "https://placehold.co/400x400" },
  { id: "6", src: "https://placehold.co/400x400" },
  { id: "7", src: "https://placehold.co/400x400" },
  { id: "8", src: "https://placehold.co/400x400" },
  { id: "9", src: "https://placehold.co/400x400" },
];

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

function ProfilePage() {
  const navigate = useNavigate();
  const { username } = useParams({ from: "/profile/$username" });
  const { user } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [stores, setStores] = useState<
    { id: string; store_username: string; brand_name: string }[]
  >([]);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  // Oldest-first, same tie-break as useOwnStores — "the" store for anything
  // on this page that isn't multi-store aware yet (the Store tab preview).
  const store = stores[0] ?? null;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<TabKey, HTMLButtonElement | null>>(
    {} as Record<TabKey, HTMLButtonElement | null>,
  );
  // Where the Store sheet's top edge should sit — the bottom of the avatar
  // circle itself, so the sheet rises to cover the name/rating/stats/bio too
  // instead of just sitting flush under them. Tracked continuously (not just
  // on the tap that opens it) in case layout shifts, e.g. once the avatar
  // image finishes loading.
  const avatarRef = useRef<HTMLImageElement>(null);
  const [sheetTop, setSheetTop] = useState(0);
  const previousTabRef = useRef<TabKey>("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  // Whether the bell shows as "on" — the follows table has no notify column
  // yet, so this is visual/session-only, not persisted.
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [messageHint, setMessageHint] = useState<string | null>(null);

  const isOwnProfile = !!user && !!profile && user.id === profile.id;

  const tabIndex = TABS.findIndex((t) => t.key === activeTab);

  const goToTab = (nextIndex: number) => {
    if (nextIndex >= 0 && nextIndex < TABS.length) {
      setActiveTab(TABS[nextIndex].key);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    // public_profiles, not profiles: profiles' SELECT policy is auth.uid() =
    // id, so it can only ever return the signed-in user's own row. The view
    // exposes just the columns this page renders publicly.
    supabase
      .from("public_profiles")
      .select("id, personal_username, display_name, avatar_url, bio")
      .eq("personal_username", username)
      .single()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        // id/personal_username are NOT NULL on the base table — the view's
        // generated type just can't express that for a view's columns.
        if (error || !data || !data.id || !data.personal_username) {
          setProfileLoading(false);
          return;
        }
        const { id, personal_username } = data;

        // The counts live on the profile_stats view, not on profiles — asking
        // profiles for them makes PostgREST reject the whole select.
        const { data: stats } = await supabase
          .from("profile_stats")
          .select("following_count, followers_count, rating, rating_count")
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;

        setProfile({
          ...data,
          id,
          personal_username,
          following_count: stats?.following_count ?? 0,
          followers_count: stats?.followers_count ?? 0,
          rating: stats?.rating ?? 0,
          rating_count: stats?.rating_count ?? 0,
        });
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  // Every store this person owns — drives the Store tab's content (via
  // `store`, the first one) and the switch-profile icon, which needs the
  // full list to know whether to jump straight to the one store or offer a
  // picker. stores has RLS off project-wide today (see supabase-data-access
  // skill), so this read works for any viewer. An account can own more than
  // one store (the dashboard's store switcher) — .maybeSingle() used to
  // error out on the second+ row and leave this whole page thinking the
  // seller had no store at all.
  useEffect(() => {
    if (!profile) {
      setStores([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("stores")
      .select("id, store_username, brand_name")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("ProfilePage: failed to check for store", error);
        setStores(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // Whether the signed-in viewer already follows this profile — irrelevant
  // (and skipped) when looking at your own profile.
  useEffect(() => {
    if (!user || !profile || user.id === profile.id) {
      setIsFollowing(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("ProfilePage: failed to check follow status", error);
        setIsFollowing(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  async function toggleFollow() {
    if (!profile || followBusy) return;
    if (!user) {
      navigate({ to: "/sign-in" });
      return;
    }
    const wasFollowing = isFollowing;
    setFollowBusy(true);
    setIsFollowing(!wasFollowing);
    setProfile((p) =>
      p ? { ...p, followers_count: Math.max(0, p.followers_count + (wasFollowing ? -1 : 1)) } : p,
    );
    const { error } = wasFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
      : await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    if (error) {
      console.error("ProfilePage: failed to toggle follow", error);
      setIsFollowing(wasFollowing);
      setProfile((p) =>
        p ? { ...p, followers_count: Math.max(0, p.followers_count + (wasFollowing ? 1 : -1)) } : p,
      );
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
    const btn = tabButtonRefs.current[activeTab];
    if (btn) {
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeTab]);

  useEffect(() => {
    const el = avatarRef.current;
    if (!el) return;
    const update = () => setSheetTop(el.getBoundingClientRect().bottom);
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
  }, [profile]);

  // Body scroll lock while the Store sheet is up, same as any bottom sheet —
  // also keeps sheetTop from drifting out from under the sheet mid-view.
  useEffect(() => {
    if (activeTab === "store" && store) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [activeTab, store]);

  const tabRow = (
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
            onClick={() => {
              if (key === "store") previousTabRef.current = activeTab;
              setActiveTab(key);
            }}
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
  );

  const storeSheetOpen = activeTab === "store" && !!store;

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
          {!isOwnProfile && isFollowing && (
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
          {isOwnProfile && store && (
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
          {isOwnProfile && (
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
        <img
          ref={avatarRef}
          src={profile?.avatar_url || "https://placehold.co/135x139"}
          alt={username}
          className="w-[110px] h-[110px] rounded-full border-[3px] border-white object-cover"
        />
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <div className="text-[15px] font-bold">
              {profileLoading
                ? "…"
                : profile?.display_name || profile?.personal_username || username}
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

        {!isOwnProfile && profile && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleFollow}
              disabled={followBusy}
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
                className="px-1 pt-4"
              >
                {profile && activeTab === "posts" ? (
                  <PostsGrid
                    userId={profile.id}
                    status="published"
                    emptyState={<ProfileTabEmptyState tab="posts" />}
                  />
                ) : profile && activeTab === "drafts" && isOwnProfile ? (
                  <PostsGrid
                    userId={profile.id}
                    status="draft"
                    emptyState={<ProfileTabEmptyState tab="drafts" />}
                  />
                ) : (
                  <ProfileTabEmptyState tab={activeTab} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Store sheet — Store is the one tab that rises up over the rest of
          the page instead of sitting flat under the tab row like every other
          tab. Tapping anywhere above it (the avatar/name/stats area, still
          visible above the sheet) closes it back to whatever tab was active
          before Store was opened. No explicit close button by design. */}
      <AnimatePresence>
        {storeSheetOpen && (
          <motion.div
            key="store-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
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
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[28px] bg-black shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-9 rounded-full bg-white/25" />
            </div>
            <div className="border-b border-[#474747]">{tabRow}</div>
            <div className="flex-1 overflow-y-auto pb-24">
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

      {/* Bottom nav — shown only when viewing your own profile */}
      {isOwnProfile && (
        <BottomNav active="profile" ownUsername={profile?.personal_username || username} />
      )}
    </div>
  );
}
