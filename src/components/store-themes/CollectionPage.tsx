import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { GLASS_RIM, glassClear } from "@/lib/liquid-glass";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { loadCollectionPage, type PreviewTile } from "./storefront-catalog";
import type { StorefrontLook } from "./storefront-look";

// iOS's own push curve; the close is quicker than the open (it gets out of
// the way) and travels the same path back, so the page goes where it came
// from.
const PUSH = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_MS = 380;
const CLOSE_MS = 260;

/** A storefront collection opened as its own page: its photos as a hero
 *  slideshow, its name and description, then every active product in it as
 *  the theme's own product tiles. Pushes in from the right over the
 *  storefront and back out the same way (or the phone's back gesture). */
export function CollectionPage({
  collection,
  look,
  onClose,
  renderTile,
}: {
  collection: PreviewTile;
  look: StorefrontLook;
  onClose: () => void;
  renderTile: (tile: PreviewTile) => ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadCollectionPage>> | null>(null);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let cancelled = false;
    void loadCollectionPage(collection.id).then((d) => {
      if (!cancelled) setData(d);
    });
    // Next frame, so the push animates from off-screen.
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [collection.id]);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function close() {
    if (closing) return;
    setClosing(true);
    setShown(false);
    closeTimer.current = setTimeout(onClose, reduceMotion ? 150 : CLOSE_MS);
  }
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  // The phone's back gesture / browser back closes the page, like any page.
  useOverlayHistory(!closing, close);

  const pageStyle: CSSProperties = {
    background: look.background,
    backgroundImage: look.backgroundImage,
    fontFamily: look.fontFamily,
    color: look.textColor,
    transform: reduceMotion ? undefined : shown ? "translateX(0)" : "translateX(100%)",
    opacity: reduceMotion ? (shown ? 1 : 0) : 1,
    transition: reduceMotion
      ? "opacity 150ms ease"
      : `transform ${closing ? CLOSE_MS : OPEN_MS}ms ${PUSH}`,
    boxShadow: "-12px 0 32px rgba(0,0,0,0.25)",
  };

  const products = data?.products ?? null;
  const count = products?.length ?? 0;
  const description = data?.description ? stripHtml(data.description) : "";

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] overflow-hidden"
      role="dialog"
      aria-label={collection.title}
    >
      {/* The storefront dims a touch as the page slides over it. */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: shown ? 0.3 : 0,
          transition: `opacity ${closing ? CLOSE_MS : OPEN_MS}ms ease`,
        }}
        onClick={close}
      />
      {/* The slide lives on this wrapper, not on the scroller: the back
          button is pinned to the wrapper, so it stays put while the page
          scrolls under it. */}
      <div className="absolute inset-0" style={pageStyle}>
        <button
          type="button"
          onClick={close}
          aria-label="Back"
          className={`absolute z-10 flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-95 ${GLASS_RIM}`}
          // Sits inside the hero card's corner, inset by the same 12px the
          // card is inset from the screen.
          style={{ ...glassClear, top: "calc(env(safe-area-inset-top) + 24px)", left: 24 }}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div className="absolute inset-0 overflow-y-auto overscroll-contain">
          <Hero collection={collection} accent={look.accent} />

          <div className="px-5 pt-5 pb-2">
            <h2 className="text-[30px] font-bold leading-[1.05] tracking-[-0.02em]">
              {collection.title}
            </h2>
            <p className="mt-1.5 text-[13px] font-medium" style={{ color: look.mutedColor }}>
              {products === null ? " " : `${count} ${count === 1 ? "piece" : "pieces"}`}
            </p>
            {description && (
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: look.mutedColor }}>
                {description}
              </p>
            )}
          </div>

          <div className="px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+32px)]">
            {products === null ? (
              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className="aspect-[4/5] animate-pulse rounded-xl"
                    style={{ background: look.tileBg }}
                  />
                ))}
              </div>
            ) : count === 0 ? (
              <p className="py-16 text-center text-[14px]" style={{ color: look.mutedColor }}>
                Nothing in this collection yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {products.map((tile, i) => (
                  <div
                    key={tile.id}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                    // 40ms apart, capped so a big collection's last tile
                    // isn't left waiting.
                    style={{
                      animationDelay: `${Math.min(i, 7) * 40}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    {renderTile(tile)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Hero({ collection, accent }: { collection: PreviewTile; accent: string }) {
  const [index, setIndex] = useState(0);
  const photos = collection.photos;
  return (
    // A contained card rather than a full-bleed photo: inset 12px like the
    // product grid below it, so the hero and the tiles share one edge.
    // isolate + the radius on this element keeps the rounded clip on iOS
    // while the slideshow inside scrolls.
    <div
      className="relative isolate mx-3 aspect-[4/5] overflow-hidden rounded-[22px]"
      style={{
        background: `${accent}22`,
        marginTop: "calc(env(safe-area-inset-top) + 12px)",
      }}
    >
      {photos.length > 0 && (
        <div
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            setIndex((cur) => (cur === i ? cur : i));
          }}
        >
          {photos.map((p, i) => (
            <img
              key={`${p.url}-${i}`}
              src={p.url}
              alt=""
              draggable={false}
              loading={i < 2 ? "eager" : "lazy"}
              className="h-full w-full shrink-0 snap-center snap-always select-none object-cover"
              style={{ WebkitTouchCallout: "none" }}
            />
          ))}
        </div>
      )}
      {/* Fades the photo into the page, so the title below sits on the
          theme's own ground rather than ending on a hard edge. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-white transition-opacity duration-200"
              style={{ opacity: i === index ? 1 : 0.45 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
