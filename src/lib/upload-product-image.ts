import { uploadImageFile } from "@/lib/upload-image-file";

/** Uploads one image to Bunny Storage via /api/products/upload-image and
 *  returns its public URL, or throws with a message safe to show the seller. */
export function uploadProductImage(file: File): Promise<string> {
  return uploadImageFile("/api/products/upload-image", file);
}
