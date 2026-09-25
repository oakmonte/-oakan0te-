import { authedFetch } from "@/lib/authed-fetch";

/** Uploads one Wardrobe/Gallery piece image to Bunny Storage via
 *  /api/store-pieces/upload-image and returns its public URL, or throws with
 *  a message safe to show the seller. `storeId` is required server-side too
 *  (see that route's doc comment) so a piece can't land on the wrong store
 *  for a seller with more than one. */
export async function uploadStorePieceImage(file: File, storeId: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("storeId", storeId);
  const res = await authedFetch("/api/store-pieces/upload-image", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't upload that image");
  return body.url as string;
}
