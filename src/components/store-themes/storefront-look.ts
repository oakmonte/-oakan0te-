/** The storefront look a collection page inherits, read off the storefront
 *  it was opened from -- so it's tuned to every theme without each theme
 *  having to describe itself again. */
export type StorefrontLook = {
  background: string;
  backgroundImage: string;
  fontFamily: string;
  textColor: string;
  mutedColor: string;
  tileBg: string;
  accent: string;
};

/** Walks up from `el` to the first ancestor that actually paints a
 *  background (a theme's root), and reads its colour/gradient and font. */
export function readStorefrontLook(
  el: HTMLElement | null,
  colors: Pick<StorefrontLook, "textColor" | "mutedColor" | "tileBg" | "accent">,
): StorefrontLook {
  let background = "#000";
  let backgroundImage = "none";
  let fontFamily = "inherit";
  if (el) {
    fontFamily = getComputedStyle(el).fontFamily;
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      const painted =
        cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
      if (painted || cs.backgroundImage !== "none") {
        background = painted ? cs.backgroundColor : background;
        backgroundImage = cs.backgroundImage;
        break;
      }
    }
  }
  return { background, backgroundImage, fontFamily, ...colors };
}
