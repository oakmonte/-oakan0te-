import tShirtGuide from "./T-shirt-Guide.webp";
import poloShirtGuide from "./Polo-Shirt-Guide.webp";
import dressShirtGuide from "./Dress-Shirt-Guide.webp";
import offShoulderTopGuide from "./Off-Shoulder-Top-Guide.webp";
import nflJerseyGuide from "./NFL-Jersey-Guide.webp";
import footballJerseyGuide from "./Football-jersey guide.webp";
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
import basketballJerseyGuide from "./basketball-jersey guide.webp";
import cardiganGuide from "./Cardigan guide.webp";
import cargoPantsGuide from "./cargo-pants guide.webp";
import cropTopGuide from "./Crop-top guide.webp";
import hoodieGuide from "./hoodie guide.webp";
import jumpsuitGuide from "./Jumpsuit-guide.webp";
import miniDressGuide from "./Mini-dress guide.webp";
import miniSkirtGuide from "./mini-skirt guide.webp";
import pleatedSkirtGuide from "./pleated-skirt guide.webp";
import pufferJacketGuide from "./Puffer-jacket guide.webp";
import romperGuide from "./Romper-guide.webp";
import shortSleeveShirtGuide from "./Short-sleeve-shirt guide.webp";
import sportsShortsGuide from "./sports-shorts guide.webp";
import sweaterVestGuide from "./sweater vest guide.webp";
import sweatshirtGuide from "./sweatshirt guide.webp";
import tankTopGuide from "./Tank-top guide.webp";
import turtleNeckGuide from "./swimsuit guide.jpg";
import varsityJacketGuide from "./Varsity-jacket guide.webp";
import aLineDressGuide from "./A-line-dress guide.webp";
import bermudaShortsGuide from "./Bermuda-shorts guide.webp";
import bikerShortsGuide from "./Biker-shorts guide.webp";
import compressionShirtGuide from "./Compression-shirt guide.webp";
import flaredPantsGuide from "./Flared-pants guide.webp";
import giletGuide from "./Gilet guide.webp";
import haremPantsGuide from "./Harem-pants guide.webp";
import henleyGuide from "./Henley guide.webp";
import leatherJacketGuide from "./Leather-Jacket guide.webp";
import leatherPantsGuide from "./Leather-pants guide.webp";
import leggingsGuide from "./Leggings guide.webp";
import linenPantsGuide from "./Linen-pants guide.webp";
import offShoulderDressGuide from "./Off-shoulder-dress guide.webp";
import palazzoGuide from "./Palazzo guide.webp";
import parachutePantsGuide from "./Parachute-pants guide.webp";
import parkaGuide from "./Parka guide.webp";
import senatorWearGuide from "./Senator-wear guide.webp";
import shirtDressGuide from "./Shirt-dress guide.webp";
import slipDressGuide from "./Slip-dress guide.webp";
import sportsBraGuide from "./Sports-bra guide.webp";
import trackJacketGuide from "./Track-jacket guide.webp";
import truckerJacketGuide from "./Trucker-jacket guide.webp";
import tunicGuide from "./Tunic guide.webp";
import corsetGuide from "./corset guide.webp";
import peplumTopGuide from "./peplum-top guide.webp";
import wrapDressGuide from "./wrap-dress guide.webp";
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
  "a-line-dress": aLineDressGuide,
  "bermuda-shorts": bermudaShortsGuide,
  "biker-shorts": bikerShortsGuide,
  "compression-shirt": compressionShirtGuide,
  "flared-pants": flaredPantsGuide,
  gilet: giletGuide,
  "harem-pants": haremPantsGuide,
  henley: henleyGuide,
  "leather-jacket": leatherJacketGuide,
  "leather-pants": leatherPantsGuide,
  leggings: leggingsGuide,
  "linen-pants": linenPantsGuide,
  "off-shoulder-dress": offShoulderDressGuide,
  palazzo: palazzoGuide,
  "parachute-pants": parachutePantsGuide,
  parka: parkaGuide,
  "senator-wear": senatorWearGuide,
  "shirt-dress": shirtDressGuide,
  "slip-dress": slipDressGuide,
  "sports-bra": sportsBraGuide,
  "track-jacket": trackJacketGuide,
  "trucker-jacket": truckerJacketGuide,
  tunic: tunicGuide,
  corset: corsetGuide,
  "peplum-top": peplumTopGuide,
  "wrap-dress": wrapDressGuide,
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
