import { uploadImageFile } from "@/lib/upload-image-file";

/** Uploads one store-theme customization image (logo or slideshow photo) to
 *  Bunny Storage via /api/store-theme/upload-image and returns its public
 *  URL, or throws with a message safe to show the seller. */
export function uploadStoreThemeImage(file: File): Promise<string> {
  return uploadImageFile("/api/store-theme/upload-image", file);
}
