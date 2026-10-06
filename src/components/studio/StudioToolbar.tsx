import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  Gauge,
  Image as ImageIcon,
  Music2,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Tag,
  Trash2,
  Type,
  Unlink,
  Volume2,
  Blend,
  Sticker as StickerIcon,
} from "lucide-react";
import { ToolButton } from "./controls";

// Two rows, exactly as the reference behaves: the project-level tools until you
// touch a clip, then the clip's own tools. Both scroll horizontally rather than
// wrapping — an editor toolbar that reflows onto two lines moves every button
// under your thumb the moment a new one appears.

export type PrimaryTool = "edit" | "sound" | "text" | "sticker" | "tags" | "canvas" | "cover";
export type ClipTool =
  | "split"
  | "speed"
  | "volume"
  | "separate"
  | "filters"
  | "adjust"
  | "transition"
  | "moveLeft"
  | "moveRight"
  | "duplicate"
  | "delete";

const ROW = "flex items-center gap-2 overflow-x-auto px-3 py-2 [&::-webkit-scrollbar]:hidden";

export function PrimaryToolbar({ onPick }: { onPick: (tool: PrimaryTool) => void }) {
  return (
    <div className={ROW}>
      {/* Not scissors: Split further down the clip toolbar is the scissors, and
          two different actions sharing one glyph is how people learn to distrust
          a toolbar. */}
      <ToolButton label="Edit" icon={<SquarePen size={18} />} onClick={() => onPick("edit")} />
      <ToolButton label="Sound" icon={<Music2 size={18} />} onClick={() => onPick("sound")} />
      <ToolButton label="Text" icon={<Type size={18} />} onClick={() => onPick("text")} />
      <ToolButton
        label="Stickers"
        icon={<StickerIcon size={18} />}
        onClick={() => onPick("sticker")}
      />
      <ToolButton label="Product tag" icon={<Tag size={18} />} onClick={() => onPick("tags")} />
      <ToolButton label="Canvas" icon={<Crop size={18} />} onClick={() => onPick("canvas")} />
      <ToolButton label="Cover" icon={<ImageIcon size={18} />} onClick={() => onPick("cover")} />
    </div>
  );
}

export function ClipToolbar({
  onPick,
  onDone,
  canDetach,
  canDelete,
  isFirstClip,
  canMoveLeft,
  canMoveRight,
}: {
  onPick: (tool: ClipTool) => void;
  /** Back to the project tools. There used to be no way out of this row but
   *  tapping the preview, which nothing on screen suggested. */
  onDone: () => void;
  canDetach: boolean;
  canDelete: boolean;
  isFirstClip: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  return (
    <div className={ROW}>
      {/* First and pinned, like the video editor's: the one button in this row
          that isn't about the clip, where a thumb finds it without reading. */}
      <div className="sticky left-0 z-10 -ml-3 shrink-0 bg-black pl-3">
        <ToolButton label="Done" icon={<ChevronDown size={18} />} onClick={onDone} />
      </div>
      <ToolButton label="Split" icon={<Scissors size={18} />} onClick={() => onPick("split")} />
      <ToolButton label="Speed" icon={<Gauge size={18} />} onClick={() => onPick("speed")} />
      {/* Third, not last: at the end of a scrolling row it was the one action
          people looked for and couldn't find. */}
      <ToolButton
        label="Delete"
        icon={<Trash2 size={18} />}
        onClick={() => onPick("delete")}
        disabled={!canDelete}
        tone="danger"
      />
      <ToolButton label="Volume" icon={<Volume2 size={18} />} onClick={() => onPick("volume")} />
      <ToolButton
        label="Detach audio"
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
      {/* Reorder also exists as a long-press drag on the chip, but a gesture
          with no affordance is a gesture nobody finds — and on touch it has to
          compete with the scroller it lives inside. These always work. */}
      <ToolButton
        label="Move left"
        icon={<ChevronLeft size={18} />}
        onClick={() => onPick("moveLeft")}
        disabled={!canMoveLeft}
      />
      <ToolButton
        label="Move right"
        icon={<ChevronRight size={18} />}
        onClick={() => onPick("moveRight")}
        disabled={!canMoveRight}
      />
      <ToolButton label="Duplicate" icon={<Copy size={18} />} onClick={() => onPick("duplicate")} />
    </div>
  );
}
