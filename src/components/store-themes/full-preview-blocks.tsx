import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Camera,
  ChevronRight,
  GripHorizontal,
  Image as ImageIcon,
  LayoutGrid,
  Minus,
  MoreHorizontal,
  Move,
  Plus,
  Rows2,
  Search,
  Share2,
  ShoppingBag,
  Type as TypeIcon,
} from "lucide-react";
import productPlaceholder from "@/assets/Store theme placeholder images/Products and collection image placeholder.jpg";
import { ThemeText } from "./EditableText";
import { MAX_SLIDESHOW_IMAGES, type CropPosition, type ThemeEditingProps } from "./edit-types";
import { formatCommunityCount, useStoreCommunityCounts } from "./useStoreCommunityCounts";
import { useThemePreviewCatalog, type PreviewTile, type TilePhoto } from "./useThemePreviewCatalog";
import { readableTextColor } from "./colors";
import { alpha, isDark } from "./theme-spec";
import { GLASS_RIM, glassClear } from "@/lib/liquid-glass";
import { useStoreLiveDrop } from "@/hooks/use-store-live-drop";
import { dropCountdown, formatCountdown } from "@/lib/drops";
import {
  LAYOUT_PRESETS,
  blocksBelowGrid,
  resolveStickyBottom,
  type ArrangeableBlockId,
} from "./layout-presets";
import { useStoreCatalogReadiness } from "@/hooks/use-store-catalog-readiness";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// A photo bound by a fixed crop frame needs a narrower zoom range than a
// free-floating sticker/text layer (see LayerOverlay.tsx's 0.15-8, for
// content that can be arbitrarily tiny or huge on an open canvas).
const CROP_MIN_SCALE = 0.5;
const CROP_MAX_SCALE = 3;

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
}: {
  src: string;
  alt?: string;
  position?: CropPosition;
  onPositionChange?: (position: CropPosition) => void;
  editable?: boolean;
}) {
  const savedPos = position ?? { x: 50, y: 50 };
  const savedScale = savedPos.scale ?? 1;
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origin: CropPosition;
    current: CropPosition;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  // Live pointers on the image itself (not the reposition handle) — a lone
  // first finger is just recorded here and otherwise ignored, so single-
  // finger taps/swipes (the tile's own onTap, a carousel's snap-scroll) are
  // untouched; only a second finger landing turns this into a pinch. See
  // LayerOverlay.tsx for the same "upgrade on second pointer" shape.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ startDistance: number; startScale: number; current: number } | null>(
    null,
  );

  function pinchDistance(pts: { x: number; y: number }[]) {
    return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !onPositionChange) return;
    e.stopPropagation();
    suppressClickRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origin: savedPos,
      current: savedPos,
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
    // Spread from origin so a zoom set by pinching survives a later drag —
    // building a bare {x, y} here committed scale back to 1 on release.
    const next = {
      ...drag.origin,
      x: clamp(drag.origin.x - (dx / rect.width) * 100, 0, 100),
      y: clamp(drag.origin.y - (dy / rect.height) * 100, 0, 100),
    };
    // Committed from this ref, not from state — pointerup can land in the
    // same batched update flush as the preceding pointermove(s), in which
    // case a state read there would still see the pre-drag value.
    drag.current = next;
    // Written straight to the node rather than through setState. A state
    // update per pointermove re-rendered this image's whole subtree on every
    // frame of the drag, and inside the slideshow that meant every slide and
    // every handle with it — which is what made repositioning feel steppy
    // instead of stuck to the finger. React's own style prop reasserts the
    // same value on the commit below, so the two never disagree.
    if (imgRef.current) imgRef.current.style.objectPosition = `${next.x}% ${next.y}%`;
  }

  function endDrag(commit: boolean) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (commit && drag.moved) {
      suppressClickRef.current = true;
      onPositionChange?.(drag.current);
    } else if (imgRef.current) {
      // Nothing committed, so put the node back where React thinks it is.
      imgRef.current.style.objectPosition = `${savedPos.x}% ${savedPos.y}%`;
    }
  }

  function handleSuppressibleClick(e: ReactMouseEvent) {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  }

  // Pinch-to-zoom, edit mode only — on the image itself, not the reposition
  // handle, since a two-finger gesture never competes with the single-finger
  // taps/swipes the container already needs to keep working.
  function handleContainerPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !onPositionChange) return;
    // A pinch never produces the click a drag does, so a flag it left set
    // would otherwise swallow the seller's next ordinary tap.
    if (pointersRef.current.size === 0) suppressClickRef.current = false;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size !== 2) return;
    // Second finger just landed — anchor the pinch on the current scale so
    // the image doesn't jump at the moment the gesture starts.
    const startDistance = pinchDistance([...pointersRef.current.values()]);
    pinchRef.current = { startDistance, startScale: savedScale, current: savedScale };
  }

  function handleContainerPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pinch = pinchRef.current;
    if (!pinch || pointersRef.current.size !== 2) return;
    const distance = pinchDistance([...pointersRef.current.values()]);
    const nextScale = clamp(
      pinch.startScale * (distance / pinch.startDistance),
      CROP_MIN_SCALE,
      CROP_MAX_SCALE,
    );
    pinch.current = nextScale;
    if (imgRef.current) imgRef.current.style.transform = `scale(${nextScale})`;
  }

  function endPinch(pointerId: number, commit: boolean) {
    pointersRef.current.delete(pointerId);
    const pinch = pinchRef.current;
    if (!pinch || pointersRef.current.size >= 2) return;
    pinchRef.current = null;
    if (commit && pinch.current !== pinch.startScale) {
      suppressClickRef.current = true;
      onPositionChange?.({ ...savedPos, scale: pinch.current });
    } else if (imgRef.current) {
      imgRef.current.style.transform = `scale(${savedScale})`;
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      // pan-x pan-y, from the first touch: one-finger scrolling (the page,
      // a tile's photo strip) still belongs to the browser, but a pinch is
      // left to us. Browsers decide touch-action when a gesture STARTS, so
      // switching it on once the second finger landed was too late — the
      // page zoomed instead and cancelled the gesture.
      style={editable && onPositionChange ? { touchAction: "pan-x pan-y" } : undefined}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={(e) => endPinch(e.pointerId, true)}
      onPointerCancel={(e) => endPinch(e.pointerId, false)}
      onClick={handleSuppressibleClick}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full object-cover"
        style={{
          objectPosition: `${savedPos.x}% ${savedPos.y}%`,
          transform: `scale(${savedScale})`,
        }}
      />
      {editable && onPositionChange && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onClick={handleSuppressibleClick}
          style={{ touchAction: "none" }}
          // before: stretches the grab area to ~48px without making the
          // visible disc any bigger over the seller's photo.
          className="absolute bottom-1 right-1 flex h-9 w-9 cursor-move items-center justify-center rounded-full bg-black/55 text-white before:absolute before:-inset-1.5 before:content-[''] active:bg-black/75"
        >
          <Move size={16} />
        </div>
      )}
    </div>
  );
}

