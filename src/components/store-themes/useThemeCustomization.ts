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

// columns is also excluded here, session-only for now like the crop fields:
// persisting it needs a new `columns` column on store_theme_customizations,
// which needs the generated Supabase types regenerated to type the
// select/upsert calls below -- that file is hook-protected
// (block-generated-edits.mjs) and the Supabase MCP that regenerates it is
// disconnected in this session. Wiring it up is a follow-up, not a blocker
// for the toggle itself (see full-preview-blocks.tsx's ColumnsToggle).
export type SavedThemeCustomization = Omit<
  ThemeEditState,
  "slideshowCrops" | "slideshowAspectRatio" | "tileCrops" | "columns"
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
  // Distinct from "no saved row": a failed read means we DON'T KNOW what's
  // stored, so the editor must not offer a Save that would write defaults
  // over whatever the seller had. `saved` alone can't tell the two apart.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (storeLoading) return;
    setLoadFailed(false);
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
      if (error) {
        console.error("useThemeCustomization: load failed", error);
        setLoadFailed(true);
      }
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

  // Returns an error message, or null on success. It used to await the
  // upsert and discard the result, so a failed save looked exactly like a
  // successful one — the sheet closed, the seller walked away, and the work
  // was gone.
  const save = useCallback(
    async (state: ThemeEditState): Promise<string | null> => {
      if (!storeId) return "No store to save to";
      const { error } = await supabase.from("store_theme_customizations").upsert(
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
      if (error) {
        console.error("useThemeCustomization: save failed", error);
        return "Couldn't save those changes";
      }
      return null;
    },
    [themeId, storeId],
  );

  return { loading, loadFailed, saved, save };
}
