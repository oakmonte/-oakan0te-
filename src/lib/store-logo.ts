import { supabase } from "@/lib/integrations/my-supabase/client";

/** The slug useStoreTheme falls back to when stores.theme_id is null.
 *
 *  Not a guess, and not cosmetic. useStoreTheme defaults an unset theme_id to
 *  "motion" on the client and never writes it back, so a seller who has never
 *  opened the theme picker still has real customisations saved under this slug.
 *  Skip the fallback and their logo disappears -- which is the most common case,
 *  not an edge one. */
const DEFAULT_THEME_SLUG = "motion";

export type StoreLogo = {
  url: string | null;
  /** Whether stores.logo_url exists yet. The migration adding it is applied by
   *  hand; until it runs there is nowhere to save a store's own picture, and
   *  the dashboard says so instead of uploading a file it cannot keep. */
  canSaveOwnLogo: boolean;
};

/** Resolves the picture that represents a store.
 *
 *      stores.logo_url                              the store's own identity
 *   ?? store_theme_customizations.logo_image_url    whatever their theme has
 *   ?? null                                         caller draws a placeholder
 *
 *  Two sources because the column is new. The logo used to live only on
 *  store_theme_customizations, keyed (store_id, theme_slug) -- a property of the
 *  THEME rather than of the store, so switching storefront theme changed or lost
 *  the seller's face. stores.logo_url fixes that going forward; the fallback is
 *  what stops every existing seller losing the picture they already uploaded.
 *  There is deliberately no backfill (see the migration's comment).
 *
 *  One place, because the dashboard and the public storefront both need this
 *  answer and must not disagree about the same store.
 *
 *  Tolerates the column not existing yet: the first query is allowed to fail on
 *  an unknown column and the theme logo is used instead, which is exactly the
 *  behaviour before the column existed. Once the migration lands the same code
 *  prefers stores.logo_url with no edit and no flag to flip. */
export async function fetchStoreLogo(storeId: string): Promise<StoreLogo> {
  // One round trip in the normal case: the store's own logo and its theme slug
  // together. The theme logo is only fetched if there is no own logo.
  const withColumn = await supabase
    .from("stores")
    .select("logo_url, store_themes(slug)")
    .eq("id", storeId)
    .maybeSingle();

  let canSaveOwnLogo = true;
  let themeSlug = DEFAULT_THEME_SLUG;

  if (withColumn.error) {
    if (!isMissingColumnError(withColumn.error)) {
      console.error("fetchStoreLogo: failed to read the store", withColumn.error);
      return { url: null, canSaveOwnLogo: false };
    }
    // Before the migration: no own logo is possible, so ask for the slug alone.
    canSaveOwnLogo = false;
    const { data } = await supabase
      .from("stores")
      .select("store_themes(slug)")
      .eq("id", storeId)
      .maybeSingle();
    themeSlug = data?.store_themes?.slug ?? DEFAULT_THEME_SLUG;
  } else {
    const row = withColumn.data as {
      logo_url?: string | null;
      store_themes?: { slug?: string | null } | null;
    } | null;
    if (row?.logo_url) return { url: row.logo_url, canSaveOwnLogo };
    themeSlug = row?.store_themes?.slug ?? DEFAULT_THEME_SLUG;
  }

  const { data: custom, error: customError } = await supabase
    .from("store_theme_customizations")
    .select("logo_image_url")
    .eq("store_id", storeId)
    .eq("theme_slug", themeSlug)
    .maybeSingle();

  if (customError) {
    console.error("fetchStoreLogo: failed to read the theme logo", customError);
    return { url: null, canSaveOwnLogo };
  }
  return { url: custom?.logo_image_url ?? null, canSaveOwnLogo };
}

/** Convenience for callers that only need the picture (the public storefront). */
export async function fetchStoreLogoUrl(storeId: string): Promise<string | null> {
  return (await fetchStoreLogo(storeId)).url;
}

/** PostgREST reports an unknown column as 42703 (undefined_column) on a select,
 *  and PGRST204 on a write. Matched on codes rather than message text, which is
 *  not stable across versions. */
function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/** Persists a newly uploaded picture as the store's own logo.
 *
 *  A direct client update rather than an api.* route, deliberately. Every store
 *  API route goes through requireOwnStore, which resolves the seller's OLDEST
 *  store and ignores whichever one they are actually looking at (POSTPONED.md
 *  3.8) -- so a seller with two stores would upload a logo on store B and watch
 *  it appear on store A. This takes the active storeId from the caller and is
 *  correct by construction. It also matches how stores.theme_id and
 *  personal_storefront_only are already written, and it is what the drafted
 *  owns_store UPDATE policy is designed to authorise once RLS lands -- whereas a
 *  service-role route would bypass that policy and put the authorisation logic
 *  in a second place. */
export async function saveStoreLogoUrl(storeId: string, url: string): Promise<void> {
  // `as never` only because src/lib/integrations/my-supabase/types.ts is a
  // generated snapshot of the LIVE schema, and the migration adding this column
  // is applied by hand -- so the column is real in the migration but absent from
  // the snapshot until someone regenerates it. Delete the cast once types.ts is
  // regenerated; typecheck will then verify this payload properly again.
  const { error } = await supabase
    .from("stores")
    .update({ logo_url: url } as never)
    .eq("id", storeId);
  if (error) throw error;
}
