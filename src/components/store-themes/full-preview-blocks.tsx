import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  Camera,
  ChevronRight,
  GripHorizontal,
  Image as ImageIcon,
  Minus,
  Move,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Type as TypeIcon,
} from "lucide-react";
import productPlaceholder from "@/assets/Store theme placeholder images/Products and collection image placeholder.jpg";
import { ThemeText } from "./EditableText";
import { MAX_SLIDESHOW_IMAGES, type CropPosition, type ThemeEditingProps } from "./edit-types";
import { useThemePreviewCatalog } from "./useThemePreviewCatalog";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// Drag-to-reposition image, used anywhere a fixed-aspect container crops a
// seller's photo (slideshow slide, collection/product tile). Not editable:
// a plain <img> with the stored (or centered) object-position. Editable: a
// small handle (bottom-right) is the only draggable surface — NOT the whole
// photo. touch-action:none has to live somewhere to stop a touch drag from
// also panning the page, and if it covered the full image (most of the
// screen on a phone) it would swallow every scroll gesture starting there
// too, not just drag gestures — that's what made every edit sheet except
// the shortest one feel unscrollable. Confined to the handle, the photo
// itself is normal scrollable content; only that one small grab point
// opts out. Repositioning only commits — one history entry, not one per
// pointermove — on release, and a real drag suppresses the click that
// would otherwise reach the tile's own onClick underneath.
function CroppableImage({
  src,
  alt = "",
  position,
  onPositionChange,
  editable,
  onLoad,
}: {
  src: string;
  alt?: string;
  position?: CropPosition;
  onPositionChange?: (position: CropPosition) => void;
  editable?: boolean;
  onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void;
}) {
  const savedPos = position ?? { x: 50, y: 50 };
  const [livePos, setLivePos] = useState(savedPos);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origin: CropPosition;
    current: CropPosition;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!dragRef.current) setLivePos(savedPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPos.x, savedPos.y]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !onPositionChange) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origin: livePos,
      current: livePos,
      moved: false,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    // Dragging right should reveal more of the image's left edge, so the
    // focal point moves opposite the drag direction.
    const next = {
      x: clamp(drag.origin.x - (dx / rect.width) * 100, 0, 100),
      y: clamp(drag.origin.y - (dy / rect.height) * 100, 0, 100),
    };
    // Committed from this ref, not the `livePos` state, below — pointerup can
    // land in the same batched update flush as the preceding pointermove(s),
    // in which case a state read there would still see the pre-drag value.
    drag.current = next;
    setLivePos(next);
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) {
      suppressClickRef.current = true;
      onPositionChange?.(drag.current);
    }
  }

  function handleHandleClick(e: ReactMouseEvent) {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={onLoad}
        className="h-full w-full object-cover"
        style={{ objectPosition: `${livePos.x}% ${livePos.y}%` }}
      />
      {editable && onPositionChange && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleHandleClick}
          style={{ touchAction: "none" }}
          className="absolute bottom-0.5 right-0.5 flex h-7 w-7 cursor-move items-center justify-center rounded-full bg-black/50 text-white/80 active:bg-black/70"
        >
          <Move size={12} />
        </div>
      )}
    </div>
  );
}

// Shared, theme-agnostic building blocks for the full (phone-frame) storefront
// preview. Every theme's colors/copy/icons are passed in as props — this is
// what makes adding theme #6, #7, etc. later mostly a config exercise instead
// of another few hundred lines of bespoke JSX. Every block also accepts an
// optional `editing` prop (see edit-types.ts) that turns on its edit-mode
// affordances; when omitted, every block renders exactly as it did before
// edit mode existed.

function LogoModeSwitch({
  mode,
  onChange,
}: {
  mode: "image" | "text";
  onChange: (mode: "image" | "text") => void;
}) {
  const opt = (id: "image" | "text", Icon: typeof ImageIcon) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChange(id)}
      className="flex h-7 w-7 items-center justify-center rounded-full"
      style={{
        background: mode === id ? "rgba(255,255,255,0.25)" : "transparent",
        color: mode === id ? "#fff" : "rgba(255,255,255,0.5)",
      }}
    >
      <Icon size={14} />
    </button>
  );
  return (
    <div className="mt-3 flex items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur-md">
      {opt("image", ImageIcon)}
      {opt("text", TypeIcon)}
    </div>
  );
}

