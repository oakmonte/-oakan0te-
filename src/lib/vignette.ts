<<<<<<< HEAD
// The one definition of a vignette in this app.
//
// A vignette is positional — it darkens by distance from the centre — so unlike
// every other adjustment it cannot be expressed as a CSS filter function or a
// colour matrix. That means it has to be written twice: once as something the
// browser paints over the live preview, once as something drawn into the export
// canvas. Those two are the same effect and must agree exactly, so they live
// here, side by side, reading the same two constants. Writing either one at a
// call site is how the preview and the exported file drift apart.
//
// Both were lifted out of studio/render.ts, which already had them right, so
// the studio and after-shot screens now produce an identical vignette at the
// same slider value instead of two different ones.

/** Where the darkening starts, as a fraction of the gradient's reach. */
const VIGNETTE_INNER = 0.42;
/** Alpha at the very edge when the slider is at 100. */
const VIGNETTE_MAX_ALPHA = 0.72;

/** For the live preview: a `background` value for an overlay div sized to the
 *  media box. Returns "none" below 1 so the caller can render unconditionally. */
=======
// The one vignette look, shared by every editor that has one (Studio's video
// clips, the after-shot photo/video bake, the photo-editor route). Preview and
// export both call these same two functions so neither can drift from the
// other — see the studio/render.ts header comment for why that matters.

// Where the darkening starts, as a fraction of the gradient's reach. Shared with
// the CSS below so both fall off from the same place.
const VIGNETTE_INNER = 0.42;
const VIGNETTE_MAX_ALPHA = 0.72;

>>>>>>> 425644e (create-vingette is pickable (will make it darker), intensity scale fixed)
export function vignetteCss(amount: number): string {
  if (amount <= 0) return "none";
  const alpha = ((amount / 100) * VIGNETTE_MAX_ALPHA).toFixed(3);
  return `radial-gradient(ellipse at center, rgba(0,0,0,0) ${VIGNETTE_INNER * 100}%, rgba(0,0,0,${alpha}) 100%)`;
}

<<<<<<< HEAD
/** For the bake: paints the same gradient into a canvas.
 *
 *  Drawn with `drawImage`-style compositing rather than a getImageData pixel
 *  loop on purpose — it is one composite op instead of a full-frame read and
 *  write, which on a 30fps video export is the difference between one pass over
 *  the pixels and three. */
=======
>>>>>>> 425644e (create-vingette is pickable (will make it darker), intensity scale fixed)
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
<<<<<<< HEAD
  // corners — which is what the CSS `ellipse at center` above paints. Without
  // this a portrait frame gets black bands top and bottom the preview never
  // showed.
=======
  // corners — which is what the CSS `ellipse at center` above paints.
>>>>>>> 425644e (create-vingette is pickable (will make it darker), intensity scale fixed)
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
