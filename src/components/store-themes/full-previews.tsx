import {
  BadgeCheck,
  Camera,
  Check,
  CirclePlay,
  Crown,
  Flame,
  Gem,
  Heart,
  Hexagon,
  ShieldCheck,
  Sparkles,
  Stars,
  Users,
  X,
  Zap,
  Cpu,
} from "lucide-react";
import type { Theme, ThemeId } from "./types";
import {
  CollectionsGrid,
  FeatureStrip,
  FooterTeaser,
  PhoneHeader,
  PromoBanner,
  StatsRow,
} from "./full-preview-blocks";

// One bespoke "full preview" per theme: shared blocks (header, stats,
// features, collections, promo, footer) handle the repeated storefront
// structure, while each theme still owns its hero section and background
// decoration so they read as genuinely different templates, not reskins.

function MotionGridFull() {
  return (
    <div className="relative bg-[#09070d] pb-2 text-white">
      <div className="absolute inset-0 h-[300px] opacity-40 [background-image:linear-gradient(rgba(157,77,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(157,77,255,0.25)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-[#722ee8]/35 blur-3xl" />
      <div className="absolute right-0 top-40 h-36 w-36 rounded-full bg-[#b673ff]/20 blur-3xl" />
      <div className="relative">
        <PhoneHeader
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.7)"
          ringGradient="linear-gradient(135deg,#9c4dff,#3a1a63)"
          avatarBg="#1c1428"
        />

        <div className="px-4 pt-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#c9a3ff]">
            Welcome to
          </p>
          <h2 className="mt-1 font-display text-[38px] uppercase leading-[0.85] tracking-[-0.03em]">
            District 17
          </h2>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/60">
            Street culture. No filter.
          </p>
        </div>

        <StatsRow
          clusterColors={["#b673ff", "#722ee8", "#3a1a63"]}
          followersText="2.7K+ followers love this store"
          badgeLabel="Top Rated Store"
          rating="4.9"
          reviews={120}
          accent="#c9a3ff"
          chipBg="rgba(156,77,255,0.16)"
          cardBg="#09070d"
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.55)"
        />

        <FeatureStrip
          cardBg="rgba(156,77,255,0.1)"
          textColor="#fff"
          accent="#c9a3ff"
          features={[
            { icon: <Zap size={14} />, label: "New drops weekly" },
            { icon: <Flame size={14} />, label: "Limited runs" },
            { icon: <ShieldCheck size={14} />, label: "Verified authentic" },
            { icon: <Users size={14} />, label: "Community fits" },
          ]}
        />

        <CollectionsGrid
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.5)"
          tileBg="rgba(255,255,255,0.04)"
          accent="#9c4dff"
          items={[
            { icon: <Zap size={18} />, label: "New Arrivals", count: 12 },
            { icon: <ShieldCheck size={18} />, label: "Graphic Tees", count: 32 },
            { icon: <Sparkles size={18} />, label: "Accessories", count: 18 },
            { icon: <Flame size={18} />, label: "Outerwear", count: 22 },
          ]}
        />

        <PromoBanner
          eyebrow="Limited drop live"
          title="Only available for a few more hours"
          countdown="02:18:47"
          accent="#c9a3ff"
          cardBg="rgba(156,77,255,0.08)"
          textColor="#fff"
        />

        <FooterTeaser
          label="Community fits"
          sub="142 people wearing it today"
          clusterColors={["#b673ff", "#ec4b9a", "#3a1a63"]}
          cardBg="rgba(255,255,255,0.04)"
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.5)"
          accent="#c9a3ff"
        />
      </div>
    </div>
  );
}

