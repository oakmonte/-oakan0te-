import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
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
  MoreHorizontal,
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
import { useThemePreviewCatalog, type PreviewTile, type TilePhoto } from "./useThemePreviewCatalog";
import { readableTextColor } from "./colors";

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

const MAX_DOTS = 4;

// Liquid glass, rich variant — this pill floats over a photo, which is
// exactly the case that recipe's low-opacity background is for. See the
// liquid-glass skill: the blur/saturate pair and the inset highlight inside
// the box-shadow are fixed, only opacity and shadow flex per surface.
const GLASS: CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  backgroundBlendMode: "screen",
  boxShadow: "0px 8px 40px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.25)",
  border: "1px solid rgba(255,255,255,0.12)",
};

// At most four dots, however many photos there are — the active one simply
// cycles through them (photo 5 lights the first dot again), which is what
// keeps a sixteen-photo strip reading as four dots ticking over instead of a
// row of specks too small to count. Deliberately not a sliding window over
// absolute position: that pins the active dot in place through the whole
// middle of a long strip, so the dots look frozen while the photos move. With
// the strip endless in both directions there is no "how far along am I"
// to encode anyway.
function CarouselDots({ total, index }: { total: number; index: number }) {
  const count = Math.min(total, MAX_DOTS);
  const activeSlot = index % MAX_DOTS;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-2 left-2.5 flex items-center gap-[4px]"
      // A scrim pill behind these would box in the same corner the glass
      // button already occupies; a drop shadow keeps them legible over a pale
      // photo without adding a second surface.
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))" }}
    >
      {Array.from({ length: count }, (_, slot) => (
        // Keyed by slot, so the dots stay the same elements as the active one
        // moves and the opacity transition actually runs.
        <span
          key={slot}
          className="h-[6px] w-[6px] rounded-full bg-white transition-opacity duration-200"
          style={{ opacity: slot === activeSlot ? 1 : 0.45 }}
        />
      ))}
    </div>
  );
}

