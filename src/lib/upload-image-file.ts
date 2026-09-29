import { authedFetch } from "@/lib/authed-fetch";
import { prepareImage, type PreparedImage } from "@/lib/chat/media";

// Vercel refuses any function request body over 4.5 MB before our handler
// runs: a plain-text 413 FUNCTION_PAYLOAD_TOO_LARGE, or -- just over the line
// -- a connection that stalls and then dies, which fetch reports as a bare
// TypeError ("Load failed" on iOS, "Failed to fetch" on Chrome). An ordinary
// phone photo is 3-12 MB, so without this most seller uploads failed. The
// routes' own 15 MB MAX_BYTES never gets a say on Vercel.
//
// Headroom under 4.5 MB for the multipart envelope and the storeId field.
const MAX_UPLOAD_BYTES = 4_000_000;
/** Long edge for a photo that has to be shrunk. Larger than chat's 1600 --
 *  product photos get zoomed into -- and still ~1 MB as JPEG. */
const MAX_EDGE = 2560;
const SENDABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** The image as it should actually go over the wire. A file that's already
 *  small enough and in a format the upload routes accept goes untouched, so a
 *  transparent PNG logo keeps its transparency and a GIF keeps animating. Only
 *  an oversized photo, or one the routes would reject (HEIC from a desktop
 *  picker), is downscaled and re-encoded as JPEG. */
async function fitForUpload(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES && SENDABLE_TYPES.has(file.type)) return file;

  let prepared: PreparedImage;
  try {
    prepared = await prepareImage(file, { maxEdge: MAX_EDGE });
  } catch {
    throw new Error("Couldn't read that photo. Try a JPEG or PNG.");
  }
  if (prepared.blob.size > MAX_UPLOAD_BYTES) {
    // Only reachable for a GIF (passed through so it keeps animating) or a
    // canvas that failed to encode.
    throw new Error("That image is too large. Try one under 4 MB.");
  }
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([prepared.blob], `${base}.${prepared.extension}`, {
    type: prepared.blob.type,
  });
}

/** Shrinks `file` to fit (see fitForUpload), POSTs it to one of the
 *  api.*.upload-image routes, and returns the stored image's public URL --
 *  or throws with a message safe to show the seller. */
export async function uploadImageFile(
  endpoint: string,
  file: File,
  extraFields: Record<string, string> = {},
): Promise<string> {
  const form = new FormData();
  form.append("file", await fitForUpload(file));
  for (const [key, value] of Object.entries(extraFields)) form.append(key, value);

  let res: Response;
  try {
    res = await authedFetch(endpoint, { method: "POST", body: form });
  } catch {
    // A raw "TypeError: Load failed" means nothing to a seller.
    throw new Error("Upload interrupted. Check your connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 413) throw new Error(body.error ?? "That image is too large to upload.");
  if (!res.ok) throw new Error(body.error ?? "Couldn't upload that image");
  return body.url as string;
}
