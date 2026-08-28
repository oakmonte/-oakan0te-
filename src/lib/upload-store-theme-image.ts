import { authedFetch } from "@/lib/authed-fetch";

/** Uploads one store-theme customization image (logo or slideshow photo) to
 *  Bunny Storage via /api/store-theme/upload-image and returns its public
 *  URL, or throws with a message safe to show the seller. */
export async function uploadStoreThemeImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await authedFetch("/api/store-theme/upload-image", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't upload that image");
  return body.url as string;
}
