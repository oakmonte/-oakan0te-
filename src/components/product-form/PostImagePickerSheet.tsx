import { MediaPickerSheet, type PickedMedia } from "./MediaPickerSheet";

/** The user's published posts. See DraftImagePickerSheet for why these stay
 *  as named bindings rather than callers reaching for MediaPickerSheet. */
export function PostImagePickerSheet({
  multiple = true,
  include = "photos",
  onSelect,
  onClose,
}: {
  multiple?: boolean;
  include?: "photos" | "all";
  onSelect: (media: PickedMedia[]) => void;
  onClose: () => void;
}) {
  return (
    <MediaPickerSheet
      source="posts"
      include={include}
      multiple={multiple}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
