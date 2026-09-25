import { createFileRoute } from "@tanstack/react-router";
import { requireStoreOwner } from "@/lib/server-auth";

/**
 * Uploads a single Wardrobe/Gallery piece image to Bunny Storage and hands
 * back its public URL — same storage as api.products.upload-image.ts, just
 * under a `store-pieces/` prefix.
 *
 * Uses requireStoreOwner (a caller-supplied storeId, verified) rather than
 * requireOwnStore (the caller's oldest store): the "Add piece" entry point is
 * always launched from a specific store's public profile, so a seller with
 * more than one store must not have this silently land on the wrong one --
 * see POSTPONED.md §3.3 for the bug that exact shortcut already caused
 * elsewhere.
 *
 * POST multipart/form-data:
 *   file      an image   (required)
 *   storeId   the store this piece belongs to   (required)
 */

const MAX_BYTES = 15 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const Route = createFileRoute("/api/store-pieces/upload-image")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
        const password = process.env.BUNNY_STORAGE_PASSWORD;
        const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com";
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME;

        if (!zone || !password || !pullZone) {
          console.error("Store piece image upload: Bunny Storage is not configured");
          return Response.json({ error: "File storage is not configured" }, { status: 500 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        const storeId = form.get("storeId");
        if (typeof storeId !== "string" || !storeId) {
          return Response.json({ error: "storeId is required" }, { status: 400 });
        }

        const auth = await requireStoreOwner(request, storeId);
        if (!auth.ok) return auth.response;

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

        const remotePath = `store-pieces/${auth.value.storeId}/${crypto.randomUUID()}.${ext}`;

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
