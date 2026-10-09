// The status strip (and the scroll-bounce edge) take the colour that is
// actually painted at the top of the screen.
//
// Before this, that colour was predicted: a black root theme-color, a white
// one declared per route, light/dark pairs per surface, an overlay flag, and a
// CSS --oak-edge keyed off a pathname list (surface.ts). Every white screen
// that wasn't on a list -- or that iOS sampled at the wrong moment -- got a
// black strip above it (sign-in did, while declaring #ffffff). Reading the
// screen can't drift from the screen.
//
// The declared values still matter: they're in the SSR'd HTML, so they set the
// first paint before this runs, and they're restored whenever nothing on top
// has a solid colour to read (a gradient storefront theme, a bare video).

type Rgba = [number, number, number, number];

function parse(color: string): Rgba | null {
  const m = color.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/,
  );
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4];
    return [+m[1], +m[2], +m[3], a];
  }
  // color(srgb r g b / a), which some engines report for wide-gamut values.
  const c = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (c) return [+c[1] * 255, +c[2] * 255, +c[3] * 255, c[4] === undefined ? 1 : +c[4]];
  return null;
}

function hex([r, g, b]: Rgba) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** The first mostly-opaque background at the top of the screen, topmost
 *  element first. html/body don't count -- they're what this sets. */
export function sampleTopColor(): string | null {
  if (typeof document === "undefined") return null;
  const stack = document.elementsFromPoint(window.innerWidth / 2, 1);
  for (const el of stack) {
    if (el === document.documentElement || el === document.body) break;
    const c = parse(getComputedStyle(el).backgroundColor);
    if (c && c[3] >= 0.6) return hex(c);
  }
  return null;
}

function apply(color: string | null) {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  for (const meta of metas) {
    // If the router rewrote the tag since we last touched it, that's the new
    // declared value for this screen.
    if (meta.content !== meta.dataset.oakApplied) meta.dataset.oakDeclared = meta.content;
    const next = color ?? meta.dataset.oakDeclared ?? meta.content;
    if (meta.content === next && meta.dataset.oakApplied === next) continue;
    meta.content = next;
    meta.dataset.oakApplied = next;
    // A standalone iOS app only re-reads theme-color when the element is
    // reinserted -- editing the attribute in place is ignored.
    const parent = meta.parentNode;
    const after = meta.nextSibling;
    if (parent) {
      parent.removeChild(meta);
      parent.insertBefore(meta, after);
    }
  }
  const root = document.documentElement.style;
  if (color) root.setProperty("--oak-edge", color);
  else root.removeProperty("--oak-edge");
}

let frame = 0;
const timers: ReturnType<typeof setTimeout>[] = [];

/** Re-read the top of the screen soon. Several passes: the first catches the
 *  new screen, the later ones catch content and sheets that settle in. */
export function scheduleStatusStrip() {
  if (typeof window === "undefined") return;
  cancelAnimationFrame(frame);
  timers.splice(0).forEach(clearTimeout);
  const run = () => apply(sampleTopColor());
  frame = requestAnimationFrame(() => requestAnimationFrame(run));
  timers.push(setTimeout(run, 300), setTimeout(run, 900));
}

/** Follows what opens on top (sheets and dialogs portal into <body>), the
 *  phone's light/dark switch, and the app coming back to the foreground. */
export function watchStatusStrip(): () => void {
  const observer = new MutationObserver(scheduleStatusStrip);
  observer.observe(document.body, { childList: true });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-surface", "data-overlay", "data-scheme"],
  });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", scheduleStatusStrip);
  const onVisible = () => {
    if (document.visibilityState === "visible") scheduleStatusStrip();
  };
  document.addEventListener("visibilitychange", onVisible);
  scheduleStatusStrip();
  return () => {
    observer.disconnect();
    scheme.removeEventListener("change", scheduleStatusStrip);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
