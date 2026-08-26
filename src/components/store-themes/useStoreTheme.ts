import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import type { ThemeId } from "./types";

const DEFAULT_THEME: ThemeId = "motion";

// `stores.theme_id` is a uuid FK into store_themes; the app picks themes by
// slug (ThemeId). This hook is the one place that translates between them, so
// nothing else in the app needs to know store_themes has a surrogate id.
export function useStoreTheme() {
  const { storeId, loading: storeLoading } = useActiveStoreId();
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeLoading) return;
    if (!storeId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("theme_id, store_themes(slug)")
        .eq("id", storeId)
        .maybeSingle();
      if (cancelled) return;
      const slug = data?.store_themes?.slug;
      if (slug) setThemeIdState(slug as ThemeId);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId, storeLoading]);

  const selectTheme = useCallback(
    async (id: ThemeId) => {
      setThemeIdState(id);
      if (!storeId) return;
      const { data } = await supabase
        .from("store_themes")
        .select("id")
        .eq("slug", id)
        .maybeSingle();
      if (data) {
        await supabase.from("stores").update({ theme_id: data.id }).eq("id", storeId);
      }
    },
    [storeId],
  );

  return { themeId, loading, selectTheme };
}