export function PhoneHeader({
  mutedColor,
  brandInitial,
  defaultLogoText,
  editing,
}: {
  mutedColor: string;
  /** Placeholder for the seller's uploaded logo — a neutral frosted chip so it
   * reads over any hero photo without us guessing the logo's own background. */
  brandInitial: string;
  /** Full brand name used when the seller picks a text logo instead of an image. */
  defaultLogoText: string;
  editing?: ThemeEditingProps;
}) {
  const logo = editing?.logoImage;
  const logoMode = editing?.logoMode ?? "image";

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) editing?.onLogoChange(file);
    e.target.value = "";
  }

  // Grows with the text (no fixed max-width) so a short brand name doesn't
  // sit in an oversized box and a long one isn't clipped sooner than it has
  // to be — the header row's own layout (flex-1 + min-w-0 on this side,
  // shrink-0 on the icon row) is what stops it from reaching the icons,
  // truncating with an ellipsis if it still would.
  const textLogo = (
    <div className="flex h-10 max-w-full items-center rounded-xl border border-white/15 bg-black/25 px-3 backdrop-blur-md">
      <ThemeText
        editing={editing}
        field="logoText"
        defaultValue={defaultLogoText}
        as="span"
        className="truncate text-[13px] font-bold text-white"
      />
    </div>
  );

  const imageChip = (
    <div className="relative flex h-10 min-w-10 items-center justify-center rounded-xl border border-white/15 bg-black/25 px-3 backdrop-blur-md">
      {logo ? (
        <img src={logo} alt="" className="h-7 w-7 rounded-md object-cover" />
      ) : (
        <span className="text-[13px] font-bold text-white">{brandInitial}</span>
      )}
      {editing?.isEditing && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
          <Camera size={9} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        {logoMode === "text" ? (
          textLogo
        ) : editing?.isEditing ? (
          <label className="cursor-pointer">
            {imageChip}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          imageChip
        )}
        {editing?.isEditing && (
          <LogoModeSwitch mode={logoMode} onChange={(m) => editing.onLogoModeChange(m)} />
        )}
      </div>
      <div className="flex shrink-0 items-center gap-5 pt-1.5" style={{ color: mutedColor }}>
        <Search size={18} strokeWidth={1.8} />
        <ShoppingBag size={18} strokeWidth={1.8} />
        <Share2 size={18} strokeWidth={1.8} />
      </div>
    </div>
  );
}

// Tall portrait default (4:5) used only until a slide's real dimensions are
// known — sellers' storefront photos read as tall/editorial far more often
// than wide, and this avoids an initial-load flash of a squat box.
const DEFAULT_ASPECT_RATIO = 4 / 5;

