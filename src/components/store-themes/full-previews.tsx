import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  CirclePlay,
  Crown,
  Flame,
  Gem,
  Heart,
  Hexagon,
  LayoutGrid,
  Pencil,
  Check as CheckIcon,
  ShieldCheck,
  Sparkles,
  Stars,
  X,
  Zap,
  Cpu,
} from "lucide-react";
import placeholderPhoto1 from "@/assets/Store theme placeholder images/photo_2026-08-21_05-49-54.jpg";
import placeholderPhoto2 from "@/assets/Store theme placeholder images/photo_2026-08-21_05-50-21.jpg";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Theme, ThemeId } from "./types";
import {
  CollectionsGrid,
  FooterTeaser,
  HeroSlideshow,
  PhoneHeader,
  PromoBanner,
  StatsRow,
} from "./full-preview-blocks";
import { ThemeText } from "./EditableText";
import {
  createInitialEditState,
  MAX_SLIDESHOW_IMAGES,
  type RemovableBlockId,
  type ThemeEditingProps,
  type ThemeEditState,
} from "./edit-types";
import { LAYOUT_PRESETS, type ArrangeableBlockId } from "./layout-presets";

const HERO_SLIDESHOW_IMAGES = [placeholderPhoto1, placeholderPhoto2];

// One bespoke "full preview" per theme: shared blocks (header, stats,
// features, collections, promo, footer) handle the repeated storefront
// structure, while each theme still owns its hero section and background
// decoration so they read as genuinely different templates, not reskins.
//
// Every theme function accepts one optional `editing` prop (see
// edit-types.ts). When present and `isEditing`, the theme builds a lookup of
// its four reorderable blocks (stats/collections/promo/footer) and renders
// them in whatever order the active layout preset specifies, instead of a
// fixed sequence — the theme still owns every block's colors/copy, only the
// order becomes data-driven.

function orderedBlocks(
  editing: ThemeEditingProps | undefined,
  blocks: Partial<Record<ArrangeableBlockId, ReactNode>>,
) {
  const layoutId = editing?.layoutId ?? "hero-led";
  const order = LAYOUT_PRESETS.find((p) => p.id === layoutId)?.order ?? LAYOUT_PRESETS[0].order;
  return order.map((id) => <Fragment key={id}>{blocks[id]}</Fragment>);
}

