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

export type SavedThemeCustomization = Omit<ThemeEditState, "logoImage" | "slideshowImages">;

// Persists everything in ThemeEditState EXCEPT uploaded images. logoImage and
// slideshowImages are blob: URLs from URL.createObjectURL — they don't survive
// a reload or another device, so they stay session-only until bunny.net is
// wired up. logo_image_url / slideshow_image_urls already exist on the table,
// unwritten, so wiring real uploads in later is a code change, not a migration
// (see POSTPONED.md).
export function useThemeCustomization(themeId: ThemeId) {
  const { storeId, loading: storeLoading } = useActiveStoreId();
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
        .select("layout_id, logo_mode, text, text_fonts, hidden_blocks, collections_mode")
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
