import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

/**
 * Stores ONE image for a post that's being published -- a carousel photo or a
 * video's poster frame -- in Bunny Storage, and returns its public URL. The
 * post itself is created afterwards by /api/posts, which only accepts URLs
 * under this caller's own folder.
 *
 * One file per request on purpose: Vercel refuses any request body over
 * 4.5 MB before our code runs, so the old "every file in one multipart
 * request" publish failed for any real video and for big carousels. Videos
 * don't come here at all -- they go straight from the phone to Bunny Stream
 * (see api.post-video.ts). The client shrinks a photo to under MAX_BYTES
 * before sending (post-upload.ts).
 *
 * POST multipart/form-data:
 *   file      the image (JPEG/PNG/WEBP)       (required)
 *   uploadId  uuid shared by one post's files (required)
 *   name      e.g. "media-0" or "thumbnail"   (required)
 */

const MAX_BYTES = 4 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME = /^(media-\d{1,2}|thumbnail)$/;

export const Route = createFileRoute("/api/post-media")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
        const password = process.env.BUNNY_STORAGE_PASSWORD;
        const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com";
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME;
        if (!zone || !password || !pullZone) {
          console.error("Post media upload: Bunny Storage is not configured");
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
        const uploadId = String(form.get("uploadId") ?? "");
        const name = String(form.get("name") ?? "");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "file is required" }, { status: 400 });
        }
        if (!UUID.test(uploadId) || !NAME.test(name)) {
          return Response.json({ error: "Invalid upload" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: "That photo is too large" }, { status: 413 });
        }
        const ext = EXT_BY_TYPE[file.type];
        if (!ext) return Response.json({ error: "Unsupported image type" }, { status: 400 });

        const remotePath = `posts/${user.id}/${uploadId}/${name}.${ext}`;
        const res = await fetch(`${endpoint.replace(/\/+$/, "")}/${zone}/${remotePath}`, {
          method: "PUT",
          headers: { AccessKey: password, "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("Bunny upload failed:", res.status, text.slice(0, 300));
          return Response.json({ error: "Could not store the photo" }, { status: 502 });
        }
        return Response.json({ url: `https://${pullZone}/${remotePath}`, bytes: file.size });
      },
    },
  },
});
