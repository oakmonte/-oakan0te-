import type { LayoutId } from "./layout-presets";

export type RemovableBlockId = "stats" | "promo" | "footer";

export const MAX_SLIDESHOW_IMAGES = 10;

export type ThemeTextEdits = {
  hero1?: string;
  hero2?: string;
  hero3?: string;
  statsFollowersText?: string;
  statsBadgeLabel?: string;
  promoEyebrow?: string;
  promoTitle?: string;
  footerLabel?: string;
  footerSub?: string;
};

// The seller's edit-session draft. Every field only stores a DELTA from the
// theme's hardcoded defaults — an unset/empty value means "show the default,"
// never a copy of the default itself. Session-only: no persistence yet.
export type ThemeEditState = {
  layoutId: LayoutId;
  logoImage: string | null;
  slideshowImages: string[];
  text: ThemeTextEdits;
  hiddenBlocks: RemovableBlockId[];
  collectionsMode: "collections" | "products";
};

export function createInitialEditState(): ThemeEditState {
  return {
    layoutId: "hero-led",
    logoImage: null,
    slideshowImages: [],
    text: {},
    hiddenBlocks: [],
    collectionsMode: "collections",
  };
}

// Everything a block needs to render its edit-mode affordances, pre-resolved
// by ThemePreviewSheet so blocks never have to know about defaults/fallbacks.
export type ThemeEditingProps = {
  isEditing: boolean;
  logoImage: string | null;
  onLogoChange: (file: File) => void;
  slideshowImages: string[];
  onAddSlideshowImages: (files: FileList) => void;
  onRemoveSlideshowImage: (index: number) => void;
  text: ThemeTextEdits;
  onTextChange: (field: keyof ThemeTextEdits, value: string) => void;
  hiddenBlocks: RemovableBlockId[];
  onRemoveBlock: (block: RemovableBlockId) => void;
  layoutId: LayoutId;
  onLayoutChange: (id: LayoutId) => void;
  collectionsMode: "collections" | "products";
  onCollectionsModeChange: (mode: "collections" | "products") => void;
  onTileTapBlocked: () => void;
};
