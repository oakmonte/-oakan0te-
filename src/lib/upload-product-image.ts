import { authedFetch } from "@/lib/authed-fetch";

/** Uploads one image to Bunny Storage via /api/products/upload-image and
 *  returns its public URL, or throws with a message safe to show the seller. */
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await authedFetch("/api/products/upload-image", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't upload that image");
  return body.url as string;
}
