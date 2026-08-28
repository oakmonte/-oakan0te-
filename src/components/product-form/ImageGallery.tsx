import { forwardRef, useEffect, useRef, useState } from "react";
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
      <div className="w-full flex flex-col items-center gap-2">
        <button
          ref={addButtonRef}
          type="button"
          onClick={onAddTap}
          disabled={uploading}
          aria-label="Add images"
          className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 size={22} className="text-gray-400 animate-spin" />
          ) : (
            <ImageIcon size={28} className="text-gray-300" />
          )}
        </button>
        <span className="text-sm font-medium text-gray-900">Add images</span>
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
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  function clearTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent, url: string) {
    startPos.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    const pointerId = e.pointerId;
    const target = e.currentTarget as HTMLElement;
    clearTimer();
    pressTimer.current = setTimeout(() => {
      setDragUrl(url);
      target.setPointerCapture(pointerId);
    }, 300);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startPos.current && !dragUrl) {
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > 8 || dy > 8) {
        moved.current = true;
        clearTimer();
      }
      return;
    }
    if (!dragUrl) return;
    const hit = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((n): n is HTMLElement => n instanceof HTMLElement && !!n.dataset.galleryUrl);
    const overUrl = hit?.dataset.galleryUrl;
    if (!overUrl || overUrl === dragUrl) return;
    const from = images.indexOf(dragUrl);
    const to = images.indexOf(overUrl);
    if (from === -1 || to === -1) return;
    const next = [...images];
    next.splice(from, 1);
    next.splice(to, 0, dragUrl);
    onReorder(next);
  }

  function handlePointerUp(url: string) {
    clearTimer();
    if (!dragUrl && !moved.current) onFocus(images.indexOf(url));
    setDragUrl(null);
    startPos.current = null;
  }

  function handlePointerCancel() {
    clearTimer();
    setDragUrl(null);
    startPos.current = null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {images.map((url, i) => (
        <div
          key={url}
          data-gallery-url={url}
          onPointerDown={(e) => handlePointerDown(e, url)}
          onPointerMove={handlePointerMove}
          onPointerUp={() => handlePointerUp(url)}
          onPointerCancel={handlePointerCancel}
          style={{ WebkitTouchCallout: "none" }}
          className={`relative w-14 h-14 shrink-0 rounded-lg bg-gray-100 overflow-hidden touch-none select-none transition-transform duration-150 ${
            dragUrl === url ? "scale-110 shadow-lg z-10 ring-2 ring-black" : ""
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