const MAX_DOTS = 4;

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
    <div className="rounded-xl p-1 text-left" style={{ background: tileBg }}>
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
            className={`absolute bottom-2 right-2 flex h-[36px] w-[36px] items-center justify-center rounded-full text-white ${GLASS_RIM}`}
            style={glassClear}
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
            <p className="flex items-baseline gap-1 text-[11px]" style={{ color: mutedColor }}>
              <span>₦{tile.price.toLocaleString()}</span>
              {tile.compareAtPrice != null && tile.compareAtPrice > tile.price && (
                // No extra fade: the strikethrough already says "old price",
                // and opacity on top of the muted colour failed contrast on
                // every theme.
                <span className="text-[10px] line-through">
                  ₦{tile.compareAtPrice.toLocaleString()}
                </span>
              )}
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
      aria-label={id === "image" ? "Image logo" : "Text logo"}
      aria-pressed={mode === id}
      className="flex h-10 w-10 items-center justify-center rounded-full"
      style={{
        background: mode === id ? "rgba(255,255,255,0.25)" : "transparent",
        color: mode === id ? "#fff" : "rgba(255,255,255,0.6)",
      }}
    >
      <Icon size={17} />
    </button>
  );
  return (
    // A dark pill on every theme, light or dark — it's edit chrome, not part
    // of the storefront, so it reads the same wherever it lands.
    <div className="mt-2.5 flex w-fit items-center gap-1 rounded-full bg-neutral-900/85 p-1 backdrop-blur-md">
      {opt("image", ImageIcon)}
      {opt("text", TypeIcon)}
    </div>
  );
}

