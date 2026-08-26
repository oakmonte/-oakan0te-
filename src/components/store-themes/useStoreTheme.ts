import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { ThemeId } from "./types";

// TODO: dev-only, matches store.products.tsx / useThemePreviewCatalog.ts. Revert to
// session-scoped lookup (owner_id = user.id) before launch.
const DEV_STORE_ID = "4a492d4d-66bd-4d14-a5dc-e6d8d1723023";
const DEFAULT_THEME: ThemeId = "motion";

// `stores.theme_id` is a uuid FK into store_themes; the app picks themes by
// slug (ThemeId). This hook is the one place that translates between them, so
// nothing else in the app needs to know store_themes has a surrogate id.
export function useStoreTheme() {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("theme_id, store_themes(slug)")
        .eq("id", DEV_STORE_ID)
        .maybeSingle();
      if (cancelled) return;
      const slug = data?.store_themes?.slug;
      if (slug) setThemeIdState(slug as ThemeId);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectTheme = useCallback(async (id: ThemeId) => {
    setThemeIdState(id);
    const { data } = await supabase.from("store_themes").select("id").eq("slug", id).maybeSingle();
    if (data) {
      await supabase.from("stores").update({ theme_id: data.id }).eq("id", DEV_STORE_ID);
    }
  }, []);

  return { themeId, loading, selectTheme };
}
