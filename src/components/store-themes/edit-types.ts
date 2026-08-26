import type { FontId } from "./fonts";
import type { LayoutId } from "./layout-presets";

export type RemovableBlockId = "stats" | "promo" | "footer";

export const MAX_SLIDESHOW_IMAGES = 10;

export type TextFieldId =
  | "hero1"
  | "hero2"
  | "hero3"
  | "statsFollowersText"
  | "promoEyebrow"
  | "promoTitle"
  | "footerLabel"
  | "footerSub"
  | "overlayLine1"
  | "overlayLine2"
  | "logoText";

// A present key with an empty string means "explicitly removed" — distinct
// from an absent key, which means "unmodified, show the theme's default."
export type ThemeTextEdits = Partial<Record<TextFieldId, string>>;
export type ThemeTextFonts = Partial<Record<TextFieldId, FontId>>;

// The seller's edit-session draft. Every field only stores a DELTA from the
// theme's hardcoded defaults — an unset/empty value means "show the default,"
// never a copy of the default itself. Session-only: no persistence yet.
export type ThemeEditState = {
  layoutId: LayoutId;
  logoMode: "image" | "text";
  logoImage: string | null;
  slideshowImages: string[];
  text: ThemeTextEdits;
  textFonts: ThemeTextFonts;
  hiddenBlocks: RemovableBlockId[];
  collectionsMode: "collections" | "products";
};

export function createInitialEditState(): ThemeEditState {
  return {
    layoutId: "editorial",
    logoMode: "image",
    logoImage: null,
    slideshowImages: [],
    text: {},
    textFonts: {},
    hiddenBlocks: [],
    collectionsMode: "collections",
  };
}

// Everything a block needs to render its edit-mode affordances, pre-resolved
// by ThemePreviewSheet so blocks never have to know about defaults/fallbacks.
export type ThemeEditingProps = {
  isEditing: boolean;
  logoMode: "image" | "text";
  onLogoModeChange: (mode: "image" | "text") => void;
  logoImage: string | null;
  onLogoChange: (file: File) => void;
  slideshowImages: string[];
  onAddSlideshowImages: (files: FileList) => void;
  onRemoveSlideshowImage: (index: number) => void;
  onClearSlideshow: () => void;
  text: ThemeTextEdits;
  onTextChange: (field: TextFieldId, value: string) => void;
  textFonts: ThemeTextFonts;
  onTextFontChange: (field: TextFieldId, font: FontId) => void;
  hiddenBlocks: RemovableBlockId[];
  onRemoveBlock: (block: RemovableBlockId) => void;
  layoutId: LayoutId;
  onLayoutChange: (id: LayoutId) => void;
  collectionsMode: "collections" | "products";
  onCollectionsModeChange: (mode: "collections" | "products") => void;
  onTileTapBlocked: () => void;
};