function ImmersiveBannerFull() {
  return (
    <div className="relative bg-[#f6f2e9] pb-2 text-[#292219]">
      <div className="absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.9),transparent_28%),linear-gradient(125deg,#c2aa8c_0%,#f1e8dc_48%,#b3a284_100%)]" />
      <div className="relative">
        <PhoneHeader
          textColor="#292219"
          mutedColor="rgba(41,34,25,0.6)"
          ringGradient="linear-gradient(135deg,#a67c52,#d8c8b4)"
          avatarBg="#f7f2e9"
        />

        <div className="px-4 pt-4 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#695947]">
            Essentials for a calm life
          </p>
          <h2 className="mt-1 font-serif text-[46px] leading-none tracking-[-0.04em]">terra</h2>
          <div className="mx-auto mt-2.5 h-px w-16 bg-[#a48a68]" />
          <p className="mx-auto mt-2.5 max-w-[200px] text-[11px] leading-4 text-[#655747]">
            Made to last, made for every day.
          </p>
        </div>

        <StatsRow
          clusterColors={["#c2aa8c", "#8b735b", "#e5d9c4"]}
          followersText="1.3K+ shop here"
          badgeLabel="Considered Store"
          rating="4.8"
          reviews={64}
          accent="#8b735b"
          chipBg="rgba(166,124,82,0.14)"
          cardBg="#f6f2e9"
          textColor="#292219"
          mutedColor="rgba(41,34,25,0.55)"
        />

        <FeatureStrip
          cardBg="rgba(166,124,82,0.1)"
          textColor="#292219"
          accent="#8b735b"
          features={[
            { icon: <Sparkles size={14} />, label: "Thoughtful" },
            { icon: <Stars size={14} />, label: "Considered" },
            { icon: <Heart size={14} />, label: "Made well" },
            { icon: <Check size={14} />, label: "Lasting" },
          ]}
        />

        <CollectionsGrid
          textColor="#292219"
          mutedColor="rgba(41,34,25,0.5)"
          tileBg="rgba(166,124,82,0.08)"
          accent="#a67c52"
          items={[
            { icon: <Sparkles size={18} />, label: "Home", count: 16 },
            { icon: <Heart size={18} />, label: "Clothing", count: 24 },
            { icon: <Stars size={18} />, label: "Bags", count: 12 },
            { icon: <Check size={18} />, label: "Lifestyle", count: 20 },
          ]}
        />

        <PromoBanner
          eyebrow="New collection"
          title="Soft layers — for every season, every day"
          cta="Explore"
          accent="#8b735b"
          cardBg="rgba(166,124,82,0.08)"
          textColor="#292219"
        />

        <FooterTeaser
          label="Updates from terra"
          sub="A short note on this season's fabric"
          clusterColors={["#c2aa8c", "#8b735b", "#e5d9c4"]}
          cardBg="rgba(166,124,82,0.08)"
          textColor="#292219"
          mutedColor="rgba(41,34,25,0.5)"
          accent="#8b735b"
        />
      </div>
    </div>
  );
}

