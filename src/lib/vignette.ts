// The one vignette look, shared by every editor that has one (Studio's video
// clips, the after-shot photo/video bake, the photo-editor route). Preview and
// export both call these same two functions so neither can drift from the
// other — see the studio/render.ts header comment for why that matters.

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
