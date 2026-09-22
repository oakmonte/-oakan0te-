import type { FontId } from "./fonts";
import type { LayoutId } from "./layout-presets";

export type RemovableBlockId = "stats" | "promo" | "footer";

// Shown in the Layout menu's "Hidden sections" list, which is the only way
// back once a block is removed.
export const REMOVABLE_BLOCK_LABELS: Record<RemovableBlockId, string> = {
  stats: "Follower count",
  promo: "Promo banner",
  footer: "Community",
};

export const MAX_SLIDESHOW_IMAGES = 10;

export type TextFieldId =
  | "hero1"
  | "hero2"
  | "hero3"
  | "statsFollowersText"
  | "promoEyebrow"
  | "promoTitle"
  | "footerLabel"
  | "overlayLine1"
  | "overlayLine2"
  | "logoText";

// A present key with an empty string means "explicitly removed" — distinct
// from an absent key, which means "unmodified, show the theme's default."
export type ThemeTextEdits = Partial<Record<TextFieldId, string>>;
export type ThemeTextFonts = Partial<Record<TextFieldId, FontId>>;

// object-position percentages (0-100, matching CSS), set by dragging a
// cropped image in edit mode. Absent key means "centered" (50/50), not zero.
// scale is set by pinching the same image, edit mode only. Optional so a
// position saved before this existed still renders identically -- absent
// reads as 1, today's implicit behavior, not a value every caller must
// migrate to write.
export type CropPosition = { x: number; y: number; scale?: number };
export type ThemeImageCrops = Record<string, CropPosition>;

// The seller's edit-session draft. Every field only stores a DELTA from the
// theme's hardcoded defaults — an unset/empty value means "show the default,"
// never a copy of the default itself. Session-only: no persistence yet.
export type ThemeEditState = {
  layoutId: LayoutId;
  logoMode: "image" | "text";
  logoImage: string | null;
  slideshowImages: string[];
  // Keyed by slideshow image src. Preview-only, same as slideshowImages
  // itself: those srcs are blob: URLs that don't survive a reload, so a crop
  // tied to one is equally dead on reload — no separate persistence story
  // needed here.
  slideshowCrops: ThemeImageCrops;
  // width / height of the slideshow's crop frame. Null means "auto" — the
  // active slide's own natural ratio, today's behavior. Set once the seller
  // drags the resize handle; from then on every slide crops to this same
  // frame instead of each reflowing to its own shape. Same preview-only tier
  // as slideshowCrops — it's meaningless once slideshowImages resets on load.
  slideshowAspectRatio: number | null;
  // Keyed by `${collectionsMode}:${tileId}` for the real-catalog tiles in
  // CollectionsGrid. Deliberately preview-only (not saved against the
  // product/collection itself) — repositioning here only changes how the
  // photo sits inside this theme's tile frame, not the source image, so it
  // doesn't need to follow the product everywhere else it's shown.
  tileCrops: ThemeImageCrops;
  text: ThemeTextEdits;
  textFonts: ThemeTextFonts;
  hiddenBlocks: RemovableBlockId[];
  collectionsMode: "collections" | "products";
  // How many products/collections CollectionsGrid shows per row. Independent
  // of layoutId (which only reorders blocks) — its own dedicated toggle sits
  // next to the Collections/Products tabs. Session-only for now, same as
  // tileCrops above — see useThemeCustomization.ts's SavedThemeCustomization
  // comment for why persisting it is a follow-up, not wired here yet.
  columns: 1 | 2;
};

export function createInitialEditState(): ThemeEditState {
  return {
    layoutId: "editorial",
    logoMode: "image",
    logoImage: null,
    slideshowImages: [],
    slideshowCrops: {},
    slideshowAspectRatio: null,
    tileCrops: {},
    text: {},
    textFonts: {},
    hiddenBlocks: [],
    collectionsMode: "collections",
    columns: 2,
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
  slideshowCrops: ThemeImageCrops;
  onSlideshowCropChange: (src: string, position: CropPosition) => void;
  slideshowAspectRatio: number | null;
  onSlideshowAspectRatioChange: (ratio: number) => void;
  tileCrops: ThemeImageCrops;
  onTileCropChange: (key: string, position: CropPosition) => void;
  text: ThemeTextEdits;
  onTextChange: (field: TextFieldId, value: string) => void;
  textFonts: ThemeTextFonts;
  onTextFontChange: (field: TextFieldId, font: FontId) => void;
  hiddenBlocks: RemovableBlockId[];
  onRemoveBlock: (block: RemovableBlockId) => void;
  onRestoreBlock: (block: RemovableBlockId) => void;
  layoutId: LayoutId;
  onLayoutChange: (id: LayoutId) => void;
  collectionsMode: "collections" | "products";
  onCollectionsModeChange: (mode: "collections" | "products") => void;
  columns: 1 | 2;
  onColumnsChange: (columns: 1 | 2) => void;
  onTileTapBlocked: () => void;
};
