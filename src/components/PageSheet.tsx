import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlayHistory } from "@/hooks/use-overlay-history";

// A full-screen editor (price, description, inventory...) drawn as the page
// itself rather than as a fixed layer over it. While one is open the app
// underneath is hidden ([data-app-root], see EdgeSwipeBack and styles.css),
// so the editor is the document: it scrolls like any web page, and the
// iPhone keyboard just scrolls the focused field into view. The fixed-layer
// version needed useLockedViewport + useVisibleViewport to fight the keyboard
// on every sheet, and still broke on iPhones.
//
// Inside, keep the usual header / flex-1 body / footer column, with the
// header `sticky top-0` and any action bar `sticky bottom-0` -- in normal
// page flow, sticky is what keeps them on screen.
//
// Editors stack: one opened from another hides the one below until it
// closes. Each remembers where the page under it was scrolled and puts it
// back. The back gesture closes the top one (useOverlayHistory).

type Layer = { scrollY: number; setTop: (top: boolean) => void };
const layers: Layer[] = [];

function syncLayers() {
  layers.forEach((layer, i) => layer.setTop(i === layers.length - 1));
  document.body.classList.toggle("oak-page-sheet-open", layers.length > 0);
}

export function PageSheet({
  onClose,
  className = "",
  style,
  children,
}: {
  /** The back gesture's action: whatever the header's Cancel / X does. */
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [top, setTop] = useState(true);

  useOverlayHistory(true, onClose);

  useLayoutEffect(() => {
    const layer: Layer = { scrollY: window.scrollY, setTop };
    layers.push(layer);
    syncLayers();
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      syncLayers();
      window.scrollTo({ top: layer.scrollY, behavior: "instant" });
    };
  }, []);

  // Rendered straight into <body> (not after an effect) so a child's mount
  // effects -- autofocus, DescriptionSheet filling its editor -- find their
  // elements. Editors only open on a tap, never during SSR.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-page-sheet=""
      className={`relative min-h-dvh w-full ${top ? "" : "hidden"} ${className}`}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
