import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import type { LayoutId } from "./layout-presets";
import type {
  DesktopHero,
  RemovableBlockId,
  ThemeEditState,
  ThemeImageCrops,
  ThemeTextEdits,
  ThemeTextFonts,
} from "./edit-types";
import type { ThemeId } from "./types";

// Every edit the seller can make is saved. columns, the crops and the
// slideshow frame shape used to be session-only -- Save "worked" and they
// were gone on reopen -- because each wanted a column of its own.
export type SavedThemeCustomization = ThemeEditState;

// Persists everything in ThemeEditState. logoImage and
// slideshowImages are real Bunny Storage URLs by the time they land in state
// (see full-previews.tsx's onLogoChange/onAddSlideshowImages, which upload
// the file before ever touching state) — plain strings that survive a reload
// or another device fine, unlike the blob: URLs they used to hold.
// storeId is optional — omit it for the editor (the seller's own active
// store, from session); pass it explicitly to read a specific store's
// customization for public/read-only rendering (see PublicStorefront).
// The fields with no column of their own (hero style, columns, crops, frame
// shape) ride inside the `text` jsonb under "_"-prefixed keys no TextFieldId
// uses. A new column needs a migration AND regenerated types before the
// upsert below can name it, and a deploy that names a column the database
// doesn't have yet fails every save; the jsonb takes them today. Move them to
// columns when the types are next regenerated.
type Extras = Pick<
  ThemeEditState,
  "desktopHero" | "columns" | "slideshowCrops" | "slideshowAspectRatio" | "tileCrops"
>;

function splitText(raw: unknown): { text: ThemeTextEdits } & Extras {
  const {
    _desktopHero: hero,
    _columns: columns,
    _slideshowCrops: slideshowCrops,
    _slideshowAspectRatio: ratio,
    _tileCrops: tileCrops,
    ...text
  } = (raw ?? {}) as Record<string, unknown>;
  return {
    text: text as ThemeTextEdits,
    // The regular slideshow unless the seller picked cards: nothing new is
    // forced on a store.
    desktopHero: (hero === "cards" ? "cards" : "banner") as DesktopHero,
    columns: columns === 1 ? 1 : 2,
    slideshowCrops: (slideshowCrops ?? {}) as ThemeImageCrops,
    slideshowAspectRatio: typeof ratio === "number" ? ratio : null,
    tileCrops: (tileCrops ?? {}) as ThemeImageCrops,
  };
}

function joinText(state: ThemeEditState) {
  return {
    ...state.text,
    _desktopHero: state.desktopHero,
    _columns: state.columns,
    _slideshowCrops: state.slideshowCrops,
    _slideshowAspectRatio: state.slideshowAspectRatio,
    _tileCrops: state.tileCrops,
  };
}

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
          "layout_id, logo_mode, logo_image_url, slideshow_image_urls, text, text_fonts, hidden_blocks, sticky_bottom",
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
              ...splitText(data.text),
              textFonts: (data.text_fonts ?? {}) as ThemeTextFonts,
              hiddenBlocks: (data.hidden_blocks ?? []) as RemovableBlockId[],
              stickyBottom: data.sticky_bottom,
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
          text: joinText(state),
          text_fonts: state.textFonts,
          hidden_blocks: state.hiddenBlocks,
          sticky_bottom: state.stickyBottom,
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
