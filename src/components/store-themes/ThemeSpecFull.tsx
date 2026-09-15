import { Fragment, useEffect, type ReactNode } from "react";
import { Check, Heart, Sparkles, Stars } from "lucide-react";
import {
  CollectionsGrid,
  FooterTeaser,
  HeroSlideshow,
  PhoneHeader,
  PromoBanner,
  StatsRow,
} from "./full-preview-blocks";
import { ThemeText } from "./EditableText";
import { ensureThemeFont, FONT_OPTIONS, type FontId } from "./fonts";
import {
  alpha,
  clusterFrom,
  isDark,
  readableAccent,
  shade,
  type HeroDecor,
  type ThemeSpec,
} from "./theme-spec";
import { readableTextColor } from "./colors";
import { HERO_SLIDESHOW_IMAGES } from "./hero-placeholders";
import type { ThemeEditingProps } from "./edit-types";
import { LAYOUT_PRESETS, type ArrangeableBlockId } from "./layout-presets";

// Placeholder tile art is the same four marks for every spec theme on
// purpose: these only ever show for a store with nothing listed yet, and the
// moment it has a real catalogue they are replaced wholesale. Spending
// per-theme icon choices on them would be spec surface nobody ever sees.
const TILE_ICONS = [
  <Sparkles key="a" size={18} />,
  <Heart key="b" size={18} />,
  <Stars key="c" size={18} />,
  <Check key="d" size={18} />,
];

function fontFamilyOf(id: FontId): string | undefined {
  return FONT_OPTIONS.find((f) => f.id === id)?.fontFamily;
}

