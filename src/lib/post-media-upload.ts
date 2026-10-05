import { authedFetch } from "@/lib/authed-fetch";

// Gets a post's media into Bunny BEFORE the post is created, one file at a
// time, so no single request is anywhere near Vercel's 4.5 MB body limit:
//
// - photos and the poster frame: one request each to /api/post-media, which
//   stores them in Bunny Storage (our server holds the Storage password, so
//   it has to be the one doing the PUT);
// - videos: straight from the phone to Bunny Stream over TUS, using a
//   one-video signature from /api/post-video. Their bytes never touch us.
//
// /api/posts then gets only URLs and video ids (see post-upload.ts).

/** Under /api/post-media's 4 MB cap with room for the multipart envelope. */
const PHOTO_MAX_BYTES = 3.8 * 1024 * 1024;
const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
const TUS_CHUNK_BYTES = 5 * 1024 * 1024;
const TUS_ATTEMPTS = 4;

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error || fallback);
}

/** Re-encodes a photo that's over the cap: long edge to 2560px, then lower
 *  JPEG quality / size until it fits. Photos already under it go untouched. */
async function shrinkPhoto(blob: Blob): Promise<Blob> {
  const okType = ["image/jpeg", "image/png", "image/webp"].includes(blob.type);
  if (okType && blob.size <= PHOTO_MAX_BYTES) return blob;

  const bitmap = await createImageBitmap(blob);
  let edge = Math.min(2560, Math.max(bitmap.width, bitmap.height));
  let quality = 0.86;
  for (let i = 0; i < 8; i++) {
    const scale = edge / Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (out && out.size <= PHOTO_MAX_BYTES) {
      bitmap.close();
      return out;
    }
    if (quality > 0.7) quality -= 0.08;
    else edge = Math.round(edge * 0.8);
  }
  bitmap.close();
  throw new Error("That photo is too large to upload");
}

/** Stores one photo (or the poster frame) and returns its URL. */
export async function uploadPostPhoto(
  blob: Blob,
  uploadId: string,
  name: string,
): Promise<{ url: string; bytes: number }> {
  const file = await shrinkPhoto(blob);
  const fd = new FormData();
  fd.set("file", file, `${name}.jpg`);
  fd.set("uploadId", uploadId);
  fd.set("name", name);
  const res = await authedFetch("/api/post-media", { method: "POST", body: fd });
  if (!res.ok) throw await errorFrom(res, "Could not upload a photo");
  return (await res.json()) as { url: string; bytes: number };
}

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

/** Uploads one video straight to Bunny Stream and returns its video id. */
export async function uploadPostVideo(
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<{ videoId: string; bytes: number }> {
  const res = await authedFetch("/api/post-video", { method: "POST" });
  if (!res.ok) throw await errorFrom(res, "Could not start the video upload");
  const { libraryId, videoId, expires, signature } = (await res.json()) as {
    libraryId: string;
    videoId: string;
    expires: number;
    signature: string;
  };
  const auth = {
    AuthorizationSignature: signature,
    AuthorizationExpire: String(expires),
    VideoId: videoId,
    LibraryId: String(libraryId),
    "Tus-Resumable": "1.0.0",
  };

  // TUS create: announces the size, returns where to PATCH the bytes.
  const create = await fetch(TUS_ENDPOINT, {
    method: "POST",
    headers: {
      ...auth,
      "Upload-Length": String(blob.size),
      "Upload-Metadata": `filetype ${b64(blob.type || "video/mp4")},title ${b64(videoId)}`,
    },
  });
  const location = create.headers.get("Location");
  if (!create.ok || !location) throw new Error("Could not start the video upload");
  const uploadUrl = new URL(location, TUS_ENDPOINT).toString();

  // Chunked so a dropped connection costs one chunk, not the whole video.
  // After a failed PATCH, HEAD asks the server how far it actually got.
  let offset = 0;
  while (offset < blob.size) {
    const chunk = blob.slice(offset, offset + TUS_CHUNK_BYTES);
    let done = false;
    for (let attempt = 1; attempt <= TUS_ATTEMPTS && !done; attempt++) {
      try {
        const patch = await fetch(uploadUrl, {
          method: "PATCH",
          headers: {
            ...auth,
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
          },
          body: chunk,
        });
        if (!patch.ok) throw new Error(String(patch.status));
        offset = Number(patch.headers.get("Upload-Offset") ?? offset + chunk.size);
        done = true;
      } catch {
        if (attempt === TUS_ATTEMPTS) throw new Error("The video upload kept failing");
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        const head = await fetch(uploadUrl, { method: "HEAD", headers: auth }).catch(() => null);
        const serverOffset = Number(head?.headers.get("Upload-Offset"));
        if (Number.isFinite(serverOffset) && serverOffset !== offset) {
          offset = serverOffset;
          done = true; // continue from where the server is
        }
      }
    }
    onProgress?.(offset / blob.size);
  }
  return { videoId, bytes: blob.size };
}