// One collection/product tile: a swipeable photo strip with its dots and (on
// products) the glass menu button, over a caption carrying the title, price
// and the variant counter. A shopper can look through everything the seller
// uploaded without leaving the storefront page.
//
// The gesture is native CSS scroll-snap on purpose. A JS pointer handler here
// would have to re-derive horizontal-vs-vertical intent for every touch and
// would be competing with the phone frame's own vertical scroll underneath;
// the browser already separates the two axes correctly, gives momentum for
// free, and — the part that matters most — suppresses the click at the end of
// a scrolling touch, so a swipe never also fires the tile's own tap handler.
//
// Each slide carries its own crop position (keyed by url, since a seller can
// reorder photos) rather than one position for the whole tile: photo 2 framed
// by photo 1's focal point is almost always wrong.
function CatalogTile({
  tile,
  mode,
  textColor,
  mutedColor,
  tileBg,
  accent,
  editing,
  onTap,
}: {
  tile: PreviewTile;
  mode: "collections" | "products";
  textColor: string;
  mutedColor: string;
  tileBg: string;
  accent: string;
  editing?: ThemeEditingProps;
  onTap: () => void;
}) {
  const isEditing = editing?.isEditing ?? false;
  // A tile with no photo at all still gets one slide, so the placeholder is
  // framed and croppable exactly like a real photo.
  const photos: TilePhoto[] =
    tile.photos.length > 0 ? tile.photos : [{ url: productPlaceholder, variant: 0 }];
  const total = photos.length;
  const loop = total > 1;

  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Set while we reposition scrollLeft ourselves, so the scroll event that
  // reposition fires is not mistaken for the shopper swiping.
  const jumpingRef = useRef(false);
  const primedRef = useRef(false);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // [last, ...photos, first]. Swiping off either end lands on a slide showing
  // the identical picture, which is then silently re-pointed at the real one
  // once the scroll settles — because a clone and its original are the same
  // image, nothing on screen moves during that reposition, only scrollLeft.
  // That is what makes the strip endless in both directions.
  const slides = loop ? [photos[total - 1], ...photos, photos[0]] : photos;

  // Primed from a callback ref rather than an effect: this runs during commit,
  // before the browser paints, so the tile never flashes the leading clone on
  // its way to the first real photo. (useLayoutEffect would do the same but
  // warns during SSR, and these tiles are server-rendered on a public
  // storefront.)
  function attachScroller(el: HTMLDivElement | null) {
    scrollerRef.current = el;
    if (!el || primedRef.current || !loop) return;
    const w = el.clientWidth;
    if (w === 0) return;
    jumpingRef.current = true;
    el.scrollLeft = w;
    primedRef.current = true;
    requestAnimationFrame(() => {
      jumpingRef.current = false;
    });
  }

  function settleLoop() {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) return;
    const raw = Math.round(el.scrollLeft / w);
    const target = raw === 0 ? total : raw === total + 1 ? 1 : null;
    if (target === null) return;
    jumpingRef.current = true;
    el.scrollLeft = target * w;
    requestAnimationFrame(() => {
      jumpingRef.current = false;
    });
  }

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || jumpingRef.current) return;
    const w = el.clientWidth;
    if (w === 0) return;
    const raw = Math.round(el.scrollLeft / w);
    const real = loop ? (raw - 1 + total) % total : clamp(raw, 0, total - 1);
    // Functional + equality-guarded: onScroll fires on nearly every frame of a
    // swipe, but the slide only actually changes a handful of times.
    setIndex((i) => (i === real ? i : real));
    if (!loop) return;
    // Debounced rather than run per-event: the wrap has to happen after
    // momentum stops, or it would yank the strip mid-flick.
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(settleLoop, 140);
  }

  useEffect(() => {
    return () => {
      if (settleRef.current) clearTimeout(settleRef.current);
    };
  }, []);

  const variantNumber = (photos[index]?.variant ?? 0) + 1;

  return (
    <div className="rounded-xl p-1.5 text-left" style={{ background: tileBg }}>
      <div
        className="relative mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg"
        style={{ background: `${accent}22` }}
      >
        <div
          ref={attachScroller}
          onScroll={handleScroll}
          role="group"
          aria-label={loop ? `${tile.title} — ${total} photos, swipe to see more` : tile.title}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
        >
          {slides.map((photo, i) => (
            <div
              key={i}
              onClick={onTap}
              // snap-always (scroll-snap-stop: always) is what keeps a hard
              // fling to a single photo: without it, momentum travels past
              // several slides before the mandatory snap catches it, so a
              // flick could jump 2-3 photos and skip the variants between
              // them. The browser enforces the one-at-a-time rule natively —
              // no velocity maths, no fighting the scroller.
              className="h-full w-full shrink-0 snap-center snap-always"
              // Clones duplicate a real slide; only the real one should be
              // announced, or a screen reader hears the first and last photo
              // twice.
              aria-hidden={loop && (i === 0 || i === slides.length - 1) ? "true" : undefined}
            >
              <CroppableImage
                src={photo.url}
                editable={isEditing}
                position={editing?.tileCrops[`${mode}:${tile.id}:${photo.url}`]}
                onPositionChange={(pos) =>
                  editing?.onTileCropChange(`${mode}:${tile.id}:${photo.url}`, pos)
                }
              />
            </div>
          ))}
        </div>

        {loop && <CarouselDots total={total} index={index} />}

        {/* Products only, and never in edit mode — the crop handle lives in
            this same corner, and the seller needs that far more than a shopper
            control while they are framing photos. */}
        {mode === "products" && !isEditing && (
          <button
            type="button"
            aria-label={`More about ${tile.title}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2 right-2 flex h-[36px] w-[36px] items-center justify-center rounded-full text-white"
            style={GLASS}
          >
            <MoreHorizontal size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="flex items-end justify-between gap-1.5">
        <button type="button" onClick={onTap} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-medium" style={{ color: textColor }}>
            {tile.title}
          </p>
          {mode === "products" && tile.price != null && (
            <p className="text-[11px]" style={{ color: mutedColor }}>
              ₦{tile.price.toLocaleString()}
            </p>
          )}
        </button>
        {/* Which variant the photo on screen belongs to. Only drawn when there
            is more than one to move between, and coloured from the theme's own
            accent so it belongs to whichever storefront it is sitting in. */}
        {mode === "products" && tile.variantCount > 1 && (
          <span
            aria-label={`Variant ${variantNumber} of ${tile.variantCount}`}
            className="-me-0.5 flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
            style={{ background: accent, color: readableTextColor(accent) }}
          >
            {variantNumber}
          </span>
        )}
      </div>
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
        className="truncate text-[16px] font-bold text-white"
      />
    </div>
  );

  const imageChip = (
    <div className="relative flex h-10 min-w-10 items-center justify-center rounded-xl border border-white/15 bg-black/25 px-3 backdrop-blur-md">
      {logo ? (
        <img src={logo} alt="" className="h-7 w-7 rounded-md object-cover" />
      ) : (
        <span className="text-[16px] font-bold text-white">{brandInitial}</span>
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
      <div className="min-w-0">
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
        <Search size={20} strokeWidth={1.8} />
        <ShoppingBag size={20} strokeWidth={1.8} />
        <Share2 size={20} strokeWidth={1.8} />
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
          <span className="text-[13px] font-medium leading-snug">
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
              className="text-[30px] font-display uppercase leading-[0.9] text-white"
            />
          </div>
          <div className="pointer-events-auto w-full">
            <ThemeText
              editing={editing}
              field="overlayLine2"
              placeholder={isEditing ? "Add a tagline" : undefined}
              as="p"
              className="text-[13px] font-medium text-white/85"
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
            className="h-7 w-7 rounded-full border-2"
            style={{ background: c, borderColor: cardBg }}
          />
        ))}
      </div>
      <ThemeText
        editing={editing}
        field="statsFollowersText"
        defaultValue={followersText}
        as="p"
        className="max-w-[240px] text-[12px] leading-tight"
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
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold"
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
          <span className="text-[15px] font-semibold" style={{ color: textColor }}>
            {heading}
          </span>
        )}
        <span
          className="flex items-center gap-0.5 text-[12px] font-medium"
          style={{ color: accent }}
        >
          View all <ChevronRight size={14} />
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {useReal
          ? tiles.map((tile) => (
              <CatalogTile
                key={tile.id}
                tile={tile}
                mode={mode}
                textColor={textColor}
                mutedColor={mutedColor}
                tileBg={tileBg}
                accent={accent}
                editing={editing}
                onTap={handleTileTap}
              />
            ))
          : mode === "products"
            ? // Demo tiles for a store with nothing listed yet. One photo, so
              // no dots and no variant counter — but the glass button still
              // shows, or a seller evaluating themes before their first
              // upload would be judging a product tile that is missing a
              // piece of its real design.
              fallbackProducts.map((p, i) => (
                <div key={i} className="rounded-xl p-1.5 text-left" style={{ background: tileBg }}>
                  <div
                    className="relative mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg"
                    style={{ background: `${accent}22` }}
                  >
                    <img src={productPlaceholder} alt="" className="h-full w-full object-cover" />
                    {!editing?.isEditing && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-2 right-2 flex h-[36px] w-[36px] items-center justify-center rounded-full text-white"
                        style={GLASS}
                      >
                        <MoreHorizontal size={18} strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={handleTileTap} className="block w-full text-left">
                    <p className="truncate text-[13px] font-medium" style={{ color: textColor }}>
                      {p.name}
                    </p>
                    <p className="text-[11px]" style={{ color: mutedColor }}>
                      ₦{p.price.toLocaleString()}
                    </p>
                  </button>
                </div>
              ))
            : fallbackItems.map((it, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={handleTileTap}
                  className="rounded-xl p-1.5 text-left"
                  style={{ background: tileBg }}
                >
                  <div
                    className="mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg"
                    style={{ background: `${accent}22` }}
                  >
                    <img src={productPlaceholder} alt="" className="h-full w-full object-cover" />
                  </div>
                  <p className="text-[13px] font-medium" style={{ color: textColor }}>
                    {it.label}
                  </p>
                  <p className="text-[11px]" style={{ color: mutedColor }}>
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
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: accent }}
          />
          <ThemeText
            editing={editing}
            field="promoTitle"
            defaultValue={title}
            multiline
            as="p"
            className="mt-1 text-[14px] font-semibold leading-tight"
            style={{ color: textColor }}
          />
        </div>
        {countdown ? (
          <button
            type="button"
            onClick={handleCountdownTap}
            className="shrink-0 text-[13px] font-semibold tabular-nums"
            style={{ color: accent }}
          >
            {countdown}
          </button>
        ) : (
          <span
            className="shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold whitespace-nowrap"
            style={{ background: accent, color: accentTextColor }}
          >
            {cta}
          </span>
        )}
      </div>

      {showCountdownHint && (
        <div className="absolute right-2 top-full z-20 mt-2 w-44 rounded-lg bg-black/90 px-2.5 py-2 text-[12px] leading-5 text-white shadow-lg">
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
          className="text-[13px] font-semibold"
          style={{ color: textColor }}
        />
        <ThemeText
          editing={editing}
          field="footerSub"
          defaultValue={sub}
          as="p"
          className="text-[11px] truncate"
          style={{ color: mutedColor }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex -space-x-1.5">
          {clusterColors.map((c, i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-full border"
              style={{ background: c, borderColor: cardBg }}
            />
          ))}
        </div>
        <ChevronRight size={14} style={{ color: accent }} />
      </div>
    </div>
  );
}
