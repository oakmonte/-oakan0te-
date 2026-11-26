import { createInitialEditState, type DesktopHero, type ThemeEditingProps } from "./edit-types";
import { HERO_SLIDESHOW_IMAGES } from "./hero-placeholders";

const noop = () => {};

/** View-only storefront settings, like the live storefront builds: the
 *  theme's placeholder photos, and which hero to show. */
export function viewOnly(hero: DesktopHero): ThemeEditingProps {
  const s = createInitialEditState();
  return {
    isEditing: false,
    logoMode: s.logoMode,
    onLogoModeChange: noop,
    logoImage: s.logoImage,
    onLogoChange: noop,
    slideshowImages: HERO_SLIDESHOW_IMAGES,
    onAddSlideshowImages: noop,
    onRemoveSlideshowImage: noop,
    onClearSlideshow: noop,
    slideshowCrops: s.slideshowCrops,
    onSlideshowCropChange: noop,
    slideshowAspectRatio: s.slideshowAspectRatio,
    onSlideshowAspectRatioChange: noop,
    tileCrops: s.tileCrops,
    onTileCropChange: noop,
    text: s.text,
    onTextChange: noop,
    textFonts: s.textFonts,
    onTextFontChange: noop,
    hiddenBlocks: s.hiddenBlocks,
    onRemoveBlock: noop,
    onRestoreBlock: noop,
    layoutId: s.layoutId,
    onLayoutChange: noop,
    columns: s.columns,
    onColumnsChange: noop,
    onTileTapBlocked: noop,
    stickyBottom: s.stickyBottom,
    desktopHero: hero,
  };
}
