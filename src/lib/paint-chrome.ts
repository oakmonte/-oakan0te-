import { useEffect } from "react";

/** Paints the phone's top strip (theme-color) and the scroll-bounce edge
 *  (--oak-edge) in `color` while mounted, and puts back what was there on
 *  unmount.
 *
 *  An effect on purpose, against the "decide the surface once" rule in
 *  surface.ts: a storefront's colour is the seller's saved theme, which only
 *  exists after a fetch, so no pathname rule or head() can know it. Only
 *  solid colours: theme-color can't take a gradient. */
export function usePaintChrome(color: string | null | undefined) {
  useEffect(() => {
    if (!color || !/^(#|rgb|hsl)/i.test(color.trim())) return;
    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    );
    const before = metas.map((m) => m.content);
    metas.forEach((m) => (m.content = color));
    const root = document.documentElement;
    const edgeBefore = root.style.getPropertyValue("--oak-edge");
    root.style.setProperty("--oak-edge", color);
    return () => {
      metas.forEach((m, i) => (m.content = before[i]));
      if (edgeBefore) root.style.setProperty("--oak-edge", edgeBefore);
      else root.style.removeProperty("--oak-edge");
    };
  }, [color]);
}
