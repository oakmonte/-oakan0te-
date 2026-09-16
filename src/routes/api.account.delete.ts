import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { getRequestUser } from "@/lib/server-auth";

// profiles.id cascades to stores/creators/curators/follows/posts (verified via
// information_schema against the live project — no migration file defines
// these, they predate migration tracking). Everything under a store ALSO
// cascades from stores.id except products, import_jobs, tags and
// store_locations, which are NO ACTION — deleting a store that still has any
// of those left in it fails with a foreign key violation instead of silently
// cascading.
//
// store_locations was missed when this was written, so deleting the account of
// any seller who had added a location failed outright with a 500 (found
// 2026-09-16 deleting a real account). The list above is now the full result
// of the information_schema query, not a remembered subset — re-run it if a
// new child table lands under stores. product_tags is
// NO ACTION on both sides, so it has to go before either products or tags.
// Deleting products first (which cascades product_variants, product_options,
// product_collections, product_size_measurements, post_product_tags) then
// clears the one thing tags' own NO ACTION constraint was guarding against.
//
// Not handled: files already sitting in the avatars/product-image storage
// buckets. Storage objects aren't covered by SQL foreign keys, so this leaves
// orphaned files behind — acceptable for now (pre-launch, no storage quota
// pressure yet), but worth a follow-up before launch.
export const Route = createFileRoute("/api/account/delete")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        if (!user) {
          return Response.json({ error: "Not signed in" }, { status: 401 });
        }

        const { data: stores, error: storesError } = await supabaseAdmin
          .from("stores")
          .select("id")
          .eq("owner_id", user.id);
        if (storesError) {
          console.error("account delete: failed to list stores", storesError);
          return Response.json({ error: "Could not delete account" }, { status: 500 });
        }
        const storeIds = (stores ?? []).map((s) => s.id);

        if (storeIds.length > 0) {
          const { data: products, error: productsError } = await supabaseAdmin
            .from("products")
            .select("id")
            .in("store_id", storeIds);
          if (productsError) {
            console.error("account delete: failed to list products", productsError);
            return Response.json({ error: "Could not delete account" }, { status: 500 });
          }
          const productIds = (products ?? []).map((p) => p.id);

          const { data: tags, error: tagsError } = await supabaseAdmin
            .from("tags")
            .select("id")
            .in("store_id", storeIds);
          if (tagsError) {
            console.error("account delete: failed to list tags", tagsError);
            return Response.json({ error: "Could not delete account" }, { status: 500 });
          }
          const tagIds = (tags ?? []).map((t) => t.id);

          if (productIds.length > 0 || tagIds.length > 0) {
            const { error: productTagsError } = await supabaseAdmin
              .from("product_tags")
              .delete()
              .or(
                [
                  productIds.length > 0 ? `product_id.in.(${productIds.join(",")})` : null,
                  tagIds.length > 0 ? `tag_id.in.(${tagIds.join(",")})` : null,
                ]
                  .filter(Boolean)
                  .join(","),
              );
            if (productTagsError) {
              console.error("account delete: failed to clear product_tags", productTagsError);
              return Response.json({ error: "Could not delete account" }, { status: 500 });
            }
          }

          const { error: locationsError } = await supabaseAdmin
            .from("store_locations")
            .delete()
            .in("store_id", storeIds);
          if (locationsError) {
            console.error("account delete: failed to clear store_locations", locationsError);
            return Response.json({ error: "Could not delete account" }, { status: 500 });
          }

          const { error: importJobsError } = await supabaseAdmin
            .from("import_jobs")
            .delete()
            .in("store_id", storeIds);
          if (importJobsError) {
            console.error("account delete: failed to clear import_jobs", importJobsError);
            return Response.json({ error: "Could not delete account" }, { status: 500 });
          }

          const { error: productsDeleteError } = await supabaseAdmin
            .from("products")
            .delete()
            .in("store_id", storeIds);
          if (productsDeleteError) {
            console.error("account delete: failed to delete products", productsDeleteError);
            return Response.json({ error: "Could not delete account" }, { status: 500 });
          }

          const { error: tagsDeleteError } = await supabaseAdmin
            .from("tags")
            .delete()
            .in("store_id", storeIds);
          if (tagsDeleteError) {
            console.error("account delete: failed to delete tags", tagsDeleteError);
            return Response.json({ error: "Could not delete account" }, { status: 500 });
          }
        }

        // Cascades stores, creators, curators, follows, posts.
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", user.id);
        if (profileError) {
          console.error("account delete: failed to delete profile", profileError);
          return Response.json({ error: "Could not delete account" }, { status: 500 });
        }

        // Last — revokes the login itself. If this throws, the account's data
        // is already gone but the auth user survives, which is the safer
        // failure mode (support can still find the account to finish the job)
        // than the reverse order leaving unreachable auth-only ghost data.
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (authError) {
          console.error("account delete: failed to delete auth user", authError);
          return Response.json({ error: "Could not delete account" }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