// How far the resize handle can push the crop frame: from a tall 1:2 banner
// down to a short, almost-landscape 1.91:1 one. Wide enough for real
// creative range, tight enough that the frame can't collapse to a sliver.
const MIN_SLIDESHOW_ASPECT = 0.5;
const MAX_SLIDESHOW_ASPECT = 1.91;

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
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [liveAspectRatio, setLiveAspectRatio] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);
  const resizeDragRef = useRef<{
    startY: number;
    startHeight: number;
    width: number;
    current: number;
    moved: boolean;
  } | null>(null);
  const isEditing = editing?.isEditing ?? false;

  useEffect(() => {
    if (images.length < 2 || isEditing) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs, isEditing]);

  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) editing?.onAddSlideshowImages(e.target.files);
    e.target.value = "";
  }

  function handleLoad(src: string, e: SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    setRatios((r) => (r[src] ? r : { ...r, [src]: img.naturalWidth / img.naturalHeight }));
  }

  if (images.length === 0) {
    if (!isEditing) return null;
    return (
      <div className="mx-4 mt-3">
        <label className="flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/30 px-6 text-center text-white/60">
          <Plus size={18} />
          <span className="text-[11px] font-medium leading-snug">
            Add photos of your models wearing your best pieces
          </span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        </label>
      </div>
    );
  }

  // Auto-sized to the ACTIVE slide's own aspect ratio (zero cropping) until
  // the seller drags the resize handle below the frame — once they do, every
  // slide shares that one fixed frame instead of each reflowing to its own
  // shape, same as any real crop tool.
  const baseAspectRatio =
    editing?.slideshowAspectRatio ?? ratios[images[index]] ?? DEFAULT_ASPECT_RATIO;
  const activeRatio = liveAspectRatio ?? baseAspectRatio;

  // Drag the handle below the frame to resize it, Instagram-crop-style — the
  // frame's own ratio changes (not the photo), so this stacks with per-slide
  // repositioning: resize picks how much shows, drag-on-photo picks which
  // part. Live-updates for a smooth drag, commits once on release so undo
  // gets one history entry per resize, not one per pointermove.
  function handleResizeStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isEditing || !editing?.onSlideshowAspectRatioChange) return;
    e.stopPropagation();
    const rect = cropBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeDragRef.current = {
      startY: e.clientY,
      startHeight: rect.height,
      width: rect.width,
      current: baseAspectRatio,
      moved: false,
    };
    setLiveAspectRatio(baseAspectRatio);
  }

  function handleResizeMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = resizeDragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 3) drag.moved = true;
    const newHeight = Math.max(40, drag.startHeight + dy);
    const next = clamp(drag.width / newHeight, MIN_SLIDESHOW_ASPECT, MAX_SLIDESHOW_ASPECT);
    // Committed from this ref, not the `liveAspectRatio` state, below — see
    // the matching comment in CroppableImage's handlePointerMove.
    drag.current = next;
    setLiveAspectRatio(next);
  }

  function handleResizeEnd() {
    const drag = resizeDragRef.current;
    if (drag?.moved) {
      editing?.onSlideshowAspectRatioChange(drag.current);
    }
    resizeDragRef.current = null;
    setLiveAspectRatio(null);
  }

  return (
    <div className="relative w-full">
      <div
        ref={cropBoxRef}
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: activeRatio }}
      >
        <div
          className="flex h-full transition-transform duration-700 ease-out"
          style={{
            width: `${images.length * 100}%`,
            transform: `translateX(-${index * (100 / images.length)}%)`,
          }}
        >
          {images.map((src) => (
            <div key={src} className="h-full shrink-0" style={{ width: `${100 / images.length}%` }}>
              <CroppableImage
                src={src}
                editable={isEditing}
                position={editing?.slideshowCrops[src]}
                onPositionChange={(pos) => editing?.onSlideshowCropChange(src, pos)}
                onLoad={(e) => handleLoad(src, e)}
              />
            </div>
          ))}
        </div>

        {isEditing && (
          <button
            type="button"
            aria-label="Remove the slideshow"
            onClick={() => editing?.onClearSlideshow()}
            className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white"
          >
            <Minus size={13} />
          </button>
        )}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center [text-shadow:0_2px_10px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-auto w-full">
            <ThemeText
              editing={editing}
              field="overlayLine1"
              placeholder={isEditing ? "Add a headline" : undefined}
              as="p"
              className="text-[26px] font-display uppercase leading-[0.9] text-white"
            />
          </div>
          <div className="pointer-events-auto w-full">
            <ThemeText
              editing={editing}
              field="overlayLine2"
              placeholder={isEditing ? "Add a tagline" : undefined}
              as="p"
              className="text-[11px] font-medium text-white/85"
            />
          </div>
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
              <div key={src} className="relative shrink-0">
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
                  <Minus size={9} />
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

      {isEditing && editing?.onSlideshowAspectRatioChange && (
        <div
          role="slider"
          aria-label="Resize the slideshow frame"
          aria-valuenow={Math.round(activeRatio * 100)}
          aria-valuemin={Math.round(MIN_SLIDESHOW_ASPECT * 100)}
          aria-valuemax={Math.round(MAX_SLIDESHOW_ASPECT * 100)}
          tabIndex={0}
          className="relative z-20 -mt-2.5 flex h-5 cursor-ns-resize touch-none items-center justify-center"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
        >
          <span className="flex h-5 w-9 items-center justify-center rounded-full bg-neutral-900 text-white/80 shadow-lg">
            <GripHorizontal size={13} />
          </span>
        </div>
      )}
    </div>
  );
}

export function StatsRow({
  clusterColors,
  followersText,
  cardBg,
  mutedColor,
  editing,
}: {
  clusterColors: [string, string, string];
  followersText: string;
  cardBg: string;
  mutedColor: string;
  editing?: ThemeEditingProps;
}) {
  return (
    <div className="relative mt-4 flex items-center gap-2 px-4">
      {editing?.isEditing && (
        <button
          type="button"
          aria-label="Remove this block"
          onClick={() => editing.onRemoveBlock("stats")}
          className="absolute right-2 top-0 rounded-full p-1 opacity-60 hover:opacity-100"
          style={{ color: mutedColor }}
        >
          <Minus size={12} />
        </button>
      )}
      <div className="flex -space-x-2">
        {clusterColors.map((c, i) => (
          <div
            key={i}
            className="h-6 w-6 rounded-full border-2"
            style={{ background: c, borderColor: cardBg }}
          />
        ))}
      </div>
      <ThemeText
        editing={editing}
        field="statsFollowersText"
        defaultValue={followersText}
        as="p"
        className="max-w-[200px] text-[9px] leading-tight"
        style={{ color: mutedColor }}
      />
    </div>
  );
}

function CollectionsModeTab({
  label,
  active,
  accent,
  textColor,
  onClick,
}: {
  label: string;
  active: boolean;
  accent: string;
  textColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
      style={{
        background: active ? `${accent}26` : "transparent",
        color: active ? accent : textColor,
        opacity: active ? 1 : 0.55,
      }}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
      {label}
    </button>
  );
}

