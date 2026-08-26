import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

/**
 * Publishes a post from the after-shot editor: uploads the exported media (and,
 * for video, its poster frame) to Bunny Storage, writes the posts row, and tags
 * any of the caller's own products that were picked in the publish screen.
 *
 * POST multipart/form-data:
 *   file         the exported photo/video blob              (required)
 *   mediaType    'photo' | 'video'                           (required)
 *   thumbnail    poster frame blob, video only                (optional)
 *   caption      text                                         (optional)
 *   location     freeform text                                (optional)
 *   visibility   'public' | 'followers' | 'only_me'            (default 'public')
 *   status       'published' | 'draft'                        (default 'published')
 *   productIds   JSON array of product ids to tag              (optional)
 */

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES = new Set(["photo", "video"]);
const VISIBILITIES = new Set(["public", "followers", "only_me"]);
const STATUSES = new Set(["published", "draft"]);

async function uploadToBunny(remotePath: string, body: Blob, endpoint: string, zone: string, password: string) {
  const res = await fetch(`${endpoint.replace(/\/+$/, "")}/${zone}/${remotePath}`, {
    method: "PUT",
    headers: { AccessKey: password, "Content-Type": body.type || "application/octet-stream" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Bunny upload failed:", res.status, text.slice(0, 300));
    return null;
  }
  return remotePath;
}

export const Route = createFileRoute("/api/posts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
        const password = process.env.BUNNY_STORAGE_PASSWORD;
        const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com";
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME;

        if (!zone || !password || !pullZone) {
          console.error("Post publish: Bunny Storage is not configured");
          return Response.json({ error: "File storage is not configured" }, { status: 500 });
        }

        const user = await getRequestUser(request);
        if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        const file = form.get("file");
        const mediaType = form.get("mediaType") as string;
        const thumbnail = form.get("thumbnail");
        const caption = (form.get("caption") as string | null)?.trim() || null;
        const location = (form.get("location") as string | null)?.trim() || null;
        const visibility = (form.get("visibility") as string) || "public";
        const status = (form.get("status") as string) || "published";
        const productIdsRaw = form.get("productIds") as string | null;

        if (!(file instanceof File)) {
          return Response.json({ error: "file is required" }, { status: 400 });
        }
        if (!MEDIA_TYPES.has(mediaType)) {
          return Response.json({ error: "mediaType must be 'photo' or 'video'" }, { status: 400 });
        }
        if (!VISIBILITIES.has(visibility)) {
          return Response.json({ error: "Invalid visibility" }, { status: 400 });
        }
        if (!STATUSES.has(status)) {
          return Response.json({ error: "Invalid status" }, { status: 400 });
        }
        if (file.size === 0) {
          return Response.json({ error: "File is empty" }, { status: 400 });
        }
        if (file.size > MAX_MEDIA_BYTES) {
          return Response.json(
            { error: `File is over the ${MAX_MEDIA_BYTES / 1024 / 1024} MB limit` },
            { status: 413 },
          );
        }
        if (thumbnail instanceof File && thumbnail.size > MAX_THUMBNAIL_BYTES) {
          return Response.json({ error: "Thumbnail is too large" }, { status: 413 });
        }

        let productIds: string[] = [];
        if (productIdsRaw) {
          try {
            const parsed = JSON.parse(productIdsRaw);
            if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
              productIds = parsed;
            }
          } catch {
            return Response.json({ error: "productIds must be a JSON array of strings" }, { status: 400 });
          }
        }

        const postId = crypto.randomUUID();
        const mediaExt = mediaType === "video" ? "mp4" : "jpg";
        const mediaPath = `posts/${user.id}/${postId}/media.${mediaExt}`;

        const uploadedMedia = await uploadToBunny(mediaPath, file, endpoint, zone, password);
        if (!uploadedMedia) {
          return Response.json({ error: "Could not store the uploaded media" }, { status: 502 });
        }

        let thumbnailUrl: string | null = null;
        if (thumbnail instanceof File && thumbnail.size > 0) {
          const thumbPath = `posts/${user.id}/${postId}/thumbnail.jpg`;
          const uploadedThumb = await uploadToBunny(thumbPath, thumbnail, endpoint, zone, password);
          if (uploadedThumb) thumbnailUrl = `https://${pullZone}/${uploadedThumb}`;
        }

        const { supabaseAdmin: supabase } =
          await import("@/lib/integrations/my-supabase/client.server");

        const { data: post, error } = await supabase
          .from("posts")
          .insert({
            id: postId,
            user_id: user.id,
            media_url: `https://${pullZone}/${uploadedMedia}`,
            media_type: mediaType,
            thumbnail_url: thumbnailUrl,
            caption,
            location,
            visibility,
            status,
          })
          .select("id, status")
          .single();

        if (error) {
          console.error("Failed to create post:", error.message);
          return Response.json({ error: "Something went wrong" }, { status: 500 });
        }

        // Only tag products the caller actually owns -- productIds is
        // client-supplied and admin bypasses RLS, so this is the only check.
        // Two queries rather than an embedded-filter join, since PostgREST's
        // dot-path filters on embedded resources don't type-check cleanly
        // against the generated types.
        if (productIds.length > 0) {
          const { data: ownedStores, error: storesError } = await supabase
            .from("stores")
            .select("id")
            .eq("owner_id", user.id);

          if (storesError) {
            console.error("Failed to look up owned stores for tags:", storesError.message);
          } else if (ownedStores && ownedStores.length > 0) {
            const storeIds = ownedStores.map((s) => s.id);
            const { data: ownedProducts, error: productsError } = await supabase
              .from("products")
              .select("id")
              .in("id", productIds)
              .in("store_id", storeIds);

            if (productsError) {
              console.error("Failed to verify product ownership for tags:", productsError.message);
            } else if (ownedProducts && ownedProducts.length > 0) {
              const tagRows = ownedProducts.map((p) => ({ post_id: post.id, product_id: p.id }));
              const { error: tagsError } = await supabase.from("post_product_tags").insert(tagRows);
              if (tagsError) console.error("Failed to insert product tags:", tagsError.message);
            }
          }
        }

        return Response.json({ id: post.id, status: post.status }, { status: 201 });
      },
    },
  },
});
