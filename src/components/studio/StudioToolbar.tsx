import {
  Copy,
  Crop,
  Gauge,
  Image as ImageIcon,
  Music2,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Type,
  Unlink,
  Volume2,
  Blend,
} from "lucide-react";
import { ToolButton } from "./controls";

// Two rows, exactly as the reference behaves: the project-level tools until you
// touch a clip, then the clip's own tools. Both scroll horizontally rather than
// wrapping — an editor toolbar that reflows onto two lines moves every button
// under your thumb the moment a new one appears.

export type PrimaryTool = "edit" | "sound" | "text" | "tags" | "canvas" | "cover";
export type ClipTool =
  | "split"
  | "speed"
  | "volume"
  | "separate"
  | "filters"
  | "adjust"
  | "transition"
  | "duplicate"
  | "delete";

const ROW = "flex items-center gap-2 overflow-x-auto px-3 py-2 [&::-webkit-scrollbar]:hidden";

export function PrimaryToolbar({ onPick }: { onPick: (tool: PrimaryTool) => void }) {
  return (
    <div className={ROW}>
      <ToolButton label="Edit" icon={<Scissors size={18} />} onClick={() => onPick("edit")} />
      <ToolButton label="Sound" icon={<Music2 size={18} />} onClick={() => onPick("sound")} />
      <ToolButton label="Text" icon={<Type size={18} />} onClick={() => onPick("text")} />
      <ToolButton label="Tags" icon={<Tag size={18} />} onClick={() => onPick("tags")} />
      <ToolButton label="Canvas" icon={<Crop size={18} />} onClick={() => onPick("canvas")} />
      <ToolButton label="Cover" icon={<ImageIcon size={18} />} onClick={() => onPick("cover")} />
    </div>
  );
}

export function ClipToolbar({
  onPick,
  canDetach,
  canDelete,
  isFirstClip,
}: {
  onPick: (tool: ClipTool) => void;
  canDetach: boolean;
  canDelete: boolean;
  isFirstClip: boolean;
}) {
  return (
    <div className={ROW}>
      <ToolButton label="Split" icon={<Scissors size={18} />} onClick={() => onPick("split")} />
      <ToolButton label="Speed" icon={<Gauge size={18} />} onClick={() => onPick("speed")} />
      <ToolButton label="Volume" icon={<Volume2 size={18} />} onClick={() => onPick("volume")} />
      <ToolButton
        label="Separate"
        icon={<Unlink size={18} />}
        onClick={() => onPick("separate")}
        disabled={!canDetach}
      />
      <ToolButton label="Filters" icon={<Blend size={18} />} onClick={() => onPick("filters")} />
      <ToolButton
        label="Adjust"
        icon={<SlidersHorizontal size={18} />}
        onClick={() => onPick("adjust")}
      />
      <ToolButton
        label="Transition"
        icon={<Sparkles size={18} />}
        onClick={() => onPick("transition")}
        disabled={isFirstClip}
      />
      <ToolButton label="Copy" icon={<Copy size={18} />} onClick={() => onPick("duplicate")} />
      <ToolButton
        label="Delete"
        icon={<Trash2 size={18} />}
        onClick={() => onPick("delete")}
        disabled={!canDelete}
        tone="danger"
      />
    </div>
  );
}