function MotionGridFull({ editing }: { editing?: ThemeEditingProps }) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#b673ff", "#722ee8", "#3a1a63"]}
        followersText={text.statsFollowersText ?? "2.7K+ followers love this store"}
        badgeLabel={text.statsBadgeLabel ?? "Top Rated Store"}
        rating="4.9"
        reviews={120}
        accent="#c9a3ff"
        chipBg="rgba(156,77,255,0.16)"
        cardBg="#09070d"
        textColor="#fff"
        mutedColor="rgba(255,255,255,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#fff"
        mutedColor="rgba(255,255,255,0.5)"
        tileBg="rgba(255,255,255,0.04)"
        accent="#9c4dff"
        editing={editing}
        fallbackItems={[
          { icon: <Zap size={18} />, label: "New Arrivals", count: 12 },
          { icon: <ShieldCheck size={18} />, label: "Graphic Tees", count: 32 },
          { icon: <Sparkles size={18} />, label: "Accessories", count: 18 },
          { icon: <Flame size={18} />, label: "Outerwear", count: 22 },
        ]}
        fallbackProducts={[
          { icon: <Zap size={18} />, name: "Oxy Tee", price: 18000 },
          { icon: <ShieldCheck size={18} />, name: "Run It Cap", price: 9500 },
          { icon: <Sparkles size={18} />, name: "State Bag", price: 32000 },
          { icon: <Flame size={18} />, name: "Blackout Hoodie", price: 45000 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "Limited drop live"}
        title={text.promoTitle ?? "Only available for a few more hours"}
        countdown="02:18:47"
        accent="#c9a3ff"
        cardBg="rgba(156,77,255,0.08)"
        textColor="#fff"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "Community fits"}
        sub={text.footerSub ?? "142 people wearing it today"}
        clusterColors={["#b673ff", "#ec4b9a", "#3a1a63"]}
        cardBg="rgba(255,255,255,0.04)"
        textColor="#fff"
        mutedColor="rgba(255,255,255,0.5)"
        accent="#c9a3ff"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#09070d] pb-2 text-white">
      <div className="absolute inset-0 h-[300px] opacity-40 [background-image:linear-gradient(rgba(157,77,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(157,77,255,0.25)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-[#722ee8]/35 blur-3xl" />
      <div className="absolute right-0 top-40 h-36 w-36 rounded-full bg-[#b673ff]/20 blur-3xl" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(255,255,255,0.7)"
          brandInitial="D"
          defaultLogoText="District 17"
          editing={editing}
        />
        <HeroSlideshow
          images={editing?.slideshowImages ?? HERO_SLIDESHOW_IMAGES}
          editing={editing}
        />

        <div className="px-4 pt-6">
          <ThemeText
            editing={editing}
            field="hero1"
            defaultValue="Welcome to"
            as="p"
            className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#c9a3ff]"
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="District 17"
            as="h2"
            className="mt-1 font-display text-[38px] uppercase leading-[0.85] tracking-[-0.03em]"
          />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="Street culture. No filter."
            as="p"
            className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/60"
          />
        </div>

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

function ImmersiveBannerFull({ editing }: { editing?: ThemeEditingProps }) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#c2aa8c", "#8b735b", "#e5d9c4"]}
        followersText={text.statsFollowersText ?? "1.3K+ shop here"}
        badgeLabel={text.statsBadgeLabel ?? "Considered Store"}
        rating="4.8"
        reviews={64}
        accent="#8b735b"
        chipBg="rgba(166,124,82,0.14)"
        cardBg="#f6f2e9"
        textColor="#292219"
        mutedColor="rgba(41,34,25,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#292219"
        mutedColor="rgba(41,34,25,0.5)"
        tileBg="rgba(166,124,82,0.08)"
        accent="#a67c52"
        editing={editing}
        fallbackItems={[
          { icon: <Sparkles size={18} />, label: "Home", count: 16 },
          { icon: <Heart size={18} />, label: "Clothing", count: 24 },
          { icon: <Stars size={18} />, label: "Bags", count: 12 },
          { icon: <Check size={18} />, label: "Lifestyle", count: 20 },
        ]}
        fallbackProducts={[
          { icon: <Sparkles size={18} />, name: "Linen Throw", price: 22000 },
          { icon: <Heart size={18} />, name: "Clay Vase", price: 15500 },
          { icon: <Stars size={18} />, name: "Wool Slippers", price: 12000 },
          { icon: <Check size={18} />, name: "Oat Candle", price: 8500 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "New collection"}
        title={text.promoTitle ?? "Soft layers — for every season, every day"}
        cta="Explore"
        accent="#8b735b"
        cardBg="rgba(166,124,82,0.08)"
        textColor="#292219"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "Updates from terra"}
        sub={text.footerSub ?? "A short note on this season's fabric"}
        clusterColors={["#c2aa8c", "#8b735b", "#e5d9c4"]}
        cardBg="rgba(166,124,82,0.08)"
        textColor="#292219"
        mutedColor="rgba(41,34,25,0.5)"
        accent="#8b735b"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#f6f2e9] pb-2 text-[#292219]">
      <div className="absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.9),transparent_28%),linear-gradient(125deg,#c2aa8c_0%,#f1e8dc_48%,#b3a284_100%)]" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(41,34,25,0.6)"
          brandInitial="t"
          defaultLogoText="terra"
          editing={editing}
        />
        <HeroSlideshow
          images={editing?.slideshowImages ?? HERO_SLIDESHOW_IMAGES}
          editing={editing}
        />

        <div className="px-4 pt-4 text-center">
          <ThemeText
            editing={editing}
            field="hero1"
            defaultValue="Essentials for a calm life"
            as="p"
            className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#695947]"
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="terra"
            as="h2"
            className="mt-1 font-serif text-[46px] leading-none tracking-[-0.04em]"
          />
          <div className="mx-auto mt-2.5 h-px w-16 bg-[#a48a68]" />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="Made to last, made for every day."
            as="p"
            className="mx-auto mt-2.5 max-w-[200px] text-[11px] leading-4 text-[#655747]"
          />
        </div>

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

function InteractiveStoryFull({ editing }: { editing?: ThemeEditingProps }) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#ff9bc8", "#ec4b9a", "#7144e8"]}
        followersText={text.statsFollowersText ?? "3.6K+ following the feed"}
        badgeLabel={text.statsBadgeLabel ?? "Rising Star"}
        rating="4.7"
        reviews={58}
        accent="#ff9bc8"
        chipBg="rgba(236,75,154,0.16)"
        cardBg="#171018"
        textColor="#fff"
        mutedColor="rgba(255,255,255,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#fff"
        mutedColor="rgba(255,255,255,0.5)"
        tileBg="rgba(255,255,255,0.04)"
        accent="#ec4b9a"
        editing={editing}
        fallbackItems={[
          { icon: <Sparkles size={18} />, label: "New In", count: 20 },
          { icon: <Camera size={18} />, label: "Studio", count: 14 },
          { icon: <Heart size={18} />, label: "Fits", count: 18 },
          { icon: <CirclePlay size={18} />, label: "Archive", count: 10 },
        ]}
        fallbackProducts={[
          { icon: <Sparkles size={18} />, name: "Layered Set", price: 27000 },
          { icon: <Camera size={18} />, name: "Sunday Bag", price: 19500 },
          { icon: <Heart size={18} />, name: "Film Tee", price: 14000 },
          { icon: <CirclePlay size={18} />, name: "Archive Cap", price: 9000 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "New drop"}
        title={text.promoTitle ?? "Colour after dark."}
        cta="Shop the edit"
        accent="#ff9bc8"
        cardBg="rgba(236,75,154,0.08)"
        textColor="#fff"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "Live now"}
        sub={text.footerSub ?? "23 people scrolling the feed"}
        clusterColors={["#ff9bc8", "#7144e8", "#2b9ddf"]}
        cardBg="rgba(255,255,255,0.04)"
        textColor="#fff"
        mutedColor="rgba(255,255,255,0.5)"
        accent="#ff9bc8"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#171018] pb-2 text-white">
      <div className="absolute inset-0 h-[340px] bg-[radial-gradient(circle_at_85%_12%,rgba(255,105,180,0.22),transparent_30%),radial-gradient(circle_at_8%_43%,rgba(136,88,255,0.28),transparent_36%)]" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(255,255,255,0.65)"
          brandInitial="S"
          defaultLogoText="Sunday Social"
          editing={editing}
        />
        <HeroSlideshow
          images={editing?.slideshowImages ?? HERO_SLIDESHOW_IMAGES}
          editing={editing}
        />

        <div className="px-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9bc8] via-[#ec4b9a] to-[#7144e8] p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#241520] text-[13px] font-bold">
                S
              </div>
            </div>
            <div>
              <ThemeText
                editing={editing}
                field="hero1"
                defaultValue="Sunday Social"
                as="p"
                className="text-sm font-semibold tracking-[-0.03em]"
              />
              <ThemeText
                editing={editing}
                field="hero2"
                defaultValue="Your everyday moodboard"
                as="p"
                className="text-[9px] text-white/55"
              />
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

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

function GalleryEditFull({ editing }: { editing?: ThemeEditingProps }) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#c9a227", "#6b5a1f", "#e9d98f"]}
        followersText={text.statsFollowersText ?? "890 in the atelier"}
        badgeLabel={text.statsBadgeLabel ?? "Est. 2024"}
        rating="4.9"
        reviews={41}
        accent="#c9a227"
        chipBg="rgba(201,162,39,0.14)"
        cardBg="#0c0b0a"
        textColor="#f3ede2"
        mutedColor="rgba(243,237,226,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#f3ede2"
        mutedColor="rgba(243,237,226,0.5)"
        tileBg="rgba(201,162,39,0.06)"
        accent="#c9a227"
        editing={editing}
        fallbackItems={[
          { icon: <Crown size={18} />, label: "Outerwear", count: 9 },
          { icon: <Gem size={18} />, label: "Tailoring", count: 14 },
          { icon: <BadgeCheck size={18} />, label: "Accessories", count: 11 },
          { icon: <Sparkles size={18} />, label: "Objects", count: 7 },
        ]}
        fallbackProducts={[
          { icon: <Crown size={18} />, name: "Tailored Coat", price: 185000 },
          { icon: <Gem size={18} />, name: "Silk Scarf", price: 42000 },
          { icon: <BadgeCheck size={18} />, name: "Leather Belt", price: 38000 },
          { icon: <Sparkles size={18} />, name: "Wool Trousers", price: 96000 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "New arrivals, quietly"}
        title={text.promoTitle ?? "This week's edit is now viewable"}
        cta="View the edit"
        accent="#c9a227"
        accentTextColor="#0c0b0a"
        cardBg="rgba(201,162,39,0.08)"
        textColor="#f3ede2"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "From the atelier"}
        sub={text.footerSub ?? "A short note on this season's fabric"}
        clusterColors={["#c9a227", "#6b5a1f", "#e9d98f"]}
        cardBg="rgba(201,162,39,0.06)"
        textColor="#f3ede2"
        mutedColor="rgba(243,237,226,0.5)"
        accent="#c9a227"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#0c0b0a] pb-2 text-[#f3ede2]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_75%_0%,rgba(201,162,39,0.16),transparent_45%)]" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(243,237,226,0.55)"
          brandInitial="A"
          defaultLogoText="Atelier Noir"
          editing={editing}
        />
        <HeroSlideshow
          images={editing?.slideshowImages ?? HERO_SLIDESHOW_IMAGES}
          editing={editing}
        />

        <div className="px-4 pt-6 text-center">
          <ThemeText
            editing={editing}
            field="hero1"
            defaultValue="Autumn selects, in full"
            as="p"
            className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#c9a227]"
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="Atelier Noir"
            as="h2"
            className="mt-2 font-serif text-[36px] italic leading-none tracking-[-0.02em]"
          />
          <div className="mx-auto mt-3 h-px w-12 bg-[#c9a227]/60" />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="Fewer pieces. Finer edit."
            as="p"
            className="mx-auto mt-3 max-w-[190px] text-[10.5px] leading-4 text-[#c9bea6]"
          />
        </div>

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

function NeonTerminalFull({ editing }: { editing?: ThemeEditingProps }) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#2dd4ff", "#0a5a6e", "#9be9f7"]}
        followersText={text.statsFollowersText ?? "4.1K+ nodes connected"}
        badgeLabel={text.statsBadgeLabel ?? "Elite Store"}
        rating="4.8"
        reviews={98}
        accent="#2dd4ff"
        chipBg="rgba(45,212,255,0.14)"
        cardBg="#05070a"
        textColor="#eafcff"
        mutedColor="rgba(234,252,255,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#eafcff"
        mutedColor="rgba(234,252,255,0.5)"
        tileBg="rgba(45,212,255,0.06)"
        accent="#2dd4ff"
        editing={editing}
        fallbackItems={[
          { icon: <Cpu size={18} />, label: "Techwear", count: 20 },
          { icon: <Zap size={18} />, label: "Utility", count: 18 },
          { icon: <Hexagon size={18} />, label: "Accessories", count: 22 },
          { icon: <ShieldCheck size={18} />, label: "Gadgets", count: 14 },
        ]}
        fallbackProducts={[
          { icon: <Cpu size={18} />, name: "Utility Vest", price: 54000 },
          { icon: <Zap size={18} />, name: "Circuit Cap", price: 16000 },
          { icon: <Hexagon size={18} />, name: "Node Backpack", price: 68000 },
          { icon: <ShieldCheck size={18} />, name: "HUD Glasses", price: 24500 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "System update"}
        title={text.promoTitle ?? "New drop online — sync inventory to view"}
        cta="Explore now"
        accent="#2dd4ff"
        accentTextColor="#05070a"
        cardBg="rgba(45,212,255,0.08)"
        textColor="#eafcff"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "Live activity"}
        sub={text.footerSub ?? "23 people viewing right now"}
        clusterColors={["#2dd4ff", "#0a5a6e", "#9be9f7"]}
        cardBg="rgba(45,212,255,0.06)"
        textColor="#eafcff"
        mutedColor="rgba(234,252,255,0.5)"
        accent="#2dd4ff"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#05070a] pb-2 text-[#eafcff]">
      <div className="absolute inset-0 h-[320px] opacity-30 [background-image:linear-gradient(rgba(45,212,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,255,0.3)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute right-6 top-6 h-8 w-8 border-r-2 border-t-2 border-[#2dd4ff]/50" />
      <div className="absolute left-6 top-6 h-8 w-8 border-l-2 border-t-2 border-[#2dd4ff]/50" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(234,252,255,0.6)"
          brandInitial="C"
          defaultLogoText="Circuit"
          editing={editing}
        />
        <HeroSlideshow
          images={editing?.slideshowImages ?? HERO_SLIDESHOW_IMAGES}
          editing={editing}
        />

        <div className="px-4 pt-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#2dd4ff]">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#2dd4ff]" />
            <ThemeText editing={editing} field="hero1" defaultValue="System online" as="span" />
          </p>
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="Circuit"
            as="h2"
            className="mt-2 font-display text-[40px] uppercase leading-[0.85] tracking-[-0.02em]"
            style={{ textShadow: "0 0 18px rgba(45,212,255,0.5)" }}
          />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="Style, compiled."
            as="p"
            className="mx-auto mt-2.5 max-w-[190px] text-[10.5px] leading-4 text-[#8fd9e8]"
          />
        </div>

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

export function FullPreview({
  themeId,
  editing,
}: {
  themeId: ThemeId;
  editing?: ThemeEditingProps;
}) {
  switch (themeId) {
    case "motion":
      return <MotionGridFull editing={editing} />;
    case "banner":
      return <ImmersiveBannerFull editing={editing} />;
    case "story":
      return <InteractiveStoryFull editing={editing} />;
    case "atelier":
      return <GalleryEditFull editing={editing} />;
    case "circuit":
      return <NeonTerminalFull editing={editing} />;
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
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [state, setState] = useState<ThemeEditState>(() => ({
    ...createInitialEditState(),
    // Seeded with the real default photos (not left as a "use defaults"
    // sentinel) so an explicit remove-down-to-zero is unambiguous — an empty
    // array always means "the seller removed every photo," never "untouched."
    slideshowImages: HERO_SLIDESHOW_IMAGES,
  }));
  const [hint, setHint] = useState<string | null>(null);
  const preEditSnapshot = useRef<ThemeEditState | null>(null);

  function enterEdit() {
    preEditSnapshot.current = state;
    setMode("edit");
  }
  function handleSave() {
    preEditSnapshot.current = null;
    setMode("view");
  }
  function handleBack() {
    if (preEditSnapshot.current) setState(preEditSnapshot.current);
    preEditSnapshot.current = null;
    setMode("view");
  }

  const editingProps: ThemeEditingProps = useMemo(
    () => ({
      isEditing: mode === "edit",
      logoMode: state.logoMode,
      onLogoModeChange: (logoMode) => {
        setState((s) => ({ ...s, logoMode }));
      },
      logoImage: state.logoImage,
      onLogoChange: (file) => {
        const url = URL.createObjectURL(file);
        setState((s) => ({ ...s, logoImage: url }));
      },
      slideshowImages: state.slideshowImages,
      onAddSlideshowImages: (files) => {
        setState((s) => {
          const room = MAX_SLIDESHOW_IMAGES - s.slideshowImages.length;
          if (room <= 0) return s;
          const added = Array.from(files)
            .slice(0, room)
            .map((f) => URL.createObjectURL(f));
          return { ...s, slideshowImages: [...s.slideshowImages, ...added] };
        });
      },
      onRemoveSlideshowImage: (index) => {
        setState((s) => ({
          ...s,
          slideshowImages: s.slideshowImages.filter((_, i) => i !== index),
        }));
      },
      onClearSlideshow: () => {
        setState((s) => ({ ...s, slideshowImages: [] }));
      },
      text: state.text,
      onTextChange: (field, value) => {
        setState((s) => ({ ...s, text: { ...s.text, [field]: value } }));
      },
      textFonts: state.textFonts,
      onTextFontChange: (field, font) => {
        setState((s) => ({ ...s, textFonts: { ...s.textFonts, [field]: font } }));
      },
      hiddenBlocks: state.hiddenBlocks,
      onRemoveBlock: (block: RemovableBlockId) => {
        setState((s) => ({ ...s, hiddenBlocks: [...s.hiddenBlocks, block] }));
      },
      layoutId: state.layoutId,
      onLayoutChange: (id) => {
        setState((s) => ({ ...s, layoutId: id }));
      },
      collectionsMode: state.collectionsMode,
      onCollectionsModeChange: (collectionsMode) => {
        setState((s) => ({ ...s, collectionsMode }));
      },
      onTileTapBlocked: () => {
        setHint(
          state.collectionsMode === "products"
            ? "Edit products from the Products page"
            : "Edit collections from the Collections page",
        );
        setTimeout(() => setHint(null), 2500);
      },
    }),
    [mode, state],
  );

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

      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-8 sm:py-12">
        <div className="flex w-full max-w-[430px] shrink-0 items-center justify-between pb-3">
          {mode === "view" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close preview"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={enterEdit}
                className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/15 hover:text-white"
              >
                <Pencil size={12} />
                Edit
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-900 hover:bg-white/90"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Back
                </button>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/15 hover:text-white"
                  >
                    <LayoutGrid size={12} />
                    Layout
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-56 border-white/10 bg-neutral-900 p-1.5 text-white"
                >
                  {LAYOUT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => editingProps.onLayoutChange(preset.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left hover:bg-white/10"
                    >
                      <span>
                        <span className="block text-[12px] font-medium text-white">
                          {preset.name}
                        </span>
                        <span className="block text-[10px] text-white/50">{preset.hint}</span>
                      </span>
                      {state.layoutId === preset.id && (
                        <CheckIcon size={13} className="shrink-0 text-white/80" />
                      )}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
        <div className="relative w-full max-w-[430px] shrink-0 overflow-hidden rounded-[2.5rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <div className="max-h-[82vh] overflow-y-auto">
            <FullPreview themeId={theme.id} editing={editingProps} />
          </div>
          {hint && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-[11px] text-white backdrop-blur">
              {hint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
