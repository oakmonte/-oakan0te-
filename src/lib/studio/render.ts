// Everything that has to look identical on screen and in the exported file.
//
// The studio has two renderers — DOM/CSS for the live preview, canvas 2D for the
// bake — and the only way two renderers stay in agreement is if neither of them
// owns any numbers. So the numbers live here: transitions resolve to a plain
// record of opacity/scale/offset that CSS and drawImage both apply, vignette and
// product pins are described as fractions of frame width, and the bake helpers
// below are the same maths the preview's inline styles use.
import type { ProductPin, TransitionKind, VideoClip } from "./types";
import { clipDuration, clipStarts } from "./types";

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** What is on screen during a transition window.
 *
 *  A transition is centred on the cut and consumes half its length from each
 *  side. Only ONE of the two clips is ever playing real frames — the other holds
 *  its boundary frame (the outgoing clip's last, or the incoming clip's first).
 *
 *  That freeze is a deliberate trade. A true overlapping crossfade would need
 *  frames from beyond a clip's out point, which may simply not exist once you
 *  have trimmed to the end of a take, and it would shorten the timeline every
 *  time you added a transition. Freezing costs nothing, keeps the timeline
 *  length exactly what the track shows, and at 0.3–0.4s is not perceptible. */
export type TransitionState = {
  kind: TransitionKind;
  /** 0 at the window's start, 1 at its end. */
  progress: number;
  outgoingIndex: number;
  incomingIndex: number;
  outgoingSourceTime: number;
  incomingSourceTime: number;
  /** Which of the two is playing real frames right now. */
  liveIndex: number;
};

export function transitionStateAt(clips: VideoClip[], time: number): TransitionState | null {
  if (clips.length < 2) return null;
  const starts = clipStarts(clips);

  for (let i = 1; i < clips.length; i++) {
    const transition = clips[i].transitionIn;
    if (transition.kind === "none" || transition.duration <= 0) continue;
    const cut = starts[i];
    const half = transition.duration / 2;
    if (time < cut - half || time > cut + half) continue;

    const outgoing = clips[i - 1];
    const incoming = clips[i];
    const beforeCut = time < cut;
    const outgoingLocal = Math.min(time, cut) - starts[i - 1];
    const incomingLocal = Math.max(0, time - cut);

    return {
      kind: transition.kind,
      progress: Math.min(1, Math.max(0, (time - (cut - half)) / transition.duration)),
      outgoingIndex: i - 1,
      incomingIndex: i,
      outgoingSourceTime: beforeCut
        ? Math.min(outgoing.outPoint, outgoing.inPoint + outgoingLocal * outgoing.speed)
        : outgoing.outPoint,
      incomingSourceTime: beforeCut
        ? incoming.inPoint
        : Math.min(incoming.outPoint, incoming.inPoint + incomingLocal * incoming.speed),
      liveIndex: beforeCut ? i - 1 : i,
    };
  }
  return null;
}

export type LayerTransform = {
  opacity: number;
  scale: number;
  /** Horizontal offset as a fraction of frame width. */
  offsetX: number;
};

export type TransitionFrame = {
  outgoing: LayerTransform;
  incoming: LayerTransform;
  /** White overlay alpha on top of everything, 0..1. */
  flash: number;
};

const NEUTRAL: LayerTransform = { opacity: 1, scale: 1, offsetX: 0 };

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** The single description of what a transition looks like at a given moment.
 *  CSS turns this into opacity + translateX + scale; the bake turns it into
 *  globalAlpha + a destination rectangle. */
export function transitionFrame(kind: TransitionKind, progress: number): TransitionFrame {
  const p = Math.min(1, Math.max(0, progress));
  switch (kind) {
    case "dissolve":
      return {
        outgoing: { ...NEUTRAL, opacity: 1 - p },
        incoming: { ...NEUTRAL, opacity: p },
        flash: 0,
      };
    case "flash": {
      // Hard cut hidden inside a blown-out frame — the cut you actually want
      // between two outfit shots.
      const bell = 1 - Math.abs(p - 0.5) * 2;
      return {
        outgoing: { ...NEUTRAL, opacity: p < 0.5 ? 1 : 0 },
        incoming: { ...NEUTRAL, opacity: p < 0.5 ? 0 : 1 },
        flash: Math.pow(bell, 0.7),
      };
    }
    case "slide": {
      const e = easeInOut(p);
      return {
        outgoing: { opacity: 1, scale: 1, offsetX: -e },
        incoming: { opacity: 1, scale: 1, offsetX: 1 - e },
        flash: 0,
      };
    }
    case "zoom": {
      const e = easeInOut(p);
      return {
        outgoing: { opacity: 1 - e, scale: 1 + e * 0.35, offsetX: 0 },
        incoming: { opacity: e, scale: 1.35 - e * 0.35, offsetX: 0 },
        flash: 0,
      };
    }
    default:
      return { outgoing: NEUTRAL, incoming: NEUTRAL, flash: 0 };
  }
}

/** CSS for a preview layer. Kept next to transitionFrame so the two never drift. */
export function transformCss(t: LayerTransform): string {
  return `translateX(${(t.offsetX * 100).toFixed(3)}%) scale(${t.scale.toFixed(4)})`;
}

// ---------------------------------------------------------------------------
// Drawing a frame into the output box
// ---------------------------------------------------------------------------

/** Draws a source frame into an output box using the project's fit mode.
 *  Mirrors CSS object-fit exactly, which is what the preview element uses. */
