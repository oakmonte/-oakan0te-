import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  RefreshCw,
  Search,
  Share2,
  ShoppingBag,
  Star,
  User,
} from "lucide-react";

// Shared, theme-agnostic building blocks for the full (phone-frame) storefront
// preview. Every theme's colors/copy/icons are passed in as props — this is
// what makes adding theme #6, #7, etc. later mostly a config exercise instead
// of another few hundred lines of bespoke JSX.

export function PhoneHeader({
  textColor,
  mutedColor,
  ringGradient,
  avatarBg,
}: {
  textColor: string;
  mutedColor: string;
  ringGradient: string;
  avatarBg: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <ArrowLeft size={16} strokeWidth={1.8} style={{ color: textColor }} />
      <div className="h-10 w-10 rounded-full p-[2px]" style={{ background: ringGradient }}>
        <div
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{ background: avatarBg }}
        >
          <User size={15} style={{ color: textColor }} />
        </div>
      </div>
      <div className="flex items-center gap-3" style={{ color: mutedColor }}>
        <ShoppingBag size={15} strokeWidth={1.8} />
        <Share2 size={15} strokeWidth={1.8} />
        <Search size={15} strokeWidth={1.8} />
      </div>
    </div>
  );
}

export function PhoneTabBar({
  accent,
  accentTextColor = "#ffffff",
  mutedColor,
}: {
  accent: string;
  accentTextColor?: string;
  mutedColor: string;
}) {
  return (
    <div className="flex items-center justify-around px-6 py-2.5" style={{ color: mutedColor }}>
      <div className="grid grid-cols-2 gap-[3px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className="h-[3px] w-[3px] rounded-full"
            style={{ background: mutedColor }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: accent }}
        >
          <ShoppingBag size={14} style={{ color: accentTextColor }} />
        </div>
        <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
      </div>
      <RefreshCw size={15} strokeWidth={1.8} />
      <Bookmark size={15} strokeWidth={1.8} />
    </div>
  );
}

export function StatsRow({
  clusterColors,
  followersText,
  badgeLabel,
  rating,
  reviews,
  accent,
  chipBg,
  cardBg,
  textColor,
  mutedColor,
}: {
  clusterColors: [string, string, string];
  followersText: string;
  badgeLabel: string;
  rating: string;
  reviews: number;
  accent: string;
  chipBg: string;
  cardBg: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-4">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {clusterColors.map((c, i) => (
            <div
              key={i}
              className="h-6 w-6 rounded-full border-2"
              style={{ background: c, borderColor: cardBg }}
            />
          ))}
        </div>
        <p className="max-w-[120px] text-[9px] leading-tight" style={{ color: mutedColor }}>
          {followersText}
        </p>
      </div>
      <div
        className="flex items-center gap-1 rounded-full px-2.5 py-1.5"
        style={{ background: chipBg }}
      >
        <Star size={10} fill={accent} style={{ color: accent }} />
        <span className="text-[8.5px] font-semibold whitespace-nowrap" style={{ color: textColor }}>
          {badgeLabel} · {rating} ({reviews})
        </span>
      </div>
    </div>
  );
}

export function FeatureStrip({
  features,
  cardBg,
  textColor,
  accent,
}: {
  features: { icon: ReactNode; label: string }[];
  cardBg: string;
  textColor: string;
  accent: string;
}) {
  return (
    <div
      className="mx-4 mt-4 grid grid-cols-4 gap-1.5 rounded-xl p-2.5 text-center"
      style={{ background: cardBg }}
    >
      {features.map((f, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 py-0.5">
          <span style={{ color: accent }}>{f.icon}</span>
          <span className="text-[7.5px] leading-[9px] font-medium" style={{ color: textColor }}>
            {f.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CollectionsGrid({
  items,
  textColor,
  mutedColor,
  tileBg,
  accent,
}: {
  items: { icon: ReactNode; label: string; count: number }[];
  textColor: string;
  mutedColor: string;
  tileBg: string;
  accent: string;
}) {
  return (
    <div className="mt-5 px-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color: textColor }}>
          Collections
        </span>
        <span
          className="flex items-center gap-0.5 text-[9px] font-medium"
          style={{ color: accent }}
        >
          View all <ChevronRight size={11} />
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl p-2.5" style={{ background: tileBg }}>
            <div
              className="mb-2 flex h-14 items-center justify-center rounded-lg"
              style={{ background: `${accent}22` }}
            >
              <span style={{ color: accent }}>{it.icon}</span>
            </div>
            <p className="text-[10px] font-medium" style={{ color: textColor }}>
              {it.label}
            </p>
            <p className="text-[8px]" style={{ color: mutedColor }}>
              {it.count} items
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PromoBanner({
  eyebrow,
  title,
  cta,
  countdown,
  accent,
  accentTextColor = "#0a0a0a",
  cardBg,
  textColor,
}: {
  eyebrow: string;
  title: string;
  cta?: string;
  countdown?: string;
  accent: string;
  accentTextColor?: string;
  cardBg: string;
  textColor: string;
}) {
  return (
    <div
      className="mx-4 mt-5 rounded-2xl p-3.5"
      style={{ background: cardBg, border: `1px solid ${accent}55` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[8px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: accent }}
          >
            {eyebrow}
          </p>
          <p
            className="mt-1 text-[11.5px] font-semibold leading-tight"
            style={{ color: textColor }}
          >
            {title}
          </p>
        </div>
        {countdown ? (
          <span
            className="shrink-0 text-[11px] font-semibold tabular-nums"
            style={{ color: accent }}
          >
            {countdown}
          </span>
        ) : (
          <span
            className="shrink-0 rounded-full px-2.5 py-1.5 text-[8.5px] font-semibold whitespace-nowrap"
            style={{ background: accent, color: accentTextColor }}
          >
            {cta}
          </span>
        )}
      </div>
    </div>
  );
}

export function FooterTeaser({
  label,
  sub,
  clusterColors,
  cardBg,
  textColor,
  mutedColor,
  accent,
}: {
  label: string;
  sub: string;
  clusterColors: string[];
  cardBg: string;
  textColor: string;
  mutedColor: string;
  accent: string;
}) {
  return (
    <div
      className="mx-4 my-5 flex items-center justify-between rounded-xl px-3.5 py-3"
      style={{ background: cardBg }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold" style={{ color: textColor }}>
          {label}
        </p>
        <p className="text-[9px] truncate" style={{ color: mutedColor }}>
          {sub}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex -space-x-1.5">
          {clusterColors.map((c, i) => (
            <div
              key={i}
              className="h-4 w-4 rounded-full border"
              style={{ background: c, borderColor: cardBg }}
            />
          ))}
        </div>
        <ChevronRight size={12} style={{ color: accent }} />
      </div>
    </div>
  );
}
