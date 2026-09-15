// Relative luminance, WCAG's definition — the gamma-corrected one, not the
// cheap 0.299/0.587/0.114 average. The difference is what decides verdant's
// case below.
function relativeLuminance(hex: string): number {
  const n = hex.replace("#", "");
  const channel = (i: number) => {
    const c = parseInt(n.substring(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const INK = "#1c1b19";
const PAPER = "#ffffff";

// Readable text for a filled swatch of one of the themes' own colours.
// Shared rather than duplicated: the theme-picker grid's colour swatch and
// the variant counter inside CollectionsGrid need exactly the same call.
//
// Picks whichever of ink/paper actually contrasts more, rather than splitting
// on a brightness threshold. The threshold version was fine on the near-black
// and near-white theme *backgrounds* it was written for, but the counter puts
// a 9px digit on a theme's *accent*, where mid-tones live: it put white on
// verdant's green at 2.8:1 (unreadable at that size) and on banner's tan at
// 3.7:1. Measured by contrast instead, both take ink — 6.1:1 and 4.6:1 — and
// every picker swatch keeps the colour it already had.
export function readableTextColor(hex: string): string {
  return contrast(hex, INK) >= contrast(hex, PAPER) ? INK : PAPER;
}
