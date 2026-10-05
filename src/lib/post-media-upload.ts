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
  name: string,
): Promise<{ url: string; bytes: number }> {
  // Same shrink-to-fit the product and theme image uploads use: anything
  // over 4 MB (or not JPEG/PNG/WEBP/GIF) is downscaled and re-encoded.
  const file = await fitForUpload(new File([blob], `${name}.jpg`, { type: blob.type }));
  const fd = new FormData();
  fd.set("file", file);
  fd.set("name", name);
  const res = await authedFetch("/api/post-media", { method: "POST", body: fd });
  if (!res.ok) throw await errorFrom(res, "Could not upload a photo");
  return (await res.json()) as { url: string; bytes: number };
}

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

// The uploaded file IS what the feed plays (api.posts.ts serves Bunny's
// /original, not a re-encode), so it has to be a universally playable,
// reasonably sized H.264 MP4. The in-app camera already records exactly that
// (720p / 5 Mbps, create.index.tsx) and goes up untouched. Anything else --
// a 4K or HEVC gallery clip, a WebM from an older Android, an oversized
// bitrate -- is re-encoded here first to H.264 at 720p on its short edge.
// A second or two on the phone's hardware encoder; any failure uploads the
// original as-is.
//
// Files that are already fine are still REMUXED (packets copied, nothing
// re-encoded, near-instant) with the metadata dropped: a phone's gallery
// clip carries its GPS location in container tags, and viewers download
// this exact file.
const SHRINK_ABOVE_BPS = 6_000_000;
const TARGET_BPS = 4_500_000;
const MAX_SHORT_EDGE = 720;
/** Short edges up to this are left alone when nothing else is wrong -- a
 *  1080p back-camera recording is fine to play as-is. */
const KEEP_SHORT_EDGE = 1080;

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
    const playable = track.codec === "avc" && (await input.getMimeType()).startsWith("video/mp4");
    const reencode = !(playable && bps <= SHRINK_ABOVE_BPS && shortEdge <= KEEP_SHORT_EDGE);

    const target = new BufferTarget();
    const conversion = await Conversion.init({
      input,
      output: new Output({ format: new Mp4OutputFormat(), target }),
      // No metadata carried over (location, device, dates).
      tags: {},
      video: reencode
        ? {
            // Scale the SHORT edge to 720, whichever way round the clip is.
            ...(shortEdge > MAX_SHORT_EDGE
              ? w <= h
                ? { width: MAX_SHORT_EDGE }
                : { height: MAX_SHORT_EDGE }
              : {}),
            codec: "avc",
            bitrate: TARGET_BPS,
            forceTranscode: true,
          }
        : {},
    });
    if (!conversion.isValid) return blob;
    await conversion.execute();
    if (!target.buffer) return blob;
    // A re-encode of a file that was already playable but somehow came out
    // bigger isn't worth it; an unplayable original (HEVC, WebM) is replaced
    // whatever the size.
    if (reencode && playable && target.buffer.byteLength >= blob.size) return blob;
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (err) {
    console.warn("Video shrink failed, uploading the original", err);
    return blob;
  }
}

/** A JPEG poster from near the start of a video, made on the phone so a
 *  fresh post's grid tile and feed card show a picture immediately instead
 *  of black while Bunny generates its own thumbnail. null if the browser
 *  can't produce one -- the post still goes out. */
export async function posterFromVideo(blob: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video load failed"));
      setTimeout(() => reject(new Error("video load timed out")), 8000);
    });
    // A hair past 0: frame 0 of a phone recording is often black or still
    // adjusting exposure.
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Math.min(0.3, (video.duration || 1) / 2);
      setTimeout(resolve, 3000);
    });
    const scale = Math.min(1, 1080 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
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
