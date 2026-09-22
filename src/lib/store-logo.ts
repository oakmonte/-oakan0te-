import { supabase } from "@/lib/integrations/my-supabase/client";

/** The slug useStoreTheme falls back to when stores.theme_id is null.
 *
 *  Not a guess, and not cosmetic. useStoreTheme defaults an unset theme_id to
 *  "motion" on the client and never writes it back, so a seller who has never
 *  opened the theme picker still has real customisations saved under this slug.
 *  Skip the fallback and their logo disappears -- which is the most common case,
 *  not an edge one. */
const DEFAULT_THEME_SLUG = "motion";

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
 *  One place rather than two because the dashboard and the public storefront
 *  both need this answer and must not disagree about the same store.
 *
 *  TOLERATES THE COLUMN NOT EXISTING YET. The migration adding logo_url is
 *  applied by hand, so until it runs a select naming that column errors. Rather
 *  than gate this on a flag someone has to remember to flip, the first query is
 *  allowed to fail and we fall through to the theme logo -- which is exactly the
 *  behaviour the app has today. Once the column lands, the same code starts
 *  preferring it with no edit. */
export async function fetchStoreLogoUrl(storeId: string): Promise<string | null> {
  const themeSlug = await fetchStoreThemeSlug(storeId);

  const { data, error } = await supabase
    .from("stores")
    .select("logo_url")
    .eq("id", storeId)
    .maybeSingle();

  if (!error) {
    const ownLogo = (data as { logo_url?: string | null } | null)?.logo_url;
    if (ownLogo) return ownLogo;
  } else if (!isMissingColumnError(error)) {
    // A real failure (network, RLS) is worth knowing about. A missing column is
    // expected until the migration is applied and would be pure noise.
    console.error("fetchStoreLogoUrl: failed to read stores.logo_url", error);
  }

  const { data: custom, error: customError } = await supabase
    .from("store_theme_customizations")
    .select("logo_image_url")
    .eq("store_id", storeId)
    .eq("theme_slug", themeSlug)
    .maybeSingle();

  if (customError) {
    console.error("fetchStoreLogoUrl: failed to read the theme logo", customError);
    return null;
  }
  return custom?.logo_image_url ?? null;
}

async function fetchStoreThemeSlug(storeId: string): Promise<string> {
  const { data } = await supabase
    .from("stores")
    .select("store_themes(slug)")
    .eq("id", storeId)
    .maybeSingle();
  return data?.store_themes?.slug ?? DEFAULT_THEME_SLUG;
}

/** PostgREST reports an unknown column as 42703 (undefined_column). Matched on
 *  the code rather than the message, which is not stable across versions. */
function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === "42703";
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
  // is applied by hand -- so the column is real in the file but absent from the
  // snapshot until someone regenerates it. Delete the cast the moment types.ts
  // is regenerated; typecheck will then verify this payload properly again.
  const { error } = await supabase
    .from("stores")
    .update({ logo_url: url } as never)
    .eq("id", storeId);
  if (error) throw error;
}
