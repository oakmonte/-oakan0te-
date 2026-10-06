// Automatic low-light lift for recorded video.
//
// Browsers hand a web page the camera's raw feed, without the low-light and
// HDR tone-mapping the phone's own camera app applies, so anything shot
// indoors comes out dim. This measures how bright the scene is and picks a
// gamma exponent for GlFilterRenderer.lift that brings a dim scene part of
// the way up -- never all the way (that amplifies sensor noise and looks
// washed out), and never darkening a scene that's already bright enough.

/** Mean brightness we nudge a dim scene toward, in encoded (sRGB) 0..1. */
const TARGET_MEAN = 0.42;
/** How much of the gap to the target is closed: partial on purpose. */
const STRENGTH = 0.6;
/** The strongest lift allowed, however dark the scene. */
const MIN_EXPONENT = 0.62;

/** The gamma exponent for a scene of this mean brightness (0..1): 1 when it
 *  is already bright enough, down to MIN_EXPONENT for a very dark one. */
export function liftForMean(mean: number): number {
  // A near-black frame is a covered lens or a camera still starting up;
  // lifting it only paints noise.
  if (!(mean > 0.02) || mean >= TARGET_MEAN) return 1;
  const goal = mean + (TARGET_MEAN - mean) * STRENGTH;
  const exponent = Math.log(goal) / Math.log(mean);
  return Math.min(1, Math.max(MIN_EXPONENT, exponent));
}

/** Samples a video's brightness cheaply: draws it into a 32x32 canvas and
 *  averages the luma. Returns null if the frame can't be read. */
export function createLightMeter(): (source: CanvasImageSource) => number | null {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return (source) => {
    if (!ctx) return null;
    try {
      ctx.drawImage(source, 0, 0, 32, 32);
      const { data } = ctx.getImageData(0, 0, 32, 32);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      return sum / (data.length / 4) / 255;
    } catch {
      return null;
    }
  };
}
