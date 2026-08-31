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
import type { SizeChartDefinition } from "@/lib/size-chart-config";

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
