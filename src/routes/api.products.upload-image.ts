import { createFileRoute } from "@tanstack/react-router";
import { requireOwnStore } from "@/lib/server-auth";

/**
 * Uploads a single product/variant image to Bunny Storage and hands back its
 * public URL — the same storage the post-publish flow uses (api.posts.ts),
 * just under a `products/` prefix instead of `posts/`. The product form
 * stores plain URLs on `product_variants.main_image_url` /
 * `additional_image_urls`, so this is the only server involvement a seller
 * picking a photo from their device needs.
 *
 * POST multipart/form-data:
 *   file   an image                (required)
 */

const MAX_BYTES = 15 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const Route = createFileRoute("/api/products/upload-image")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
        const password = process.env.BUNNY_STORAGE_PASSWORD;
        const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com";
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME;

        if (!zone || !password || !pullZone) {
          console.error("Product image upload: Bunny Storage is not configured");
          return Response.json({ error: "File storage is not configured" }, { status: 500 });
        }

        // Derives the store from the caller's own session — nothing here is
        // client-tamperable, same reasoning as api.store.payout.ts.
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        const file = form.get("file");
        if (!(file instanceof File)) {
          return Response.json({ error: "file is required" }, { status: 400 });
        }
        if (file.size === 0) {
          return Response.json({ error: "File is empty" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json(
            { error: `File is over the ${MAX_BYTES / 1024 / 1024} MB limit` },
            { status: 413 },
          );
        }
        const ext = EXT_BY_TYPE[file.type];
        if (!ext) {
          return Response.json(
            { error: "Only JPEG, PNG, WEBP or GIF images are supported" },
            { status: 400 },
          );
        }

        const remotePath = `products/${auth.value.storeId}/${crypto.randomUUID()}.${ext}`;

        const uploadRes = await fetch(`${endpoint.replace(/\/+$/, "")}/${zone}/${remotePath}`, {
          method: "PUT",
          headers: { AccessKey: password, "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.text().catch(() => "");
          console.error("Bunny upload failed:", uploadRes.status, body.slice(0, 300));
          return Response.json({ error: "Could not store the uploaded image" }, { status: 502 });
        }

        return Response.json({ url: `https://${pullZone}/${remotePath}` }, { status: 201 });
      },
    },
  },
});