function InteractiveStoryFull() {
  return (
    <div className="relative bg-[#171018] pb-2 text-white">
      <div className="absolute inset-0 h-[340px] bg-[radial-gradient(circle_at_85%_12%,rgba(255,105,180,0.22),transparent_30%),radial-gradient(circle_at_8%_43%,rgba(136,88,255,0.28),transparent_36%)]" />
      <div className="relative">
        <PhoneHeader
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.65)"
          ringGradient="linear-gradient(135deg,#ff9bc8,#ec4b9a,#7144e8)"
          avatarBg="#241520"
        />

        <div className="px-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9bc8] via-[#ec4b9a] to-[#7144e8] p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#241520] text-[13px] font-bold">
                S
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.03em]">Sunday Social</p>
              <p className="text-[9px] text-white/55">Your everyday moodboard</p>
            </div>
            <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-[8px] font-semibold">
              Follow
            </span>
          </div>
          <div className="mt-4 flex gap-2 overflow-hidden">
            {[
              { label: "New in", tint: "from-[#f060a9] to-[#743ed7]" },
              { label: "Studio", tint: "from-[#ffb47a] to-[#e75383]" },
              { label: "On film", tint: "from-[#6c62ef] to-[#2b9ddf]" },
              { label: "Fits", tint: "from-[#bb64eb] to-[#ec4b9a]" },
            ].map((s) => (
              <div key={s.label} className="shrink-0 text-center">
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${s.tint} p-[2px]`}>
                  <div className="h-full w-full rounded-full bg-[#1d1420]" />
                </div>
                <span className="mt-1 block text-[8px] text-white/75">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <StatsRow
          clusterColors={["#ff9bc8", "#ec4b9a", "#7144e8"]}
          followersText="3.6K+ following the feed"
          badgeLabel="Rising Star"
          rating="4.7"
          reviews={58}
          accent="#ff9bc8"
          chipBg="rgba(236,75,154,0.16)"
          cardBg="#171018"
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.55)"
        />

        <FeatureStrip
          cardBg="rgba(236,75,154,0.1)"
          textColor="#fff"
          accent="#ff9bc8"
          features={[
            { icon: <CirclePlay size={14} />, label: "Daily drops" },
            { icon: <Camera size={14} />, label: "Behind the scenes" },
            { icon: <Heart size={14} />, label: "Fan favorites" },
            { icon: <Sparkles size={14} />, label: "Mood updates" },
          ]}
        />

        <CollectionsGrid
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.5)"
          tileBg="rgba(255,255,255,0.04)"
          accent="#ec4b9a"
          items={[
            { icon: <Sparkles size={18} />, label: "New In", count: 20 },
            { icon: <Camera size={18} />, label: "Studio", count: 14 },
            { icon: <Heart size={18} />, label: "Fits", count: 18 },
            { icon: <CirclePlay size={18} />, label: "Archive", count: 10 },
          ]}
        />

        <PromoBanner
          eyebrow="New drop"
          title="Colour after dark."
          cta="Shop the edit"
          accent="#ff9bc8"
          cardBg="rgba(236,75,154,0.08)"
          textColor="#fff"
        />

        <FooterTeaser
          label="Live now"
          sub="23 people scrolling the feed"
          clusterColors={["#ff9bc8", "#7144e8", "#2b9ddf"]}
          cardBg="rgba(255,255,255,0.04)"
          textColor="#fff"
          mutedColor="rgba(255,255,255,0.5)"
          accent="#ff9bc8"
        />
      </div>
    </div>
  );
}

function GalleryEditFull() {
  return (
    <div className="relative bg-[#0c0b0a] pb-2 text-[#f3ede2]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_75%_0%,rgba(201,162,39,0.16),transparent_45%)]" />
      <div className="relative">
        <PhoneHeader
          textColor="#f3ede2"
          mutedColor="rgba(243,237,226,0.55)"
          ringGradient="linear-gradient(135deg,#c9a227,#6b5a1f)"
          avatarBg="#151310"
        />

        <div className="px-4 pt-6 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#c9a227]">
            Autumn selects, in full
          </p>
          <h2 className="mt-2 font-serif text-[36px] italic leading-none tracking-[-0.02em]">
            Atelier Noir
          </h2>
          <div className="mx-auto mt-3 h-px w-12 bg-[#c9a227]/60" />
          <p className="mx-auto mt-3 max-w-[190px] text-[10.5px] leading-4 text-[#c9bea6]">
            Fewer pieces. Finer edit.
          </p>
        </div>

        <StatsRow
          clusterColors={["#c9a227", "#6b5a1f", "#e9d98f"]}
          followersText="890 in the atelier"
          badgeLabel="Est. 2024"
          rating="4.9"
          reviews={41}
          accent="#c9a227"
          chipBg="rgba(201,162,39,0.14)"
          cardBg="#0c0b0a"
          textColor="#f3ede2"
          mutedColor="rgba(243,237,226,0.55)"
        />

        <FeatureStrip
          cardBg="rgba(201,162,39,0.08)"
          textColor="#f3ede2"
          accent="#c9a227"
          features={[
            { icon: <Gem size={14} />, label: "Hand selected" },
            { icon: <Crown size={14} />, label: "Small batch" },
            { icon: <BadgeCheck size={14} />, label: "Provenance verified" },
            { icon: <Sparkles size={14} />, label: "Considered finish" },
          ]}
        />

        <CollectionsGrid
          textColor="#f3ede2"
          mutedColor="rgba(243,237,226,0.5)"
          tileBg="rgba(201,162,39,0.06)"
          accent="#c9a227"
          items={[
            { icon: <Crown size={18} />, label: "Outerwear", count: 9 },
            { icon: <Gem size={18} />, label: "Tailoring", count: 14 },
            { icon: <BadgeCheck size={18} />, label: "Accessories", count: 11 },
            { icon: <Sparkles size={18} />, label: "Objects", count: 7 },
          ]}
        />

        <PromoBanner
          eyebrow="New arrivals, quietly"
          title="This week's edit is now viewable"
          cta="View the edit"
          accent="#c9a227"
          accentTextColor="#0c0b0a"
          cardBg="rgba(201,162,39,0.08)"
          textColor="#f3ede2"
        />

        <FooterTeaser
          label="From the atelier"
          sub="A short note on this season's fabric"
          clusterColors={["#c9a227", "#6b5a1f", "#e9d98f"]}
          cardBg="rgba(201,162,39,0.06)"
          textColor="#f3ede2"
          mutedColor="rgba(243,237,226,0.5)"
          accent="#c9a227"
        />
      </div>
    </div>
  );
}

function NeonTerminalFull() {
  return (
    <div className="relative bg-[#05070a] pb-2 text-[#eafcff]">
      <div className="absolute inset-0 h-[320px] opacity-30 [background-image:linear-gradient(rgba(45,212,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,255,0.3)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute right-6 top-6 h-8 w-8 border-r-2 border-t-2 border-[#2dd4ff]/50" />
      <div className="absolute left-6 top-6 h-8 w-8 border-l-2 border-t-2 border-[#2dd4ff]/50" />
      <div className="relative">
        <PhoneHeader
          textColor="#eafcff"
          mutedColor="rgba(234,252,255,0.6)"
          ringGradient="linear-gradient(135deg,#2dd4ff,#0a5a6e)"
          avatarBg="#081014"
        />

        <div className="px-4 pt-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#2dd4ff]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2dd4ff]" />
            System online
          </p>
          <h2
            className="mt-2 font-display text-[40px] uppercase leading-[0.85] tracking-[-0.02em]"
            style={{ textShadow: "0 0 18px rgba(45,212,255,0.5)" }}
          >
            Circuit
          </h2>
          <p className="mx-auto mt-2.5 max-w-[190px] text-[10.5px] leading-4 text-[#8fd9e8]">
            Style, compiled.
          </p>
        </div>

        <StatsRow
          clusterColors={["#2dd4ff", "#0a5a6e", "#9be9f7"]}
          followersText="4.1K+ nodes connected"
          badgeLabel="Elite Store"
          rating="4.8"
          reviews={98}
          accent="#2dd4ff"
          chipBg="rgba(45,212,255,0.14)"
          cardBg="#05070a"
          textColor="#eafcff"
          mutedColor="rgba(234,252,255,0.55)"
        />

        <FeatureStrip
          cardBg="rgba(45,212,255,0.08)"
          textColor="#eafcff"
          accent="#2dd4ff"
          features={[
            { icon: <Cpu size={14} />, label: "Innovation first" },
            { icon: <Hexagon size={14} />, label: "Premium materials" },
            { icon: <ShieldCheck size={14} />, label: "Secure checkout" },
            { icon: <Zap size={14} />, label: "Exclusive drops" },
          ]}
        />

        <CollectionsGrid
          textColor="#eafcff"
          mutedColor="rgba(234,252,255,0.5)"
          tileBg="rgba(45,212,255,0.06)"
          accent="#2dd4ff"
          items={[
            { icon: <Cpu size={18} />, label: "Techwear", count: 20 },
            { icon: <Zap size={18} />, label: "Utility", count: 18 },
            { icon: <Hexagon size={18} />, label: "Accessories", count: 22 },
            { icon: <ShieldCheck size={18} />, label: "Gadgets", count: 14 },
          ]}
        />

        <PromoBanner
          eyebrow="System update"
          title="New drop online — sync inventory to view"
          cta="Explore now"
          accent="#2dd4ff"
          accentTextColor="#05070a"
          cardBg="rgba(45,212,255,0.08)"
          textColor="#eafcff"
        />

        <FooterTeaser
          label="Live activity"
          sub="23 people viewing right now"
          clusterColors={["#2dd4ff", "#0a5a6e", "#9be9f7"]}
          cardBg="rgba(45,212,255,0.06)"
          textColor="#eafcff"
          mutedColor="rgba(234,252,255,0.5)"
          accent="#2dd4ff"
        />
      </div>
    </div>
  );
}

export function FullPreview({ themeId }: { themeId: ThemeId }) {
  switch (themeId) {
    case "motion":
      return <MotionGridFull />;
    case "banner":
      return <ImmersiveBannerFull />;
    case "story":
      return <InteractiveStoryFull />;
    case "atelier":
      return <GalleryEditFull />;
    case "circuit":
      return <NeonTerminalFull />;
  }
}

export function ThemePreviewSheet({
  theme,
  isSelected,
  onClose,
  onSelect,
}: {
  theme: Theme;
  isSelected: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 animate-in fade-in duration-250 ease-out">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-neutral-950/95 px-4 py-3.5 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-white">{theme.name}</p>
          <p className="text-[9px] uppercase tracking-[0.14em] text-white/40">{theme.eyebrow}</p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          className="rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
          style={{
            background: isSelected ? "rgba(255,255,255,0.12)" : theme.accent,
            color: isSelected ? "#fff" : "#0a0a0a",
          }}
        >
          {isSelected ? "Selected" : "Use this theme"}
        </button>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-8 sm:py-12">
        <div className="w-full max-w-[380px] shrink-0 overflow-hidden rounded-[2.5rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <div className="max-h-[78vh] overflow-y-auto">
            <FullPreview themeId={theme.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
