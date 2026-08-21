import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Star,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditableText } from "./EditableText";
import { MAX_SLIDESHOW_IMAGES, type ThemeEditingProps } from "./edit-types";
import { useThemePreviewCatalog } from "./useThemePreviewCatalog";

// Shared, theme-agnostic building blocks for the full (phone-frame) storefront
// preview. Every theme's colors/copy/icons are passed in as props — this is
// what makes adding theme #6, #7, etc. later mostly a config exercise instead
// of another few hundred lines of bespoke JSX. Every block also accepts an
// optional `editing` prop (see edit-types.ts) that turns on its edit-mode
// affordances; when omitted, every block renders exactly as it did before
// edit mode existed.

export function PhoneHeader({
  mutedColor,
  brandInitial,
  editing,
}: {
  mutedColor: string;
  /** Placeholder for the seller's uploaded logo — a neutral frosted chip so it
   * reads over any hero photo without us guessing the logo's own background. */
  brandInitial: string;
  editing?: ThemeEditingProps;
}) {
  const logo = editing?.logoImage;

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) editing?.onLogoChange(file);
    e.target.value = "";
  }

  const chip = (
    <div className="relative flex h-8 min-w-8 items-center justify-center rounded-xl border border-white/15 bg-black/25 px-2 backdrop-blur-md">
      {logo ? (
        <img src={logo} alt="" className="h-6 w-6 rounded-md object-cover" />
      ) : (
        <span className="text-[11px] font-bold text-white">{brandInitial}</span>
      )}
      {editing?.isEditing && (
        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-black">
          <Camera size={8} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );

  return (
    <div className="flex items-center justify-between px-4 py-3">
      {editing?.isEditing ? (
        <label className="cursor-pointer">
          {chip}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      ) : (
        chip
      )}
      <div className="flex items-center gap-3" style={{ color: mutedColor }}>
        <ShoppingBag size={15} strokeWidth={1.8} />
        <Share2 size={15} strokeWidth={1.8} />
        <Search size={15} strokeWidth={1.8} />
      </div>
    </div>
  );
}

export function HeroSlideshow({
  images,
  intervalMs = 3200,
  editing,
}: {
  images: string[];
  intervalMs?: number;
  editing?: ThemeEditingProps;
}) {
  const [index, setIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = editing?.isEditing ?? false;

  useEffect(() => {
    if (images.length < 2 || isEditing) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs, isEditing]);

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) editing?.onAddSlideshowImages(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="relative h-48 w-full overflow-hidden">
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{
          width: `${images.length * 100}%`,
          transform: `translateX(-${index * (100 / images.length)}%)`,
        }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="h-full w-full shrink-0 object-cover object-top"
            style={{ width: `${100 / images.length}%` }}
          />
        ))}
      </div>

      {!isEditing && images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
          {images.map((_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-all"
              style={{
                width: i === index ? 12 : 4,
                background: i === index ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </div>
      )}

      {isEditing && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 overflow-x-auto bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
          {images.map((src, i) => (
            <div key={i} className="relative shrink-0">
              <img
                src={src}
                alt=""
                className="h-10 w-10 rounded-md border border-white/30 object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => editing?.onRemoveSlideshowImage(i)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white"
              >
                <X size={9} />
              </button>
            </div>
          ))}
          {images.length < MAX_SLIDESHOW_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-white/40 text-white/70"
            >
              <Plus size={14} />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
        </div>
      )}
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
  editing,
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
  editing?: ThemeEditingProps;
}) {
  return (
    <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 px-4">
      {editing?.isEditing && (
        <button
          type="button"
          aria-label="Remove this block"
          onClick={() => editing.onRemoveBlock("stats")}
          className="absolute right-2 top-0 rounded-full p-1 opacity-60 hover:opacity-100"
          style={{ color: textColor }}
        >
          <X size={12} />
        </button>
      )}
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
        <EditableText
          as="p"
          isEditing={editing?.isEditing ?? false}
          value={followersText}
          onChange={(v) => editing?.onTextChange("statsFollowersText", v)}
          className="max-w-[120px] text-[9px] leading-tight"
          style={{ color: mutedColor }}
        />
      </div>
      <div
        className="flex items-center gap-1 rounded-full px-2.5 py-1.5"
        style={{ background: chipBg }}
      >
        <Star size={10} fill={accent} style={{ color: accent }} />
        <EditableText
          as="span"
          isEditing={editing?.isEditing ?? false}
          value={badgeLabel}
          onChange={(v) => editing?.onTextChange("statsBadgeLabel", v)}
          className="text-[8.5px] font-semibold whitespace-nowrap"
          style={{ color: textColor }}
        />
        <span className="text-[8.5px] font-semibold whitespace-nowrap" style={{ color: textColor }}>
          · {rating} ({reviews})
        </span>
      </div>
    </div>
  );
}

export function CollectionsGrid({
  fallbackItems,
  textColor,
  mutedColor,
  tileBg,
  accent,
  editing,
}: {
  fallbackItems: { icon: ReactNode; label: string; count: number }[];
  textColor: string;
  mutedColor: string;
  tileBg: string;
  accent: string;
  editing?: ThemeEditingProps;
}) {
  const mode = editing?.collectionsMode ?? "collections";
  const { tiles } = useThemePreviewCatalog(mode);
  const useReal = tiles.length > 0;
  const heading = mode === "products" ? "Products" : "Collections";

  function handleTileTap() {
    if (editing?.isEditing) editing.onTileTapBlocked();
  }

  return (
    <div className="mt-5 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold" style={{ color: textColor }}>
            {heading}
          </span>
          {editing?.isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  style={{ color: textColor }}
                  className="opacity-70 hover:opacity-100"
                >
                  <ChevronDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[9rem] border-white/10 bg-neutral-900 text-white"
              >
                <DropdownMenuItem onClick={() => editing.onCollectionsModeChange("collections")}>
                  Collections
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editing.onCollectionsModeChange("products")}>
                  Products
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <span
          className="flex items-center gap-0.5 text-[9px] font-medium"
          style={{ color: accent }}
        >
          View all <ChevronRight size={11} />
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {useReal
          ? tiles.map((tile) => (
              <button
                type="button"
                key={tile.id}
                onClick={handleTileTap}
                className="rounded-xl p-2.5 text-left"
                style={{ background: tileBg }}
              >
                <div
                  className="mb-2 flex h-14 items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: `${accent}22` }}
                >
                  {tile.image_url ? (
                    <img src={tile.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span style={{ color: accent }}>
                      <ShoppingBag size={18} />
                    </span>
                  )}
                </div>
                <p className="truncate text-[10px] font-medium" style={{ color: textColor }}>
                  {tile.title}
                </p>
                {mode === "products" && tile.price != null && (
                  <p className="text-[8px]" style={{ color: mutedColor }}>
                    ₦{tile.price.toLocaleString()}
                  </p>
                )}
              </button>
            ))
          : fallbackItems.map((it, i) => (
              <button
                type="button"
                key={i}
                onClick={handleTileTap}
                className="rounded-xl p-2.5 text-left"
                style={{ background: tileBg }}
              >
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
              </button>
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
  editing,
}: {
  eyebrow: string;
  title: string;
  cta?: string;
  countdown?: string;
  accent: string;
  accentTextColor?: string;
  cardBg: string;
  textColor: string;
  editing?: ThemeEditingProps;
}) {
  return (
    <div
      className="relative mx-4 mt-5 rounded-2xl p-3.5"
      style={{ background: cardBg, border: `1px solid ${accent}55` }}
    >
      {editing?.isEditing && (
        <button
          type="button"
          aria-label="Remove this block"
          onClick={() => editing.onRemoveBlock("promo")}
          className="absolute right-1.5 top-1.5 rounded-full p-1 opacity-60 hover:opacity-100"
          style={{ color: textColor }}
        >
          <X size={12} />
        </button>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EditableText
            as="p"
            isEditing={editing?.isEditing ?? false}
            value={eyebrow}
            onChange={(v) => editing?.onTextChange("promoEyebrow", v)}
            className="text-[8px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: accent }}
          />
          <EditableText
            as="p"
            isEditing={editing?.isEditing ?? false}
            value={title}
            multiline
            onChange={(v) => editing?.onTextChange("promoTitle", v)}
            className="mt-1 text-[11.5px] font-semibold leading-tight"
            style={{ color: textColor }}
          />
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
  editing,
}: {
  label: string;
  sub: string;
  clusterColors: string[];
  cardBg: string;
  textColor: string;
  mutedColor: string;
  accent: string;
  editing?: ThemeEditingProps;
}) {
  return (
    <div
      className="relative mx-4 my-5 flex items-center justify-between rounded-xl px-3.5 py-3"
      style={{ background: cardBg }}
    >
      {editing?.isEditing && (
        <button
          type="button"
          aria-label="Remove this block"
          onClick={() => editing.onRemoveBlock("footer")}
          className="absolute right-1.5 top-1.5 rounded-full p-1 opacity-60 hover:opacity-100"
          style={{ color: textColor }}
        >
          <X size={12} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <EditableText
          as="p"
          isEditing={editing?.isEditing ?? false}
          value={label}
          onChange={(v) => editing?.onTextChange("footerLabel", v)}
          className="text-[10px] font-semibold"
          style={{ color: textColor }}
        />
        <EditableText
          as="p"
          isEditing={editing?.isEditing ?? false}
          value={sub}
          onChange={(v) => editing?.onTextChange("footerSub", v)}
          className="text-[9px] truncate"
          style={{ color: mutedColor }}
        />
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
