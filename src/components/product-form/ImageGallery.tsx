import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Plus, X } from "lucide-react";

/** Shared multi-image picker for both the base product page and a variant's
 *  own images: a big swipeable preview (native scroll-snap, not custom touch
 *  code) synced to a thumbnail strip below it. Every image — including
 *  whichever one is showing big — lives in that strip so it can be removed
 *  with its own X; long-pressing a thumbnail and dragging reorders the set,
 *  and the first image is always the "cover" used elsewhere in the app. A
 *  dashed "+" tile is always the last thumbnail. */
export function ImageGallery({
  images,
  onReorder,
  onRemove,
  onAddTap,
  uploading,
  addButtonRef,
}: {
  images: string[];
  onReorder: (next: string[]) => void;
  onRemove: (url: string) => void;
  onAddTap: () => void;
  uploading?: boolean;
  addButtonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const bigRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedIndex > images.length - 1) {
      const next = Math.max(0, images.length - 1);
      setFocusedIndex(next);
      const el = bigRef.current;
      if (el) requestAnimationFrame(() => el.scrollTo({ left: next * el.clientWidth }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  function focusIndex(i: number) {
    setFocusedIndex(i);
    const el = bigRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  if (images.length === 0) {
    return (
      <div className="w-full flex flex-col items-center">
        {/* The icon square and its "Add images" label are one tap target,
            not two -- they used to be a button followed by a sibling span,
            so tapping the text (not just the icon sitting on top of it) did
            nothing. */}
        <button
          ref={addButtonRef}
          type="button"
          onClick={onAddTap}
          disabled={uploading}
          aria-label="Add images"
          className="flex flex-col items-center gap-2 disabled:opacity-60"
        >
          <span className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
            {uploading ? (
              <Loader2 size={22} className="text-gray-400 animate-spin" />
            ) : (
              <ImageIcon size={28} className="text-gray-300" />
            )}
          </span>
          <span className="text-sm font-medium text-gray-900">Add images</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={bigRef}
        className="w-full aspect-square rounded-xl overflow-x-auto flex snap-x snap-mandatory bg-gray-100"
        style={{ scrollbarWidth: "none" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setFocusedIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((url) => (
          <img
            key={url}
            src={url}
            alt=""
            draggable={false}
            className="w-full aspect-square object-cover shrink-0 snap-center"
          />
        ))}
      </div>

      <ThumbStrip
        images={images}
        onFocus={focusIndex}
        onRemove={onRemove}
        onReorder={onReorder}
        onAddTap={onAddTap}
        uploading={uploading}
        addButtonRef={addButtonRef}
      />

      {images.length > 1 && (
        <p className="text-xs text-gray-400 mt-1.5">Long-press and drag a photo to reorder</p>
      )}
    </div>
  );
}

function ThumbStrip({
  images,
  onFocus,
  onRemove,
  onReorder,
  onAddTap,
  uploading,
  addButtonRef,
}: {
  images: string[];
  onFocus: (i: number) => void;
  onRemove: (url: string) => void;
  onReorder: (next: string[]) => void;
  onAddTap: () => void;
  uploading?: boolean;
  addButtonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const [dragUrl, setDragUrl] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const callbacks = useRef({ onReorder, onFocus });
  callbacks.current = { onReorder, onFocus };
  const removeListeners = useRef<(() => void) | null>(null);

  // Everything the live drag reads lives in one ref, not state: pointermove
  // fires far faster than React re-renders, and a handler reading `images`
  // or `dragUrl` from a render closure acts on a stale order.
  const drag = useRef<{
    url: string;
    pointerId: number;
    finger: { x: number; y: number };
    // Finger position relative to the tile's top-left when the drag began,
    // so the lifted tile stays under the finger at the same spot.
    grab: { x: number; y: number };
    // Slot geometry frozen at drag start. The target slot is chosen against
    // THESE, never by hit-testing the tiles themselves -- tiles are mid-FLIP
    // after every swap, and the one just swapped away still sits visually
    // under the finger for ~200ms, so hit-testing it swapped straight back:
    // the rapid left-right flicker, and drops that landed on a swap-back.
    slots: DOMRect[];
    active: boolean;
  } | null>(null);

  function positionDragged() {
    const d = drag.current;
    if (!d?.active) return;
    const el = tileRefs.current.get(d.url);
    const slot = d.slots[imagesRef.current.indexOf(d.url)];
    if (!el || !slot) return;
    el.style.transform = `translate(${d.finger.x - d.grab.x - slot.left}px, ${d.finger.y - d.grab.y - slot.top}px)`;
  }

  // FLIP reorder: a swap just teleports these tiles in the DOM, which reads
  // as a jump-cut rather than a drag. Snapshot every tile's position right
  // before the array actually changes, then here -- after React has already
  // repainted them at their new spots -- offset each one back to where it
  // just was and let it transition to zero, turning the teleport into a
  // slide. The dragged tile is skipped: it follows the finger instead.
  useLayoutEffect(() => {
    const dragging = drag.current?.active ? drag.current.url : null;
    tileRefs.current.forEach((el, url) => {
      const prev = prevRects.current.get(url);
      if (!prev || url === dragging) return;
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (dx || dy) {
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 200ms ease-out";
          el.style.transform = "";
          // Otherwise this inline transition sticks around forever, narrowing
          // the Tailwind transition-transform utility (which also covers
          // scale) down to just this one property -- the tap/drag scale on
          // this specific tile would silently stop animating after its first
          // reorder while every other tile's kept working.
          el.addEventListener("transitionend", () => (el.style.transition = ""), { once: true });
        });
      }
    });
    prevRects.current.clear();
    positionDragged();
  }, [images]);

  useEffect(() => () => endGesture(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  function snapshotRects() {
    tileRefs.current.forEach((el, url) => prevRects.current.set(url, el.getBoundingClientRect()));
  }

  function clearTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function nearestSlot(slots: DOMRect[], x: number, y: number) {
    let best = 0;
    let bestDist = Infinity;
    slots.forEach((r, i) => {
      const dist = (r.left + r.width / 2 - x) ** 2 + (r.top + r.height / 2 - y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function onWindowMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      // Moving before the long-press fires means a scroll/swipe, not a drag.
      if (Math.abs(e.clientX - d.finger.x) > 8 || Math.abs(e.clientY - d.finger.y) > 8) {
        endGesture(false);
      }
      return;
    }
    e.preventDefault();
    d.finger = { x: e.clientX, y: e.clientY };
    const current = imagesRef.current;
    const from = current.indexOf(d.url);
    if (from === -1) {
      // Its upload finished mid-drag and swapped the preview URL for the real one.
      endGesture(false);
      return;
    }
    const to = nearestSlot(d.slots, e.clientX, e.clientY);
    if (to !== from) {
      snapshotRects();
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, d.url);
      imagesRef.current = next;
      callbacks.current.onReorder(next);
    }
    positionDragged();
  }

  function onWindowUp(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    endGesture(!d.active);
  }

  function onWindowCancel(e: PointerEvent) {
    if (drag.current && e.pointerId === drag.current.pointerId) endGesture(false);
  }

  function endGesture(wasTap: boolean) {
    clearTimer();
    removeListeners.current?.();
    removeListeners.current = null;
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (wasTap) {
      const i = imagesRef.current.indexOf(d.url);
      if (i !== -1) callbacks.current.onFocus(i);
      return;
    }
    const el = tileRefs.current.get(d.url);
    if (el && d.active) {
      // Settle from wherever the finger let go into the tile's final slot.
      el.style.transition = "transform 180ms ease-out, scale 150ms ease-out";
      el.style.transform = "";
      el.addEventListener("transitionend", () => (el.style.transition = ""), { once: true });
    }
    setDragUrl(null);
  }

  function handlePointerDown(e: React.PointerEvent, url: string) {
    if (drag.current) return;
    const tile = e.currentTarget as HTMLElement;
    const rect = tile.getBoundingClientRect();
    drag.current = {
      url,
      pointerId: e.pointerId,
      finger: { x: e.clientX, y: e.clientY },
      grab: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      slots: [],
      active: false,
    };
    // Window listeners rather than per-tile ones plus pointer capture: the
    // finger crosses other tiles all drag long, and a capture acquired from a
    // delayed timer can silently fail on iOS.
    const move = onWindowMove;
    const up = onWindowUp;
    const cancel = onWindowCancel;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    removeListeners.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    pressTimer.current = setTimeout(() => {
      const d = drag.current;
      if (!d) return;
      d.slots = imagesRef.current.map(
        (u) => tileRefs.current.get(u)?.getBoundingClientRect() ?? new DOMRect(),
      );
      const el = tileRefs.current.get(url);
      if (el) el.style.transition = "scale 150ms ease-out";
      d.active = true;
      setDragUrl(url);
      navigator.vibrate?.(10);
    }, 300);
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {images.map((url, i) => (
        <div
          key={url}
          ref={(el) => {
            if (el) tileRefs.current.set(url, el);
            else tileRefs.current.delete(url);
          }}
          data-gallery-url={url}
          onPointerDown={(e) => handlePointerDown(e, url)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: "none" }}
          className={`relative w-14 h-14 shrink-0 rounded-lg bg-gray-100 overflow-hidden touch-none select-none transition-[scale] duration-150 ${
            // :active has higher specificity than a plain conditional class
            // regardless of source order, so active:scale-90 would win over
            // scale-110 for the entire drag (setPointerCapture keeps :active
            // matched the whole time) -- shrinking the dragged tile instead
            // of lifting it. Only apply the tap-down shrink when NOT dragging.
            dragUrl === url ? "scale-110 shadow-lg z-10 ring-2 ring-black" : "active:scale-90"
          }`}
        >
          <img
            src={url}
            alt=""
            draggable={false}
            className="w-full h-full object-cover pointer-events-none"
          />
          {i === 0 && (
            <span className="absolute bottom-0.5 left-0.5 text-[8px] font-medium text-white bg-black/60 px-1 rounded">
              Cover
            </span>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(url)}
            aria-label="Remove image"
            className="absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-black/60 flex items-center justify-center"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      ))}
      <AddTile ref={addButtonRef} onClick={onAddTap} uploading={uploading} />
    </div>
  );
}

const AddTile = forwardRef<HTMLButtonElement, { onClick: () => void; uploading?: boolean }>(
  function AddTile({ onClick, uploading }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={uploading}
        aria-label="Add more images"
        className="w-14 h-14 shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center disabled:opacity-60"
      >
        {uploading ? (
          <Loader2 size={16} className="text-gray-400 animate-spin" />
        ) : (
          <Plus size={16} className="text-gray-400" />
        )}
      </button>
    );
  },
);