export function drawFitted(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  boxW: number,
  boxH: number,
  mode: "fill" | "fit",
  transform: LayerTransform = NEUTRAL,
): void {
  if (sourceW <= 0 || sourceH <= 0) return;
  const sourceAspect = sourceW / sourceH;
  const boxAspect = boxW / boxH;

  let drawW: number;
  let drawH: number;
  // "fill" is object-fit: cover, "fit" is object-fit: contain.
  if (mode === "fill" ? sourceAspect > boxAspect : sourceAspect < boxAspect) {
    drawH = boxH;
    drawW = drawH * sourceAspect;
  } else {
    drawW = boxW;
    drawH = drawW / sourceAspect;
  }

  drawW *= transform.scale;
  drawH *= transform.scale;
  const x = (boxW - drawW) / 2 + transform.offsetX * boxW;
  const y = (boxH - drawH) / 2;

  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = previousAlpha * transform.opacity;
  ctx.drawImage(image, x, y, drawW, drawH);
  ctx.globalAlpha = previousAlpha;
}

// ---------------------------------------------------------------------------
// Vignette
// ---------------------------------------------------------------------------

// Where the darkening starts, as a fraction of the gradient's reach. Shared with
// the CSS below so both fall off from the same place.
const VIGNETTE_INNER = 0.42;
const VIGNETTE_MAX_ALPHA = 0.72;

export function vignetteCss(amount: number): string {
  if (amount <= 0) return "none";
  const alpha = ((amount / 100) * VIGNETTE_MAX_ALPHA).toFixed(3);
  return `radial-gradient(ellipse at center, rgba(0,0,0,0) ${VIGNETTE_INNER * 100}%, rgba(0,0,0,${alpha}) 100%)`;
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0) return;
  const alpha = (amount / 100) * VIGNETTE_MAX_ALPHA;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  // Squash the circle into the frame's aspect so this is an ellipse reaching the
  // corners — which is what the CSS `ellipse at center` above paints.
  ctx.scale(1, height / width);
  const radius = (width / 2) * Math.SQRT2;
  const gradient = ctx.createRadialGradient(0, 0, radius * VIGNETTE_INNER, 0, 0, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Product pins
// ---------------------------------------------------------------------------

// All fractions of frame WIDTH, the same convention the after-shot layer system
// uses, so a pin placed on a phone bakes at the right size into a 1280px export.
export const PIN_DOT_RADIUS = 0.018;
export const PIN_GAP = 0.016;
export const PIN_PILL_HEIGHT = 0.085;
export const PIN_PILL_PAD_X = 0.032;
export const PIN_PILL_RADIUS = 0.0425;
export const PIN_TITLE_SIZE = 0.036;
export const PIN_PRICE_SIZE = 0.032;
export const PIN_BG = "rgba(0,0,0,0.72)";
export const PIN_APPEAR_SECONDS = 0.28;
export const PIN_FONT_STACK = "'SF Pro', system-ui, -apple-system, sans-serif";

export type PinAppearance = { visible: boolean; opacity: number; scale: number };

/** Pins pop rather than cut in — a hard appearance reads as a glitch when it
 *  lands mid-motion. */
export function pinAppearance(pin: ProductPin, time: number): PinAppearance {
  if (time < pin.startTime || time > pin.endTime) return { visible: false, opacity: 0, scale: 1 };
  const t = Math.min(1, (time - pin.startTime) / PIN_APPEAR_SECONDS);
  const eased = 1 - Math.pow(1 - t, 3);
  return { visible: true, opacity: eased, scale: 0.82 + eased * 0.18 };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Bakes the shoppable tags. Canvas-side twin of ProductPinOverlay. */
export function drawPins(
  ctx: CanvasRenderingContext2D,
  pins: ProductPin[],
  time: number,
  width: number,
  height: number,
): void {
  for (const pin of pins) {
    const appear = pinAppearance(pin, time);
    if (!appear.visible) continue;

    const cx = pin.x * width;
    const cy = pin.y * height;
    const dot = PIN_DOT_RADIUS * width * appear.scale;
    const pillH = PIN_PILL_HEIGHT * width * appear.scale;
    const padX = PIN_PILL_PAD_X * width * appear.scale;
    const titleSize = PIN_TITLE_SIZE * width * appear.scale;
    const priceSize = PIN_PRICE_SIZE * width * appear.scale;

    ctx.save();
    ctx.globalAlpha = appear.opacity;

    // Dot with a soft halo, so it reads on both a white shirt and a dark room.
    ctx.beginPath();
    ctx.arc(cx, cy, dot * 1.9, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, dot, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    ctx.font = `600 ${titleSize}px ${PIN_FONT_STACK}`;
    const titleW = ctx.measureText(pin.title).width;
    ctx.font = `500 ${priceSize}px ${PIN_FONT_STACK}`;
    const priceW = pin.price ? ctx.measureText(pin.price).width : 0;
    const textW = Math.max(titleW, priceW);
    const pillW = textW + padX * 2;

    const gap = PIN_GAP * width * appear.scale;
    const pillX = pin.side === "right" ? cx + dot + gap : cx - dot - gap - pillW;
    const pillY = cy - pillH / 2;

    ctx.fillStyle = PIN_BG;
    roundedRect(ctx, pillX, pillY, pillW, pillH, PIN_PILL_RADIUS * width * appear.scale);
    ctx.fill();

    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    if (pin.price) {
      ctx.font = `600 ${titleSize}px ${PIN_FONT_STACK}`;
      ctx.fillText(pin.title, pillX + padX, pillY + pillH * 0.34);
      ctx.font = `500 ${priceSize}px ${PIN_FONT_STACK}`;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(pin.price, pillX + padX, pillY + pillH * 0.7);
    } else {
      ctx.font = `600 ${titleSize}px ${PIN_FONT_STACK}`;
      ctx.fillText(pin.title, pillX + padX, pillY + pillH / 2);
    }

    ctx.restore();
  }
}