export function CollectionsGrid({
  fallbackItems,
  fallbackProducts,
  textColor,
  mutedColor,
  tileBg,
  accent,
  editing,
  storeId,
}: {
  fallbackItems: { icon: ReactNode; label: string; count: number }[];
  fallbackProducts: { icon: ReactNode; name: string; price: number }[];
  textColor: string;
  mutedColor: string;
  tileBg: string;
  accent: string;
  editing?: ThemeEditingProps;
  /** Whose catalog to preview — the seller's own store while editing, or the
   * store actually being viewed on a public storefront. Always explicit:
   * see the comment on useThemePreviewCatalog for why. */
  storeId: string | null;
}) {
  const mode = editing?.collectionsMode ?? "collections";
  const { tiles } = useThemePreviewCatalog(mode, storeId);
  const useReal = tiles.length > 0;
  const heading = mode === "products" ? "Products" : "Collections";

  function handleTileTap() {
    if (editing?.isEditing) editing.onTileTapBlocked();
  }

  return (
    <div className="mt-5 px-4">
      <div className="flex items-center justify-between">
        {editing?.isEditing ? (
          <div className="flex items-center gap-1">
            <CollectionsModeTab
              label="Collections"
              active={mode === "collections"}
              accent={accent}
              textColor={textColor}
              onClick={() => editing.onCollectionsModeChange("collections")}
            />
            <CollectionsModeTab
              label="Products"
              active={mode === "products"}
              accent={accent}
              textColor={textColor}
              onClick={() => editing.onCollectionsModeChange("products")}
            />
          </div>
        ) : (
          <span className="text-[11px] font-semibold" style={{ color: textColor }}>
            {heading}
          </span>
        )}
        <span
          className="flex items-center gap-0.5 text-[9px] font-medium"
          style={{ color: accent }}
        >
          View all <ChevronRight size={11} />
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {useReal
          ? tiles.map((tile) => {
              const cropKey = `${mode}:${tile.id}`;
              return (
                <button
                  type="button"
                  key={tile.id}
                  onClick={handleTileTap}
                  className="rounded-xl p-2.5 text-left"
                  style={{ background: tileBg }}
                >
                  <div
                    className="mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg"
                    style={{ background: `${accent}22` }}
                  >
                    <CroppableImage
                      src={tile.image_url ?? productPlaceholder}
                      editable={editing?.isEditing}
                      position={editing?.tileCrops[cropKey]}
                      onPositionChange={(pos) => editing?.onTileCropChange(cropKey, pos)}
                    />
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
              );
            })
          : mode === "products"
            ? fallbackProducts.map((p, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={handleTileTap}
                  className="rounded-xl p-2.5 text-left"
                  style={{ background: tileBg }}
                >
                  <div
                    className="mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg"
                    style={{ background: `${accent}22` }}
                  >
                    <img src={productPlaceholder} alt="" className="h-full w-full object-cover" />
                  </div>
                  <p className="truncate text-[10px] font-medium" style={{ color: textColor }}>
                    {p.name}
                  </p>
                  <p className="text-[8px]" style={{ color: mutedColor }}>
                    ₦{p.price.toLocaleString()}
                  </p>
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
                    className="mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg"
                    style={{ background: `${accent}22` }}
                  >
                    <img src={productPlaceholder} alt="" className="h-full w-full object-cover" />
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
  const [showCountdownHint, setShowCountdownHint] = useState(false);

  function handleCountdownTap() {
    setShowCountdownHint(true);
    setTimeout(() => setShowCountdownHint(false), 2500);
  }

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
          <Minus size={12} />
        </button>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ThemeText
            editing={editing}
            field="promoEyebrow"
            defaultValue={eyebrow}
            as="p"
            className="text-[8px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: accent }}
          />
          <ThemeText
            editing={editing}
            field="promoTitle"
            defaultValue={title}
            multiline
            as="p"
            className="mt-1 text-[11.5px] font-semibold leading-tight"
            style={{ color: textColor }}
          />
        </div>
        {countdown ? (
          <button
            type="button"
            onClick={handleCountdownTap}
            className="shrink-0 text-[11px] font-semibold tabular-nums"
            style={{ color: accent }}
          >
            {countdown}
          </button>
        ) : (
          <span
            className="shrink-0 rounded-full px-2.5 py-1.5 text-[8.5px] font-semibold whitespace-nowrap"
            style={{ background: accent, color: accentTextColor }}
          >
            {cta}
          </span>
        )}
      </div>

      {showCountdownHint && (
        <div className="absolute right-2 top-full z-20 mt-2 w-44 rounded-lg bg-black/90 px-2.5 py-2 text-[10px] leading-4 text-white shadow-lg">
          A live drop timer will be available at full launch.
        </div>
      )}
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
          <Minus size={12} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <ThemeText
          editing={editing}
          field="footerLabel"
          defaultValue={label}
          as="p"
          className="text-[10px] font-semibold"
          style={{ color: textColor }}
        />
        <ThemeText
          editing={editing}
          field="footerSub"
          defaultValue={sub}
          as="p"
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
