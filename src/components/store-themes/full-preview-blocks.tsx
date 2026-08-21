import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Search, Share2, ShoppingBag, Star } from "lucide-react";

// Shared, theme-agnostic building blocks for the full (phone-frame) storefront
// preview. Every theme's colors/copy/icons are passed in as props — this is
// what makes adding theme #6, #7, etc. later mostly a config exercise instead
// of another few hundred lines of bespoke JSX.

export function PhoneHeader({
  textColor,
  mutedColor,
}: {
  textColor: string;
  mutedColor: string;
  ringGradient: string;
  avatarBg: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <ArrowLeft size={16} strokeWidth={1.8} style={{ color: textColor }} />
      <div className="flex items-center gap-3" style={{ color: mutedColor }}>
        <ShoppingBag size={15} strokeWidth={1.8} />
        <Share2 size={15} strokeWidth={1.8} />
        <Search size={15} strokeWidth={1.8} />
      </div>
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
