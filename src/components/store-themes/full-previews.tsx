import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Crown,
  Flame,
  Gem,
  Heart,
  Hexagon,
  Layers,
  LayoutGrid,
  Leaf,
  Moon,
  Pencil,
  Check as CheckIcon,
  ShieldCheck,
  Sparkles,
  Stars,
  X,
  Zap,
  Cpu,
} from "lucide-react";
import placeholderPhoto1 from "@/assets/Store theme placeholder images/photo_1_2026-08-22_00-20-52.jpg";
import placeholderPhoto2 from "@/assets/Store theme placeholder images/photo_2_2026-08-22_00-20-52.jpg";
import placeholderPhoto3 from "@/assets/Store theme placeholder images/photo_3_2026-08-22_00-20-52.jpg";
import placeholderPhoto4 from "@/assets/Store theme placeholder images/photo_4_2026-08-22_00-20-52.jpg";
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
import { useThemeCustomization } from "./useThemeCustomization";
import { useStoreTheme } from "./useStoreTheme";
import { useActiveStoreId } from "@/hooks/use-own-store";

function noop() {}

const HERO_SLIDESHOW_IMAGES = [
  placeholderPhoto1,
  placeholderPhoto2,
  placeholderPhoto3,
  placeholderPhoto4,
];

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