function Decoration({ decor, accent }: { decor: HeroDecor; accent: string }) {
  switch (decor.kind) {
    case "grid":
      return (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[320px] opacity-40"
          style={{
            backgroundImage: `linear-gradient(${alpha(accent, 0.25)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(accent, 0.25)} 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(#000, transparent)",
            WebkitMaskImage: "linear-gradient(#000, transparent)",
          }}
        />
      );
    case "glow":
      return (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{
            background: `radial-gradient(circle at ${decor.at ?? "70% 0%"}, ${alpha(accent, 0.18)}, transparent 45%)`,
          }}
        />
      );
    case "wash":
      return (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-52"
          style={{
            background: `linear-gradient(135deg, ${alpha(accent, 0.22)} 0%, transparent 70%)`,
          }}
        />
      );
    case "orbs":
      return (
        <>
          <div
            className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full blur-3xl"
            style={{ background: alpha(accent, 0.3) }}
          />
          <div
            className="pointer-events-none absolute -right-10 top-40 h-36 w-36 rounded-full blur-3xl"
            style={{ background: alpha(shade(accent, 0.35), 0.22) }}
          />
        </>
      );
    case "brackets":
      return (
        <>
          <div
            className="pointer-events-none absolute left-5 top-5 h-8 w-8 border-l-2 border-t-2"
            style={{ borderColor: alpha(accent, 0.5) }}
          />
          <div
            className="pointer-events-none absolute right-5 top-5 h-8 w-8 border-r-2 border-t-2"
            style={{ borderColor: alpha(accent, 0.5) }}
          />
        </>
      );
    case "none":
      return null;
  }
}

function orderedSpecBlocks(
  editing: ThemeEditingProps | undefined,
  blocks: Partial<Record<ArrangeableBlockId, ReactNode>>,
) {
  const layoutId = editing?.layoutId ?? "hero-led";
  const order = LAYOUT_PRESETS.find((p) => p.id === layoutId)?.order ?? LAYOUT_PRESETS[0].order;
  return order.map((id) => <Fragment key={id}>{blocks[id]}</Fragment>);
}

// Same contract as every hand-written *Full component: one optional `editing`
// prop, and the four reorderable blocks built as a map rendered in the active
// layout's order rather than a fixed sequence.
export function ThemeSpecFull({
  spec,
  editing,
  storeId,
  brandName,
}: {
  spec: ThemeSpec;
  editing?: ThemeEditingProps;
  storeId: string | null;
  brandName: string;
}) {
  const hidden = editing?.hiddenBlocks ?? [];
  const text = editing?.text ?? {};

  // Spec faces load on demand, exactly like the per-field ones a seller
  // picks — a storefront must never pull a family it does not render.
  useEffect(() => {
    ensureThemeFont(spec.heading);
    ensureThemeFont(spec.body);
  }, [spec.heading, spec.body]);

  const dark = isDark(spec.bg);
  const muted = alpha(spec.ink, 0.58);
  const cluster = clusterFrom(spec.accent);
  const tileBg = alpha(spec.accent, dark ? 0.08 : 0.07);
  const promoBg = alpha(spec.accent, dark ? 0.1 : 0.08);
  // Fills keep the raw accent; anything that renders as text or a stroke
  // takes the readable one. See readableAccent.
  const accentInk = readableAccent(spec.accent, spec.bg);
  const headingFamily = fontFamilyOf(spec.heading);
  const bodyFamily = fontFamilyOf(spec.body);

  const blocks: Partial<Record<ArrangeableBlockId, ReactNode>> = {
    stats: !hidden.includes("stats") && (
      <StatsRow
        clusterColors={cluster}
        followersLabel={text.statsFollowersText ?? spec.copy.followers}
        storeId={storeId}
        cardBg={spec.bg}
        mutedColor={muted}
        editing={editing}
      />
    ),
    collections: (
      <CollectionsGrid
        textColor={spec.ink}
        mutedColor={muted}
        tileBg={tileBg}
        accent={accentInk}
        editing={editing}
        storeId={storeId}
        fallbackItems={spec.collections.map((label, i) => ({
          icon: TILE_ICONS[i],
          label,
          count: spec.counts[i],
        }))}
        fallbackProducts={spec.products.map((name, i) => ({
          icon: TILE_ICONS[i],
          name,
          price: spec.prices[i],
        }))}
      />
    ),
    promo: !hidden.includes("promo") && (
      <PromoBanner
        eyebrow={text.promoEyebrow ?? spec.copy.promoEyebrow}
        title={text.promoTitle ?? spec.copy.promoTitle}
        cta={spec.copy.promoCta}
        accent={accentInk}
        accentTextColor={readableTextColor(accentInk)}
        cardBg={promoBg}
        textColor={spec.ink}
        editing={editing}
      />
    ),
    footer: !hidden.includes("footer") && (
      <FooterTeaser
        label={text.footerLabel ?? spec.copy.footer}
        storeId={storeId}
        clusterColors={cluster}
        cardBg={tileBg}
        textColor={spec.ink}
        mutedColor={muted}
        accent={accentInk}
        editing={editing}
      />
    ),
  };

  return (
    <div className="relative pb-2" style={{ background: spec.bg, color: spec.ink }}>
      <Decoration decor={spec.decor} accent={spec.accent} />
      <div className="relative">
        <PhoneHeader
          mutedColor={alpha(spec.ink, 0.65)}
          brandInitial={brandName.charAt(0).toUpperCase()}
          defaultLogoText={brandName}
          editing={editing}
        />
        <HeroSlideshow
          images={editing?.slideshowImages ?? HERO_SLIDESHOW_IMAGES}
          editing={editing}
        />

        <div className={`px-4 pt-6 ${spec.heroAlign === "center" ? "text-center" : ""}`}>
          <ThemeText
            editing={editing}
            field="hero1"
            defaultValue={spec.copy.eyebrow}
            as="p"
            className="text-[11px] font-semibold uppercase tracking-[0.25em]"
            style={{ color: accentInk, fontFamily: bodyFamily }}
          />
          <ThemeText
            editing={editing}
            field="hero2"
            defaultValue={brandName}
            as="h2"
            className={`mt-1.5 leading-[0.9] ${spec.heroUppercase ? "uppercase" : ""}`}
            style={{
              fontSize: spec.heroSize,
              fontFamily: headingFamily,
              letterSpacing: "-0.02em",
            }}
          />
          {spec.rule && (
            <div
              className={`mt-3 h-px w-14 ${spec.heroAlign === "center" ? "mx-auto" : ""}`}
              style={{ background: alpha(spec.accent, 0.7) }}
            />
          )}
          <ThemeText
            editing={editing}
            field="hero3"
            defaultValue={spec.copy.sub}
            as="p"
            className={`mt-2.5 max-w-[240px] text-[13px] leading-[1.4] ${
              spec.heroAlign === "center" ? "mx-auto" : ""
            }`}
            style={{ color: muted, fontFamily: bodyFamily }}
          />
        </div>

        {orderedSpecBlocks(editing, blocks)}
      </div>
    </div>
  );
}
