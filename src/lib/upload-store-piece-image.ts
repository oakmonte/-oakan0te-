import { uploadImageFile } from "@/lib/upload-image-file";

/** Uploads one Wardrobe/Gallery piece image to Bunny Storage via
 *  /api/store-pieces/upload-image and returns its public URL, or throws with
 *  a message safe to show the seller. `storeId` is required server-side too
 *  (see that route's doc comment) so a piece can't land on the wrong store
 *  for a seller with more than one. */
export function uploadStorePieceImage(file: File, storeId: string): Promise<string> {
  return uploadImageFile("/api/store-pieces/upload-image", file, { storeId });
}
