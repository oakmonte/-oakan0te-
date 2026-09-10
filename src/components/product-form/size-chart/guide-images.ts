import tShirtGuide from "./T-shirt-Guide.webp";
import poloShirtGuide from "./Polo-Shirt-Guide.webp";
import dressShirtGuide from "./Dress-Shirt-Guide.webp";
import offShoulderTopGuide from "./Off-Shoulder-Top-Guide.webp";
import nflJerseyGuide from "./NFL-Jersey-Guide.webp";
import footballJerseyGuide from "./Football-Jersey-Guide.webp";
import baggyJoggersGuide from "./Baggy-Joggers-Guide.webp";
import cuffedJoggersGuide from "./Cuffed-joggers-guide.webp";
import straightJoggersGuide from "./Straight-joggers-guide.webp";
import skinnyJoggersGuide from "./skinny-joggers-guide.webp";
import baggyCorporateTrouserGuide from "./Baggy-corporate-trouser-guide.webp";
import baggyJeanGuide from "./Baggy-jean-or-denim-trouser-guide.webp";
import shortsGuide from "./Shorts-guide.webp";
import joggerJortsGuide from "./Jogger-jorts-guide.webp";
import denimJortsGuide from "./Denim-jorts-guide.webp";
import dolphinShortsGuide from "./Dolphin-shorts-guide.webp";
import bumShortsGuide from "./Bum-shorts-or-shorter-shorts-guide.webp";
import denimBumShortsGuide from "./Denim-bum-shorts-guide.webp";
import standardTShirtGuide from "./186b0335-a62e-4e2d-bb62-ba57b5e45ca7.png";
import poloAltGuide from "./379045a5-a44b-4aea-8c16-284db61d1dee.png";
import clothingCorsetGuide from "./3abee7a8-db1b-4397-acf4-710d50061e18.png";
import clothingBodysuitGuide from "./af6ef374-9691-4d4c-bc07-7d2b0440eb3a.png";
import overshirtGuide from "./bfe78330-f0f6-4946-afb6-288072187b84.png";
import lingerieCorsetGuide from "./d1a615a0-319b-4f99-8bc3-6ad6522eb965.png";
import lingerieBodysuitGuide from "./df22c1d4-5ebe-4bc3-ab27-be1ec66fb4a0.png";
import type { SizeChartDefinition } from "@/lib/size-chart-config";

// Deliberately a total Record, not a Partial one: the letters down the side
// of the chart ("a", "b", "c"…) are read off the illustration and mean
// nothing without it, so a guide with no image isn't a degraded state worth
// supporting -- it's a broken screen. Keeping it total also makes adding a
// guide without artwork a compile error rather than a runtime blank.
//
// Two entries below therefore share another guide's artwork rather than
// having their own (their own files were removed on 2026-09-10). Both are
// safe reuses: activewear-tshirt, sweatshirt, overshirt and tshirt all use
// STANDARD_TOP_LINES in size-chart-config.ts -- the identical five
// measurements under the identical five letters -- so the borrowed picture
// labels exactly the same things. Same reuse principle as CHARTS_BY_CATEGORY,
// where one illustration already covers several categories.
export const GUIDE_IMAGES: Record<SizeChartDefinition["guide"], string> = {
  tshirt: tShirtGuide,
  polo: poloShirtGuide,
  "dress-shirt": dressShirtGuide,
  "off-shoulder-top": offShoulderTopGuide,
  "nfl-jersey": nflJerseyGuide,
  "football-jersey": footballJerseyGuide,
  "baggy-joggers": baggyJoggersGuide,
  "cuffed-joggers": cuffedJoggersGuide,
  "straight-joggers": straightJoggersGuide,
  "skinny-joggers": skinnyJoggersGuide,
  "baggy-corporate-trousers": baggyCorporateTrouserGuide,
  "baggy-jeans": baggyJeanGuide,
  shorts: shortsGuide,
  "jogger-jorts": joggerJortsGuide,
  "denim-jorts": denimJortsGuide,
  "dolphin-shorts": dolphinShortsGuide,
  "bum-shorts": bumShortsGuide,
  "denim-bum-shorts": denimBumShortsGuide,
  // Borrowed, see the note above: same short-sleeve tee shape, same lines.
  "activewear-tshirt": tShirtGuide,
  "standard-tshirt": standardTShirtGuide,
  "polo-alt": poloAltGuide,
  "clothing-corset": clothingCorsetGuide,
  "clothing-bodysuit": clothingBodysuitGuide,
  overshirt: overshirtGuide,
  // Borrowed: the overshirt guide is a long-sleeved top layer, so it reads
  // closer to a sweatshirt than the short-sleeve tee does.
  sweatshirt: overshirtGuide,
  "lingerie-corset": lingerieCorsetGuide,
  "lingerie-bodysuit": lingerieBodysuitGuide,
};

const preloaded = new Set<string>();

// Kicks off the browser's image fetch/decode as soon as a category is picked
// rather than waiting for the Necessities sheet to actually mount the <img>,
// so by the time a seller taps through, the guide is already cached.
export function preloadGuideImage(guide: SizeChartDefinition["guide"]) {
  const src = GUIDE_IMAGES[guide];
  if (preloaded.has(src)) return;
  preloaded.add(src);
  const img = new Image();
  img.src = src;
}
