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
import basketballJerseyGuide from "./basketball-jersey guide.png";
import cardiganGuide from "./Cardigan guide.png";
import cargoPantsGuide from "./cargo-pants guide.png";
import cropTopGuide from "./Crop-top guide.png";
import hoodieGuide from "./hoodie guide.png";
import jumpsuitGuide from "./Jumpsuit-guide.png";
import miniDressGuide from "./Mini-dress guide.png";
import miniSkirtGuide from "./mini-skirt guide.png";
import pleatedSkirtGuide from "./pleated-skirt guide.png";
import pufferJacketGuide from "./Puffer-jacket guide.png";
import romperGuide from "./Romper-guide.png";
import shortSleeveShirtGuide from "./Short-sleeve-shirt guide.png";
import sportsShortsGuide from "./sports-shorts guide.png";
import sweaterVestGuide from "./sweater vest guide.png";
import sweatshirtGuide from "./sweatshirt guide.png";
import tankTopGuide from "./Tank-top guide.png";
import turtleNeckGuide from "./swimsuit guide.jpg";
import varsityJacketGuide from "./Varsity-jacket guide.png";
import type { SizeChartDefinition } from "@/lib/size-chart-config";

// Deliberately a total Record, not a Partial one: the letters down the side
// of the chart ("a", "b", "c"…) are read off the illustration and mean
// nothing without it, so a guide with no image isn't a degraded state worth
// supporting -- it's a broken screen. Keeping it total also makes adding a
// guide without artwork a compile error rather than a runtime blank.
//
// Some category-level chart definitions reuse a generic illustration when the
// lettered measurement contract is identical. A category must never point at
// a deleted or visually mismatched asset.
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
  "standard-tshirt": shortSleeveShirtGuide,
  "polo-alt": poloShirtGuide,
  sweatshirt: sweatshirtGuide,
  "basketball-jersey": basketballJerseyGuide,
  cardigan: cardiganGuide,
  "cargo-pants": cargoPantsGuide,
  "crop-top": cropTopGuide,
  hoodie: hoodieGuide,
  jumpsuit: jumpsuitGuide,
  "mini-dress": miniDressGuide,
  "mini-skirt": miniSkirtGuide,
  "pleated-skirt": pleatedSkirtGuide,
  "puffer-jacket": pufferJacketGuide,
  romper: romperGuide,
  "short-sleeve-shirt": shortSleeveShirtGuide,
  "sports-shorts": sportsShortsGuide,
  "sweater-vest": sweaterVestGuide,
  "tank-top": tankTopGuide,
  "turtle-neck": turtleNeckGuide,
  "varsity-jacket": varsityJacketGuide,
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
