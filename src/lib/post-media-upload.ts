import { authedFetch } from "@/lib/authed-fetch";
import { fitForUpload } from "@/lib/upload-image-file";

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

const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
const TUS_CHUNK_BYTES = 5 * 1024 * 1024;
const TUS_ATTEMPTS = 4;

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error || fallback);
}

/** Stores one photo (or the poster frame) and returns its URL. */
export async function uploadPostPhoto(
  blob: Blob,
  uploadId: string,
  name: string,
): Promise<{ url: string; bytes: number }> {
  // Same shrink-to-fit the product and theme image uploads use: anything
  // over 4 MB (or not JPEG/PNG/WEBP/GIF) is downscaled and re-encoded.
  const file = await fitForUpload(new File([blob], `${name}.jpg`, { type: blob.type }));
  const fd = new FormData();
  fd.set("file", file);
  fd.set("uploadId", uploadId);
  fd.set("name", name);
  const res = await authedFetch("/api/post-media", { method: "POST", body: fd });
  if (!res.ok) throw await errorFrom(res, "Could not upload a photo");
  return (await res.json()) as { url: string; bytes: number };
}

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

// A posted video is uploaded as-is when it has no edits (exportComposite
// hands back the original capture), and an iPhone's 4K original runs ~30
// Mbps: a 3-second clip was 11.8 MB and took ~90 s to upload on mobile data.
// Bunny re-encodes to at most 1080p for playback anyway, so anything above
// 1080p or SHRINK_ABOVE_BPS is re-encoded here first, to 1080p at
// TARGET_BPS -- a second or two on the phone's hardware encoder, several
// times less to send. Any failure just uploads the original.
const SHRINK_ABOVE_BPS = 6_000_000;
const TARGET_BPS = 5_000_000;
const MAX_SHORT_EDGE = 1080;

async function shrinkVideo(blob: Blob): Promise<Blob> {
  try {
    // Loaded here, not at the top: this module is reachable from the global
    // upload toast, and mediabunny must stay out of the shared bundle.
    const { Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget, Mp4OutputFormat } =
      await import("mediabunny");
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const duration = await input.computeDuration();
    if (!track || !(duration > 0)) return blob;
    const w = track.displayWidth;
    const h = track.displayHeight;
    const shortEdge = Math.min(w, h);
    const bps = (blob.size * 8) / duration;
    if (bps <= SHRINK_ABOVE_BPS && shortEdge <= MAX_SHORT_EDGE) return blob;

    const target = new BufferTarget();
    const conversion = await Conversion.init({
      input,
      output: new Output({ format: new Mp4OutputFormat(), target }),
      video: {
        // Scale the SHORT edge to 1080, whichever way round the clip is.
        ...(shortEdge > MAX_SHORT_EDGE
          ? w <= h
            ? { width: MAX_SHORT_EDGE }
            : { height: MAX_SHORT_EDGE }
          : {}),
        codec: "avc",
        bitrate: TARGET_BPS,
        forceTranscode: true,
      },
    });
    if (!conversion.isValid) return blob;
    await conversion.execute();
    if (!target.buffer || target.buffer.byteLength >= blob.size) return blob;
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (err) {
    console.warn("Video shrink failed, uploading the original", err);
    return blob;
  }
}

/** Uploads one video straight to Bunny Stream and returns its video id. */
export async function uploadPostVideo(
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<{ videoId: string; bytes: number }> {
  blob = await shrinkVideo(blob);
  const res = await authedFetch("/api/post-video", { method: "POST" });
  if (!res.ok) throw await errorFrom(res, "Could not start the video upload");
  const { libraryId, videoId, title, expires, signature } = (await res.json()) as {
    libraryId: string;
    videoId: string;
    title: string;
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
      "Upload-Metadata": `filetype ${b64(blob.type || "video/mp4")},title ${b64(title)}`,
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
