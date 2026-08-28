import tShirtGuide from "./T-shirt-Guide.jpg";
import poloShirtGuide from "./Polo-Shirt-Guide.png";
import offShoulderTopGuide from "./Off-Shoulder-Top-Guide.png";
import nflJerseyGuide from "./NFL-Jersey-Guide.png";
import footballJerseyGuide from "./Football-Jersey-Guide.png";
import baggyJoggersGuide from "./Baggy-Joggers-Guide.png";
import type { SizeChartDefinition } from "@/lib/size-chart-config";

export const GUIDE_IMAGES: Record<SizeChartDefinition["guide"], string> = {
  tshirt: tShirtGuide,
  polo: poloShirtGuide,
  "off-shoulder-top": offShoulderTopGuide,
  "nfl-jersey": nflJerseyGuide,
  "football-jersey": footballJerseyGuide,
  "baggy-joggers": baggyJoggersGuide,
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
