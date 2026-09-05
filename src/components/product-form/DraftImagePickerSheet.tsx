import { MediaPickerSheet, type PickedMedia } from "./MediaPickerSheet";

/** The user's draft posts. A thin binding over MediaPickerSheet, kept as its
 *  own name because the product form and the editors both read better calling
 *  the thing they actually mean. */
export function DraftImagePickerSheet({
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
      source="drafts"
      include={include}
      multiple={multiple}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