export function PhoneHeader({
  mutedColor,
  brandInitial,
  defaultLogoText,
  ink,
  editing,
}: {
  mutedColor: string;
  /** Placeholder for the seller's uploaded logo — a neutral frosted chip so it
   * reads over any hero photo without us guessing the logo's own background. */
  brandInitial: string;
  /** Full brand name used when the seller picks a text logo instead of an image. */
  defaultLogoText: string;
  /** The theme's own text colour, as hex. The header sits on the plain page
   * ground above the slideshow, not over a photo — so on a pale theme the
   * white-on-smoke chip came out around 1.9:1. A dark ink means a light
   * ground, and the chip takes the ink instead. Omitted: the dark chip. */
  ink?: string;
  editing?: ThemeEditingProps;
}) {
  const logo = editing?.logoImage;
  const logoMode = editing?.logoMode ?? "image";
  const lightGround = ink != null && isDark(ink);
  const chipStyle: CSSProperties | undefined = lightGround
    ? { background: alpha(ink, 0.06), borderColor: alpha(ink, 0.14), color: ink }
    : undefined;
  const chipClass = lightGround
    ? "border"
    : "border border-white/15 bg-black/25 text-white backdrop-blur-md";

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) editing?.onLogoChange(file);
    e.target.value = "";
  }

  // Shrink-to-fit with a cap, same shape as imageChip's own min-w-10 below —
  // not a stretch-to-fill box. A short brand name doesn't sit in an oversized
  // pill, and a long one truncates with an ellipsis instead of pushing the
  // pill toward the icon row. overflow-hidden is a height ceiling imageChip
  // gets for free from its fixed h-7 w-7 image, which this branch doesn't
  // have on its own — EditableText's edit-mode <input> computes its own
  // height in JS rather than being pinned by a class, so nothing stopped it
  // from rendering taller than this pill.
  const textLogo = (
    <div
      className={`flex h-10 w-fit max-w-[220px] items-center overflow-hidden rounded-xl px-3 ${chipClass}`}
      style={chipStyle}
    >
      <ThemeText
        editing={editing}
        field="logoText"
        defaultValue={defaultLogoText}
        as="span"
        className="truncate text-[16px] font-bold"
      />
    </div>
  );

  const imageChip = (
    <div
      className={`relative flex h-10 min-w-10 items-center justify-center rounded-xl px-3 ${chipClass}`}
      style={chipStyle}
    >
      {logo ? (
        <img src={logo} alt="" className="h-7 w-7 rounded-md object-cover" />
      ) : (
        <span className="text-[16px] font-bold">{brandInitial}</span>
      )}
      {editing?.isEditing && (
        <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow ring-1 ring-black/10">
          <Camera size={11} strokeWidth={2.5} />
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

// The frame every slide crops into until the seller resizes it. Tall
// portrait (4:5) because sellers' storefront photos read as tall/editorial
// far more often than wide.
//
// It is deliberately a CONSTANT and not each slide's own natural ratio. The
// frame used to size itself to whichever photo was showing, so the whole
// storefront grew and shrank as the slideshow advanced and every block below
// the hero shifted with it. A slideshow is one window onto a set of photos,
// not a box that remeasures itself per photo: the frame holds still and the
// photos crop into it (object-cover in CroppableImage), which is also what
// makes per-slide repositioning mean anything.
const DEFAULT_ASPECT_RATIO = 4 / 5;

// How far the resize handle can push the crop frame: from a tall 1:2 banner
// down to a short, almost-landscape 1.91:1 one. Wide enough for real
// creative range, tight enough that the frame can't collapse to a sliver.
const MIN_SLIDESHOW_ASPECT = 0.5;
const MAX_SLIDESHOW_ASPECT = 1.91;

export function HeroSlideshow({
  images,
  intervalMs = 3200,
  ink,
  editing,
}: {
  images: string[];
  intervalMs?: number;
  /** The theme's text colour, for the empty-slideshow placeholder — the one
   * part of this block drawn on the page ground rather than over a photo.
   * White-on-near-white there hid the only way back to adding photos. */
  ink?: string;
  editing?: ThemeEditingProps;
}) {
  const [index, setIndex] = useState(0);
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

  if (images.length === 0) {
    if (!isEditing) return null;
    return (
      <div className="mx-4 mt-3">
        <label
          className="flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 text-center"
          style={{
            color: ink ? alpha(ink, 0.65) : "rgba(255,255,255,0.6)",
            borderColor: ink ? alpha(ink, 0.3) : "rgba(255,255,255,0.3)",
          }}
        >
          <Plus size={22} />
          <span className="text-[13px] font-medium leading-snug">
            Add photos of your models wearing your best pieces
          </span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        </label>
      </div>
    );
  }

  // One frame for every slide, whatever shape the photos are: the seller's
  // own if they have dragged the handle, otherwise the constant above.
  const activeRatio = editing?.slideshowAspectRatio ?? DEFAULT_ASPECT_RATIO;

  // Drag the handle below the frame to resize it, Instagram-crop-style — the
  // frame's own ratio changes (not the photo), so this stacks with per-slide
  // repositioning: resize picks how much shows, drag-on-photo picks which
  // part. Live-updates for a smooth drag, commits once on release so undo
  // gets one history entry per resize, not one per pointermove.
  function handleResizeStart(e: ReactPointerEvent<HTMLElement>) {
    if (!isEditing || !editing?.onSlideshowAspectRatioChange) return;
    e.stopPropagation();
    const rect = cropBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeDragRef.current = {
      startY: e.clientY,
      startHeight: rect.height,
      width: rect.width,
      current: activeRatio,
      moved: false,
    };
  }

  function handleResizeMove(e: ReactPointerEvent<HTMLElement>) {
    const drag = resizeDragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 3) drag.moved = true;
    const newHeight = Math.max(40, drag.startHeight + dy);
    const next = clamp(drag.width / newHeight, MIN_SLIDESHOW_ASPECT, MAX_SLIDESHOW_ASPECT);
    drag.current = next;
    // Same reason as CroppableImage's drag: written to the node directly so a
    // resize is one DOM write per frame instead of a re-render of every slide
    // per frame. The commit on release is the only render.
    if (cropBoxRef.current) cropBoxRef.current.style.aspectRatio = String(next);
  }

  function endResize(commit: boolean) {
    const drag = resizeDragRef.current;
    resizeDragRef.current = null;
    if (!drag) return;
    if (commit && drag.moved) {
      editing?.onSlideshowAspectRatioChange(drag.current);
    } else if (cropBoxRef.current) {
      cropBoxRef.current.style.aspectRatio = String(activeRatio);
    }
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
              />
            </div>
          ))}
        </div>

        {isEditing && (
          <button
            type="button"
            aria-label="Remove the slideshow"
            onClick={() => editing?.onClearSlideshow()}
            className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/85 ring-1 ring-white/15 before:absolute before:-inset-1.5 before:content-[''] hover:bg-black/80 hover:text-white"
          >
            <Minus size={15} strokeWidth={2.5} />
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
          // pointer-events-none on the wrapper, re-enabled on each real
          // target: this strip's own empty gradient background used to sit
          // on top of (and swallow every pointerdown aimed at) the crop
          // handle in the corner below it, since it paints after the slide
          // layer and spans full width right down to the bottom edge. Any
          // new interactive child added to this strip needs its own
          // pointer-events-auto, or it silently receives no clicks/taps.
          // pr-14 reserves space the scrollable thumbnails/add-button can
          // never reach, clear of the handle's own bottom-1 right-1 36px
          // box — without it, scrolling to the last photo (once there are
          // enough to need scrolling) parks a real, pointer-events-auto
          // thumbnail directly on top of the handle again.
          // Thumbnails are 44px and spaced 12px apart so a thumb lands on
          // the one it meant; each remove dot is small to look at but has a
          // ~36px hit area. Tapping a thumbnail shows that slide — autoplay is
          // off in edit mode, so this is the only way to reach slide 2+ to
          // reposition or pinch it.
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 overflow-x-auto bg-gradient-to-t from-black/70 to-transparent pl-3 pr-14 pb-2.5 pt-7">
            {images.map((src, i) => (
              <div key={src} className="pointer-events-auto relative shrink-0">
                <button
                  type="button"
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                  className="block"
                >
                  <img
                    src={src}
                    alt=""
                    className={`h-11 w-11 rounded-lg object-cover transition-shadow ${
                      i === index ? "ring-2 ring-white" : "ring-1 ring-white/30"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => editing?.onRemoveSlideshowImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/85 text-white ring-1 ring-white/25 before:absolute before:-inset-2 before:content-['']"
                >
                  <Minus size={11} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {images.length < MAX_SLIDESHOW_IMAGES && (
              <button
                type="button"
                aria-label="Add photos"
                onClick={() => fileInputRef.current?.click()}
                className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/50 text-white/80"
              >
                <Plus size={18} />
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
          // The row itself lets taps through (pointer-events-none); only the
          // pill grabs. A full-width grab strip overlapping the frame's
          // bottom edge swallowed taps meant for the thumbnails, the "+" and
          // the reposition handle right above it.
          className="pointer-events-none relative z-20 -mt-4 flex h-11 items-center justify-center"
        >
          <span
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={() => endResize(true)}
            onPointerCancel={() => endResize(false)}
            className="pointer-events-auto relative flex h-8 w-16 cursor-ns-resize touch-none items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg ring-1 ring-white/15 before:absolute before:-inset-x-3 before:-bottom-2 before:top-0 before:content-['']"
          >
            <GripHorizontal size={22} />
          </span>
        </div>
      )}
    </div>
  );
}

// The one "remove this block" control, shared by every removable block. It
// was a bare 12px glyph at 60% opacity, tinted from the theme — a ~20px
// target, faint on half the palettes, and sitting on top of the block's own
// content (the stats text field, the footer's chevron). Now: a solid dark
// disc on the block's corner, the same language as the remove dots on text
// and photos, 28px to see and ~44px to hit.
function BlockRemoveButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Remove this block"
      onClick={onClick}
      className={`absolute z-10 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900/85 text-white shadow ring-1 ring-white/20 before:absolute before:-inset-2 before:content-[''] ${className}`}
    >
      <Minus size={14} strokeWidth={2.5} />
    </button>
  );
}

// The number is the store's real follower count and is NOT editable — a
// hardcoded "2.7K+" on a store with no followers is a fabricated credential,
// the same objection that took the star rating out of this block. The words
// around it stay the seller's, and stay per-theme: one storefront says
// "followers love this store", another "in the atelier".
export function StatsRow({
  clusterColors,
  followersLabel,
  cardBg,
  mutedColor,
  storeId,
  editing,
}: {
  clusterColors: [string, string, string];
  /** Wording only, no number — see the note above. */
  followersLabel: string;
  cardBg: string;
  mutedColor: string;
  storeId: string | null;
  editing?: ThemeEditingProps;
}) {
  const { followers } = useStoreCommunityCounts(storeId);
  return (
    // pr-14 in edit mode keeps the text field clear of the remove button.
    <div
      className={`relative mt-4 flex items-center gap-2 px-4 ${editing?.isEditing ? "pr-14" : ""}`}
    >
      {editing?.isEditing && (
        <BlockRemoveButton
          onClick={() => editing.onRemoveBlock("stats")}
          className="right-4 top-1/2 -translate-y-1/2"
        />
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
      {/* A div, not a p: in edit mode ThemeText renders an input plus the
          fixed-position font picker, and a div inside a p is invalid. */}
      <div
        className="flex min-w-0 max-w-[260px] items-baseline gap-1 text-[12px] leading-tight"
        style={{ color: mutedColor }}
      >
        <span className="shrink-0 font-semibold tabular-nums">
          {formatCommunityCount(followers)}
        </span>
        <ThemeText
          editing={editing}
          field="statsFollowersText"
          defaultValue={followersLabel}
          as="span"
          className="min-w-0 text-[12px] leading-tight"
          style={{ color: mutedColor }}
        />
      </div>
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
      // 40px tall to match the columns toggle beside it — at py-1.5 these
      // were ~27px, the smallest targets in the whole editor.
      className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
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

// Fixed pixel sizing rather than percentages -- with exactly two segments the
// sliding-highlight math (transitions-dev's "tabs sliding" pattern) is exact
// and doesn't fight the container's own padding/gap.
const COLUMNS_TOGGLE_SEGMENT = 40;
const COLUMNS_TOGGLE_GAP = 4;

function ColumnsToggle({
  columns,
  accent,
  textColor,
  onChange,
}: {
  columns: 1 | 2;
  accent: string;
  textColor: string;
  onChange: (columns: 1 | 2) => void;
}) {
  const options: { value: 1 | 2; label: string; icon: typeof LayoutGrid }[] = [
    { value: 2, label: "Two per row", icon: LayoutGrid },
    { value: 1, label: "One per row", icon: Rows2 },
  ];
  const activeIndex = columns === 2 ? 0 : 1;

  return (
    <div
      className="relative inline-flex items-center gap-1 rounded-full p-1"
      style={{ background: `${textColor}14` }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 left-1 rounded-full transition-transform duration-200 ease-out"
        style={{
          width: COLUMNS_TOGGLE_SEGMENT,
          height: COLUMNS_TOGGLE_SEGMENT,
          background: `${accent}26`,
          transform: `translateX(${activeIndex * (COLUMNS_TOGGLE_SEGMENT + COLUMNS_TOGGLE_GAP)}px)`,
        }}
      />
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-label={label}
          aria-pressed={columns === value}
          className="relative z-10 flex items-center justify-center rounded-full"
          style={{
            width: COLUMNS_TOGGLE_SEGMENT,
            height: COLUMNS_TOGGLE_SEGMENT,
            color: columns === value ? accent : textColor,
            opacity: columns === value ? 1 : 0.55,
          }}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
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
  const columns = editing?.columns ?? 2;

  function handleTileTap() {
    if (editing?.isEditing) editing.onTileTapBlocked();
  }

  return (
    <div className="mt-5 px-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        {editing?.isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
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
            <ColumnsToggle
              columns={columns}
              accent={accent}
              textColor={textColor}
              onChange={editing.onColumnsChange}
            />
          </div>
        ) : (
          <span className="text-[15px] font-semibold" style={{ color: textColor }}>
            {heading}
          </span>
        )}
        {/* Not in edit mode: the tabs and toggle already fill a 360-390px
            row, and "View all" wrapped onto a stray line of its own. */}
        {!editing?.isEditing && (
          <span
            className="flex items-center gap-0.5 text-[12px] font-medium"
            style={{ color: accent }}
          >
            View all <ChevronRight size={14} />
          </span>
        )}
      </div>
      <div className={`mt-2.5 grid gap-1.5 ${columns === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
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
                <div key={i} className="rounded-xl p-1 text-left" style={{ background: tileBg }}>
                  <div
                    className="relative mb-2 aspect-[4/5] w-full overflow-hidden rounded-lg"
                    style={{ background: `${accent}22` }}
                  >
                    <img src={productPlaceholder} alt="" className="h-full w-full object-cover" />
                    {!editing?.isEditing && (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-2 right-2 flex h-[36px] w-[36px] items-center justify-center rounded-full text-white ${GLASS_RIM}`}
                        style={glassClear}
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
                  className="rounded-xl p-1 text-left"
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

// The DROP banner. It renders only while the store has a real drop that
// hasn't ended (useStoreLiveDrop). With no drop there is no banner at all,
// in the editor as well as on the storefront, because an announcement of
// nothing is exactly the empty element this block used to be. The title is
// the drop's own, set where the seller creates the drop (/store/drops). The
// eyebrow stays the theme's editable copy, and the countdown is real,
// counting to the start and then to the end.
export function PromoBanner({
  storeId,
  eyebrow,
  cta,
  accent,
  accentTextColor,
  cardBg,
  textColor,
  editing,
}: {
  storeId: string | null;
  eyebrow: string;
  cta?: string;
  accent: string;
  /** Defaults to whichever of black/white actually reads on `accent` — a
   * fixed #0a0a0a default put black text on Monochrome's #111 button. */
  accentTextColor?: string;
  cardBg: string;
  textColor: string;
  editing?: ThemeEditingProps;
}) {
  const drop = useStoreLiveDrop(storeId);
  const ctaText = accentTextColor ?? readableTextColor(accent);
  const [now, setNow] = useState(() => new Date());
  const countdown = drop ? dropCountdown(drop, now) : null;
  const ticking = countdown !== null;

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  if (!drop) return null;

  return (
    <div
      className="relative mx-4 mt-5 rounded-2xl p-3.5"
      style={{ background: cardBg, border: `1px solid ${accent}55` }}
    >
      {editing?.isEditing && (
        <BlockRemoveButton
          onClick={() => editing.onRemoveBlock("promo")}
          className="-right-2 -top-2.5"
        />
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
          <p className="mt-1 text-[14px] font-semibold leading-tight" style={{ color: textColor }}>
            {drop.title}
          </p>
        </div>
        {countdown ? (
          <div className="shrink-0 text-right" style={{ color: accent }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
              {countdown.label}
            </p>
            <p className="text-[13px] font-semibold tabular-nums">
              {formatCountdown(countdown.msLeft)}
            </p>
          </div>
        ) : (
          <span
            className="shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold whitespace-nowrap"
            style={{ background: accent, color: ctaText }}
          >
            {cta ?? "Shop now"}
          </span>
        )}
      </div>
    </div>
  );
}

// Second half of the same rule as StatsRow: the block's title is the
// seller's to word (every theme names its community differently — "Community
// fits", "From the atelier"), but the line under it is now a real count of
// people wearing this store's pieces, not a hardcoded "142 people wearing it
// today" or a placeholder note about fabric.
export function FooterTeaser({
  label,
  clusterColors,
  cardBg,
  textColor,
  mutedColor,
  accent,
  storeId,
  editing,
}: {
  label: string;
  clusterColors: string[];
  cardBg: string;
  textColor: string;
  mutedColor: string;
  accent: string;
  storeId: string | null;
  editing?: ThemeEditingProps;
}) {
  const { wearing } = useStoreCommunityCounts(storeId);
  return (
    <div
      className="relative mx-4 my-5 flex items-center justify-between rounded-xl px-3.5 py-3"
      style={{ background: cardBg }}
    >
      {editing?.isEditing && (
        <BlockRemoveButton
          onClick={() => editing.onRemoveBlock("footer")}
          className="-right-2 -top-2.5"
        />
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
        <p className="truncate text-[11px]" style={{ color: mutedColor }}>
          <span className="font-semibold tabular-nums">{formatCommunityCount(wearing)}</span>{" "}
          wearing it
        </p>
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

/** The four arrangeable blocks in the active layout's order. Shared by the
 *  hand-written themes and ThemeSpecFull, so all 50 behave the same.
 *
 *  With stickyBottom on, the blocks that sit below the grid (blocksBelowGrid)
 *  go into one `position: sticky; bottom: 0` strip, so they stay on screen
 *  while the grid scrolls under them. A big catalogue then doesn't bury them
 *  at the very end, and a small store that leaves it off isn't forced into
 *  it. The strip takes the theme's own background, and nothing else: no
 *  fade or shadow above it (a dark fade read as a smear over the grid).
 *  Whether it's on is resolveStickyBottom: the seller's choice, or more than
 *  12 items when they haven't chosen. It pins against the
 *  nearest scroll container: the storefront sheet on a profile, or the
 *  phone frame in the editor. Nothing between the strip and that container
 *  may be overflow:hidden/auto, or it stops sticking (that is why the
 *  sideways-drag guard uses overflow-x: clip, which is not a scroll
 *  container). */
export function LayoutBlocks({
  editing,
  blocks,
  storeId,
  bg,
}: {
  editing: ThemeEditingProps | undefined;
  blocks: Partial<Record<ArrangeableBlockId, ReactNode>>;
  storeId: string | null;
  bg: string;
}) {
  const drop = useStoreLiveDrop(storeId);
  const layoutId = editing?.layoutId ?? "hero-led";
  const order = LAYOUT_PRESETS.find((p) => p.id === layoutId)?.order ?? LAYOUT_PRESETS[0].order;
  const render = (ids: ArrangeableBlockId[]) =>
    ids.map((id) => <Fragment key={id}>{blocks[id]}</Fragment>);

  const catalog = useStoreCatalogReadiness(storeId);
  const itemCount =
    (editing?.collectionsMode ?? "collections") === "products"
      ? catalog.productCount
      : catalog.collectionCount;
  const sticky = resolveStickyBottom(editing?.stickyBottom ?? null, itemCount);

  const below = blocksBelowGrid(layoutId, editing?.hiddenBlocks ?? [], drop !== null);
  if (!sticky || below.length === 0) return <>{render(order)}</>;

  const above = order.filter((id) => !below.includes(id));
  return (
    <>
      {render(above)}
      <div
        // -1px, with the padding grown by the same pixel: iOS lands a sticky
        // box on fractional pixels, and flush at bottom:0 it left a hairline
        // of the grid showing between the strip and the screen edge.
        className="sticky -bottom-px z-20 pb-[calc(max(env(safe-area-inset-bottom),0.75rem)+1px)]"
        style={{ background: bg }}
      >
        {render(below)}
      </div>
    </>
  );
}
