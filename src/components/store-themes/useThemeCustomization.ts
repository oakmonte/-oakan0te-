import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import type { LayoutId } from "./layout-presets";
import type {
  RemovableBlockId,
  ThemeEditState,
  ThemeTextEdits,
  ThemeTextFonts,
} from "./edit-types";
import type { ThemeId } from "./types";

export type SavedThemeCustomization = Omit<
  ThemeEditState,
  "slideshowCrops" | "slideshowAspectRatio" | "tileCrops"
>;

// Persists everything in ThemeEditState EXCEPT crop positions. logoImage and
// slideshowImages are real Bunny Storage URLs by the time they land in state
// (see full-previews.tsx's onLogoChange/onAddSlideshowImages, which upload
// the file before ever touching state) — plain strings that survive a reload
// or another device fine, unlike the blob: URLs they used to hold.
// slideshowCrops/slideshowAspectRatio/tileCrops ride along as session-only
// still — see the comments on those fields in edit-types.ts.
// storeId is optional — omit it for the editor (the seller's own active
// store, from session); pass it explicitly to read a specific store's
// customization for public/read-only rendering (see PublicStorefront).
export function useThemeCustomization(themeId: ThemeId, storeIdOverride?: string | null) {
  const { storeId: activeStoreId, loading: activeStoreLoading } = useActiveStoreId();
  const storeId = storeIdOverride ?? activeStoreId;
  const storeLoading = storeIdOverride === undefined && activeStoreLoading;
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SavedThemeCustomization | null>(null);

  useEffect(() => {
    if (storeLoading) return;
    if (!storeId) {
      setSaved(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSaved(null);

    (async () => {
      const { data, error } = await supabase
        .from("store_theme_customizations")
        .select(
          "layout_id, logo_mode, logo_image_url, slideshow_image_urls, text, text_fonts, hidden_blocks, collections_mode",
        )
        .eq("store_id", storeId)
        .eq("theme_slug", themeId)
        .maybeSingle();
      if (cancelled) return;
      setSaved(
        !data || error
          ? null
          : {
              layoutId: data.layout_id as LayoutId,
              logoMode: data.logo_mode as "image" | "text",
              logoImage: data.logo_image_url,
              slideshowImages: data.slideshow_image_urls ?? [],
              text: (data.text ?? {}) as ThemeTextEdits,
              textFonts: (data.text_fonts ?? {}) as ThemeTextFonts,
              hiddenBlocks: (data.hidden_blocks ?? []) as RemovableBlockId[],
              collectionsMode: data.collections_mode as "collections" | "products",
            },
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [themeId, storeId, storeLoading]);

  const save = useCallback(
    async (state: ThemeEditState) => {
      if (!storeId) return;
      await supabase.from("store_theme_customizations").upsert(
        {
          store_id: storeId,
          theme_slug: themeId,
          layout_id: state.layoutId,
          logo_mode: state.logoMode,
          logo_image_url: state.logoImage,
          slideshow_image_urls: state.slideshowImages,
          text: state.text,
          text_fonts: state.textFonts,
          hidden_blocks: state.hiddenBlocks,
          collections_mode: state.collectionsMode,
        },
        { onConflict: "store_id,theme_slug" },
      );
    },
    [themeId, storeId],
  );

  return { loading, saved, save };
}