function MotionGridFull({
  editing,
  storeId,
}: {
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#b673ff", "#722ee8", "#3a1a63"]}
        followersText={text.statsFollowersText ?? "2.7K+ followers love this store"}
        cardBg="#09070d"
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
        storeId={storeId}
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

function ImmersiveBannerFull({
  editing,
  storeId,
}: {
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#c2aa8c", "#8b735b", "#e5d9c4"]}
        followersText={text.statsFollowersText ?? "1.3K+ shop here"}
        cardBg="#f6f2e9"
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
        storeId={storeId}
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

function GalleryEditFull({
  editing,
  storeId,
}: {
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#c9a227", "#6b5a1f", "#e9d98f"]}
        followersText={text.statsFollowersText ?? "890 in the atelier"}
        cardBg="#0c0b0a"
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
        storeId={storeId}
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

function NeonTerminalFull({
  editing,
  storeId,
}: {
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#2dd4ff", "#0a5a6e", "#9be9f7"]}
        followersText={text.statsFollowersText ?? "4.1K+ nodes connected"}
        cardBg="#05070a"
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
        storeId={storeId}
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

function VerdantNoirFull({
  editing,
  storeId,
}: {
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#3fae63", "#1d5c34", "#153c22"]}
        followersText={text.statsFollowersText ?? "1.8K+ growing this store"}
        cardBg="#0a0f0b"
        mutedColor="rgba(232,242,235,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#eaf2ec"
        mutedColor="rgba(234,242,236,0.5)"
        tileBg="rgba(63,174,99,0.07)"
        accent="#3fae63"
        editing={editing}
        storeId={storeId}
        fallbackItems={[
          { icon: <Leaf size={18} />, label: "New Growth", count: 14 },
          { icon: <ShieldCheck size={18} />, label: "Outerwear", count: 19 },
          { icon: <Heart size={18} />, label: "Essentials", count: 26 },
          { icon: <Sparkles size={18} />, label: "Accessories", count: 11 },
        ]}
        fallbackProducts={[
          { icon: <Leaf size={18} />, name: "Moss Jacket", price: 58000 },
          { icon: <ShieldCheck size={18} />, name: "Field Vest", price: 41000 },
          { icon: <Heart size={18} />, name: "Fern Tee", price: 16500 },
          { icon: <Sparkles size={18} />, name: "Grove Cap", price: 9500 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "New season"}
        title={text.promoTitle ?? "Rooted pieces, built to outlast a trend"}
        cta="Explore"
        accent="#3fae63"
        cardBg="rgba(63,174,99,0.08)"
        textColor="#eaf2ec"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "From the grove"}
        sub={text.footerSub ?? "A short note on this season's materials"}
        clusterColors={["#3fae63", "#1d5c34", "#153c22"]}
        cardBg="rgba(63,174,99,0.07)"
        textColor="#eaf2ec"
        mutedColor="rgba(234,242,236,0.5)"
        accent="#3fae63"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#0a0f0b] pb-2 text-[#eaf2ec]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_20%_0%,rgba(63,174,99,0.16),transparent_45%)]" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(234,242,236,0.6)"
          brandInitial="F"
          defaultLogoText="Fern & Co."
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
            defaultValue="Grown, not manufactured"
            as="p"
            className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#7fcf9a]"
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="Fern & Co."
            as="h2"
            className="mt-1 font-serif text-[38px] leading-[0.9] tracking-[-0.03em]"
          />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="Quiet colour for slow living."
            as="p"
            className="mt-2 text-[11px] leading-4 text-[#c3d6ca]"
          />
        </div>

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

function MonochromeFull({
  editing,
  storeId,
}: {
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#111111", "#4a4a4a", "#c9c9c9"]}
        followersText={text.statsFollowersText ?? "2.1K+ shop the edit"}
        cardBg="#fafafa"
        mutedColor="rgba(17,17,17,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#111111"
        mutedColor="rgba(17,17,17,0.5)"
        tileBg="rgba(17,17,17,0.05)"
        accent="#111111"
        editing={editing}
        storeId={storeId}
        fallbackItems={[
          { icon: <Layers size={18} />, label: "Basics", count: 24 },
          { icon: <Check size={18} />, label: "Tailored", count: 15 },
          { icon: <Hexagon size={18} />, label: "Structure", count: 9 },
          { icon: <ShieldCheck size={18} />, label: "Outerwear", count: 12 },
        ]}
        fallbackProducts={[
          { icon: <Layers size={18} />, name: "Grid Tee", price: 15000 },
          { icon: <Check size={18} />, name: "Tailored Trouser", price: 47000 },
          { icon: <Hexagon size={18} />, name: "Structured Bag", price: 39000 },
          { icon: <ShieldCheck size={18} />, name: "Panel Coat", price: 89000 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "New arrivals"}
        title={text.promoTitle ?? "Black and white. Nothing to hide behind."}
        cta="Shop now"
        accent="#111111"
        cardBg="rgba(17,17,17,0.04)"
        textColor="#111111"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "Worn by the community"}
        sub={text.footerSub ?? "118 people wearing it today"}
        clusterColors={["#111111", "#4a4a4a", "#c9c9c9"]}
        cardBg="rgba(17,17,17,0.05)"
        textColor="#111111"
        mutedColor="rgba(17,17,17,0.5)"
        accent="#111111"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#fafafa] pb-2 text-[#111111]">
      <div className="absolute inset-x-0 top-0 h-52 bg-[linear-gradient(135deg,#ffffff_0%,#e8e8e8_100%)]" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(17,17,17,0.6)"
          brandInitial="N"
          defaultLogoText="NOIR/BLANC"
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
            defaultValue="No colour to distract you"
            as="p"
            className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#5a5a5a]"
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="NOIR/BLANC"
            as="h2"
            className="mt-1 font-display text-[34px] uppercase leading-[0.9] tracking-[-0.02em]"
          />
          <div className="mx-auto mt-2.5 h-px w-14 bg-[#111111]" />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="Two colours. Every shape."
            as="p"
            className="mx-auto mt-2.5 max-w-[190px] text-[11px] leading-4 text-[#5a5a5a]"
          />
        </div>

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

function GildedFull({ editing, storeId }: { editing?: ThemeEditingProps; storeId: string | null }) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#d4af37", "#8a6d1f", "#f3e2a6"]}
        followersText={text.statsFollowersText ?? "3.2K+ in the house"}
        cardBg="#0d0904"
        mutedColor="rgba(243,236,220,0.55)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#f3ecdc"
        mutedColor="rgba(243,236,220,0.5)"
        tileBg="rgba(212,175,55,0.07)"
        accent="#d4af37"
        editing={editing}
        storeId={storeId}
        fallbackItems={[
          { icon: <Crown size={18} />, label: "Outerwear", count: 8 },
          { icon: <Gem size={18} />, label: "Jewellery", count: 16 },
          { icon: <BadgeCheck size={18} />, label: "Signature", count: 10 },
          { icon: <Sparkles size={18} />, label: "Evening", count: 13 },
        ]}
        fallbackProducts={[
          { icon: <Crown size={18} />, name: "Regal Coat", price: 220000 },
          { icon: <Gem size={18} />, name: "Gold Cuff", price: 65000 },
          { icon: <BadgeCheck size={18} />, name: "Signature Belt", price: 48000 },
          { icon: <Sparkles size={18} />, name: "Evening Gown", price: 310000 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "By invitation"}
        title={text.promoTitle ?? "The gilded edit — available for a short while"}
        cta="Enter"
        accent="#d4af37"
        cardBg="rgba(212,175,55,0.08)"
        textColor="#f3ecdc"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "From the house"}
        sub={text.footerSub ?? "A note from Aurum House"}
        clusterColors={["#d4af37", "#8a6d1f", "#f3e2a6"]}
        cardBg="rgba(212,175,55,0.07)"
        textColor="#f3ecdc"
        mutedColor="rgba(243,236,220,0.5)"
        accent="#d4af37"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#0d0904] pb-2 text-[#f3ecdc]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_80%_0%,rgba(212,175,55,0.2),transparent_45%)]" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(243,236,220,0.55)"
          brandInitial="A"
          defaultLogoText="Aurum House"
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
            defaultValue="Opulence, quietly worn"
            as="p"
            className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#d4af37]"
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="Aurum House"
            as="h2"
            className="mt-2 font-serif text-[36px] leading-none tracking-[-0.02em]"
          />
          <div className="mx-auto mt-3 h-px w-12 bg-[#d4af37]/60" />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="Gold is a finish, not a shortcut."
            as="p"
            className="mx-auto mt-3 max-w-[190px] text-[10.5px] leading-4 text-[#d8cbaa]"
          />
        </div>

        {orderedBlocks(editing, blocks)}
      </div>
    </div>
  );
}

function ObsidianFull({
  editing,
  storeId,
}: {
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={["#3a3a3a", "#1a1a1a", "#5c5c5c"]}
        followersText={text.statsFollowersText ?? "980+ watching this space"}
        cardBg="#030303"
        mutedColor="rgba(230,230,230,0.5)"
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor="#e6e6e6"
        mutedColor="rgba(230,230,230,0.45)"
        tileBg="rgba(255,255,255,0.03)"
        accent="#6b6b6b"
        editing={editing}
        storeId={storeId}
        fallbackItems={[
          { icon: <Moon size={18} />, label: "Night", count: 11 },
          { icon: <Hexagon size={18} />, label: "Form", count: 9 },
          { icon: <ShieldCheck size={18} />, label: "Armour", count: 13 },
          { icon: <Flame size={18} />, label: "Limited", count: 6 },
        ]}
        fallbackProducts={[
          { icon: <Moon size={18} />, name: "Void Jacket", price: 76000 },
          { icon: <Hexagon size={18} />, name: "Form Tee", price: 19000 },
          { icon: <ShieldCheck size={18} />, name: "Armour Vest", price: 58000 },
          { icon: <Flame size={18} />, name: "Limited Boot", price: 92000 },
        ]}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? "Almost nothing left"}
        title={text.promoTitle ?? "The whole drop, one shade of black"}
        cta="See it"
        accent="#6b6b6b"
        cardBg="rgba(255,255,255,0.04)"
        textColor="#e6e6e6"
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? "Still here"}
        sub={text.footerSub ?? "9 people looking right now"}
        clusterColors={["#3a3a3a", "#1a1a1a", "#5c5c5c"]}
        cardBg="rgba(255,255,255,0.03)"
        textColor="#e6e6e6"
        mutedColor="rgba(230,230,230,0.45)"
        accent="#6b6b6b"
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative bg-[#030303] pb-2 text-[#e6e6e6]">
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_55%)]" />
      <div className="relative">
        <PhoneHeader
          mutedColor="rgba(230,230,230,0.55)"
          brandInitial="V"
          defaultLogoText="VOID"
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
            defaultValue="Nothing extra"
            as="p"
            className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#7a7a7a]"
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue="VOID"
            as="h2"
            className="mt-1 font-display text-[40px] uppercase leading-[0.85] tracking-[-0.03em]"
          />
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue="One colour. Every silhouette."
            as="p"
            className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[#8a8a8a]"
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
  storeId,
}: {
  themeId: ThemeId;
  editing?: ThemeEditingProps;
  storeId: string | null;
}) {
  switch (themeId) {
    case "motion":
      return <MotionGridFull editing={editing} storeId={storeId} />;
    case "banner":
      return <ImmersiveBannerFull editing={editing} storeId={storeId} />;
    case "atelier":
      return <GalleryEditFull editing={editing} storeId={storeId} />;
    case "circuit":
      return <NeonTerminalFull editing={editing} storeId={storeId} />;
    case "verdant":
      return <VerdantNoirFull editing={editing} storeId={storeId} />;
    case "monochrome":
      return <MonochromeFull editing={editing} storeId={storeId} />;
    case "gilded":
      return <GildedFull editing={editing} storeId={storeId} />;
    case "obsidian":
      return <ObsidianFull editing={editing} storeId={storeId} />;
  }
}

// Renders a store's actual chosen theme, with its saved customizations, as
// plain non-editable content — this is what makes an already-designed
// storefront show up on /profile/$username and /store-profile/$storeUsername
// instead of those pages falling back to a generic product grid. Every write
// handler below is a no-op: edit affordances (inputs, remove buttons, the
// font picker, drag-to-crop) only render when `isEditing` is true, so none
// of them can ever actually fire here — no need for real mutate/undo/save
// wiring on a page that can't edit.
export function PublicStorefront({ storeId }: { storeId: string }) {
  const { themeId, loading: themeLoading } = useStoreTheme(storeId);
  const { saved, loading: savedLoading } = useThemeCustomization(themeId, storeId);

  if (themeLoading || savedLoading) {
    return <div className="py-12 text-center text-[13px] text-white/40">Loading…</div>;
  }

  const state: ThemeEditState = {
    ...createInitialEditState(),
    // Real uploads aren't persisted yet (see useThemeCustomization) — same
    // placeholder photos the editor itself starts from before the seller
    // adds their own.
    slideshowImages: HERO_SLIDESHOW_IMAGES,
    ...saved,
  };

  const editing: ThemeEditingProps = {
    isEditing: false,
    logoMode: state.logoMode,
    onLogoModeChange: noop,
    logoImage: state.logoImage,
    onLogoChange: noop,
    slideshowImages: state.slideshowImages,
    onAddSlideshowImages: noop,
    onRemoveSlideshowImage: noop,
    onClearSlideshow: noop,
    slideshowCrops: state.slideshowCrops,
    onSlideshowCropChange: noop,
    slideshowAspectRatio: state.slideshowAspectRatio,
    onSlideshowAspectRatioChange: noop,
    tileCrops: state.tileCrops,
    onTileCropChange: noop,
    text: state.text,
    onTextChange: noop,
    textFonts: state.textFonts,
    onTextFontChange: noop,
    hiddenBlocks: state.hiddenBlocks,
    onRemoveBlock: noop,
    layoutId: state.layoutId,
    onLayoutChange: noop,
    collectionsMode: state.collectionsMode,
    onCollectionsModeChange: noop,
    onTileTapBlocked: noop,
  };

  return <FullPreview themeId={themeId} editing={editing} storeId={storeId} />;
}

export function ThemePreviewSheet({
  theme,
  isSelected,
  onClose,
  onSelect,
  initialMode = "view",
}: {
  theme: Theme;
  isSelected: boolean;
  onClose: () => void;
  onSelect: () => void;
  /** Lets the theme grid send sellers straight into edit mode via its own
   * "Edit" button, without changing what the in-sheet Edit pill does. */
  initialMode?: "view" | "edit";
}) {
  const { storeId } = useActiveStoreId();
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  // `current` + `history` live in one state object on purpose: a setState
  // updater must be pure (React/StrictMode double-invokes it in dev to catch
  // exactly this), so `mutate` can't call a second setState from inside the
  // first one to record history as a side effect — that double-pushes under
  // StrictMode. One object, one updater, no nesting.
  const [editState, setEditState] = useState<{
    current: ThemeEditState;
    history: ThemeEditState[];
    future: ThemeEditState[];
  }>(() => ({
    current: {
      ...createInitialEditState(),
      // Seeded with the real default photos (not left as a "use defaults"
      // sentinel) so an explicit remove-down-to-zero is unambiguous — an
      // empty array always means "the seller removed every photo," never
      // "untouched."
      slideshowImages: HERO_SLIDESHOW_IMAGES,
    },
    history: [],
    future: [],
  }));
  const state = editState.current;
  const history = editState.history;
  const future = editState.future;
  const [hint, setHint] = useState<string | null>(null);

  const { saved, save: saveCustomization } = useThemeCustomization(theme.id);
  // Applied once, the instant a saved row shows up — but skipped if the
  // seller has already started editing by the time it arrives. Without
  // hasEditedRef, a fetch that resolves after the first keystroke would
  // silently overwrite that in-progress edit with the (older) saved value.
  const appliedSavedRef = useRef(false);
  const hasEditedRef = useRef(false);
  useEffect(() => {
    if (!saved || appliedSavedRef.current || hasEditedRef.current) return;
    appliedSavedRef.current = true;
    setEditState((es) => ({ current: { ...es.current, ...saved }, history: [], future: [] }));
  }, [saved]);

  function mutate(updater: (s: ThemeEditState) => ThemeEditState) {
    hasEditedRef.current = true;
    // A fresh edit invalidates whatever was undone before it — otherwise
    // redo could resurrect a branch that the seller has since diverged from.
    setEditState((es) => ({
      current: updater(es.current),
      history: [...es.history, es.current],
      future: [],
    }));
  }

  function enterEdit() {
    setEditState((es) => ({ ...es, history: [], future: [] }));
    setMode("edit");
  }
  function handleSave() {
    setEditState((es) => ({ ...es, history: [], future: [] }));
    setMode("view");
    void saveCustomization(state);
  }
  function handleUndo() {
    setEditState((es) => {
      if (es.history.length === 0) return es;
      return {
        current: es.history[es.history.length - 1],
        history: es.history.slice(0, -1),
        future: [es.current, ...es.future],
      };
    });
  }
  function handleRedo() {
    setEditState((es) => {
      if (es.future.length === 0) return es;
      return {
        current: es.future[0],
        history: [...es.history, es.current],
        future: es.future.slice(1),
      };
    });
  }

  const editingProps: ThemeEditingProps = useMemo(
    () => ({
      isEditing: mode === "edit",
      logoMode: state.logoMode,
      onLogoModeChange: (logoMode) => {
        mutate((s) => ({ ...s, logoMode }));
      },
      logoImage: state.logoImage,
      onLogoChange: (file) => {
        const url = URL.createObjectURL(file);
        mutate((s) => ({ ...s, logoImage: url }));
      },
      slideshowImages: state.slideshowImages,
      onAddSlideshowImages: (files) => {
        mutate((s) => {
          const room = MAX_SLIDESHOW_IMAGES - s.slideshowImages.length;
          if (room <= 0) return s;
          const added = Array.from(files)
            .slice(0, room)
            .map((f) => URL.createObjectURL(f));
          return { ...s, slideshowImages: [...s.slideshowImages, ...added] };
        });
      },
      onRemoveSlideshowImage: (index) => {
        mutate((s) => ({
          ...s,
          slideshowImages: s.slideshowImages.filter((_, i) => i !== index),
        }));
      },
      slideshowCrops: state.slideshowCrops,
      onSlideshowCropChange: (src, position) => {
        mutate((s) => ({ ...s, slideshowCrops: { ...s.slideshowCrops, [src]: position } }));
      },
      slideshowAspectRatio: state.slideshowAspectRatio,
      onSlideshowAspectRatioChange: (ratio) => {
        mutate((s) => ({ ...s, slideshowAspectRatio: ratio }));
      },
      tileCrops: state.tileCrops,
      onTileCropChange: (key, position) => {
        mutate((s) => ({ ...s, tileCrops: { ...s.tileCrops, [key]: position } }));
      },
      onClearSlideshow: () => {
        mutate((s) => ({ ...s, slideshowImages: [] }));
      },
      text: state.text,
      onTextChange: (field, value) => {
        mutate((s) => ({ ...s, text: { ...s.text, [field]: value } }));
      },
      textFonts: state.textFonts,
      onTextFontChange: (field, font) => {
        mutate((s) => ({ ...s, textFonts: { ...s.textFonts, [field]: font } }));
      },
      hiddenBlocks: state.hiddenBlocks,
      onRemoveBlock: (block: RemovableBlockId) => {
        mutate((s) => ({ ...s, hiddenBlocks: [...s.hiddenBlocks, block] }));
      },
      layoutId: state.layoutId,
      onLayoutChange: (id) => {
        mutate((s) => ({ ...s, layoutId: id }));
      },
      collectionsMode: state.collectionsMode,
      onCollectionsModeChange: (collectionsMode) => {
        mutate((s) => ({ ...s, collectionsMode }));
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
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  aria-label="Undo last edit"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowLeft size={16} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  aria-label="Redo last undone edit"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowRight size={16} strokeWidth={1.8} />
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
            <FullPreview themeId={theme.id} editing={editingProps} storeId={storeId} />
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
