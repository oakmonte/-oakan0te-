import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, Share2, Search, Menu, Star,
  Grid3x3, Store, Shirt, Repeat2, Heart, Film, FolderClosed,
  X, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/profile/$username")({
  head: () => ({ meta: [{ title: "Profile — Oakmonte" }] }),
  component: ProfilePage,
});

type TabKey = "posts" | "store" | "wardrobe" | "reposts" | "wishlist" | "likedVideos" | "drafts";

const TABS: { key: TabKey; label: string; icon: typeof Grid3x3 }[] = [
  { key: "posts", label: "Posts", icon: Grid3x3 },
  { key: "store", label: "Store", icon: Store },
  { key: "wardrobe", label: "Wardrobe", icon: Shirt },
  { key: "reposts", label: "Reposts", icon: Repeat2 },
  { key: "wishlist", label: "Wishlist", icon: Heart },
  { key: "likedVideos", label: "Liked videos", icon: Film },
  { key: "drafts", label: "Drafts", icon: FolderClosed },
];

// Placeholder — swap for real content query per active tab
const MOCK_ITEMS = [
  { id: "1", src: "https://placehold.co/400x520", h: 260 },
  { id: "2", src: "https://placehold.co/400x360", h: 180 },
  { id: "3", src: "https://placehold.co/400x560", h: 280 },
  { id: "4", src: "https://placehold.co/400x420", h: 210 },
  { id: "5", src: "https://placehold.co/400x480", h: 240 },
  { id: "6", src: "https://placehold.co/400x340", h: 170 },
  { id: "7", src: "https://placehold.co/400x500", h: 250 },
  { id: "8", src: "https://placehold.co/400x380", h: 190 },
];

function ProfilePage() {
  const navigate = useNavigate();
  const { username } = useParams({ from: "/profile/$username" });
  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // TODO: replace with real "is this the signed-in user's own profile" check
  const isOwnProfile = true;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <button onClick={() => navigate({ to: ".." })} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-5">
          <button aria-label="Share">
            <Share2 size={20} />
          </button>
          <button onClick={() => setSearchOpen((v) => !v)} aria-label="Search">
            <Search size={22} />
          </button>
          {isOwnProfile && (
            <button onClick={() => setMenuOpen(true)} aria-label="Menu">
              <Menu size={22} />
            </button>
          )}
        </div>
      </div>

      {/* Profile info */}
      <div className="flex flex-col items-center gap-4 px-6 mt-2">
        <img
          src="https://placehold.co/135x139"
          alt={username}
          className="w-[110px] h-[110px] rounded-full border-[3px] border-white object-cover"
        />
        <div className="text-center">
          <div className="text-[15px] font-bold">Ejiro's Balls</div>
          <div className="text-[11px] font-bold text-[#B0ADAD] mt-0.5">@{username}</div>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <div className="flex items-center gap-[2px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className="fill-[#FF7300] text-[#FF7300]" />
              ))}
            </div>
            <span className="text-[11px] font-medium">(190)</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <Stat value="54" label="Following" />
          <Stat value="1,002" label="Followers" />
          <Stat value="10,300" label="Sold Items" />
        </div>

        <p className="text-[14px] font-bold text-center">The love of God is free, drip isn't</p>
      </div>

      {/* Tab row */}
      <div className="mt-6 border-b border-[#474747]">
        <div className="flex items-center gap-7 px-6 py-2.5 overflow-x-auto no-scrollbar">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-label={label}
              className="shrink-0 transition-opacity"
            >
              <Icon
                size={21}
                className={activeTab === key ? "text-[#FF7300]" : "text-white/60"}
                fill={activeTab === key ? "#FF7300" : "none"}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Inline search — only rendered when toggled open */}
      {searchOpen && (
        <div className="px-6 pt-3">
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
      )}

      {/* Content grid — responsive masonry, replaces the 26 fixed-position images */}
      <div className="px-4 pt-4 pb-24 columns-2 gap-2 [column-fill:_balance]">
        {MOCK_ITEMS.map((item) => (
          <img
            key={item.id}
            src={item.src}
            alt=""
            style={{ height: item.h }}
            className="w-full mb-2 rounded-[13px] object-cover break-inside-avoid"
          />
        ))}
      </div>

      {/* Hamburger side panel */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[280px] bg-black border-l border-white/10 px-5 py-6">
            <button onClick={() => setMenuOpen(false)} className="mb-6" aria-label="Close menu">
              <ArrowLeft size={20} />
            </button>

            <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Creation &amp; business</div>
            <MenuRow label="Oakmonte Studio" onClick={() => navigate({ to: "/studio" })} />
            <MenuRow label="Oakmonte Store" onClick={() => navigate({ to: "/store" })} />

            <div className="text-[11px] uppercase tracking-wide text-white/40 mt-6 mb-2">Personal</div>
            <MenuRow label="Activity centre" onClick={() => navigate({ to: "/activity" })} />
            <MenuRow label="Offline videos" onClick={() => navigate({ to: "/offline-videos" })} />

            <div className="mt-6 pt-4 border-t border-white/10">
              <MenuRow label="Settings and privacy" onClick={() => navigate({ to: "/settings" })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[15px] font-bold">{value}</div>
      <div className="text-[11px] font-bold text-[#B0ADAD]">{label}</div>
    </div>
  );
}

function MenuRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 text-[14px] hover:text-white/80 transition-colors"
    >
      <span>{label}</span>
      <ChevronRight size={16} className="text-white/40" />
    </button>
  );
}