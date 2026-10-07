import { Copy, Scissors, Trash2 } from "lucide-react";
import { Pill, StudioSheet } from "../controls";
import { AnimRow } from "./AnimRow";
import type { TimedLayer } from "@/lib/studio/types";

// A sticker or drawing on the timeline. There is nothing to type, so this is
// only the timing shortcuts and Delete: where it sits on the frame is a drag
// on the preview, and when it shows is a drag on its timeline chip. Captions
// have TextPanel, which this would otherwise fall into — showing an empty
// "Add a caption…" box for a picture.

export function OverlayPanel({
  layer,
  currentTime,
  onPatch,
  onDelete,
  canSplit,
  onSplit,
  onDuplicate,
  onDone,
}: {
  layer: TimedLayer | null;
  currentTime: number;
  onPatch: (patch: Partial<TimedLayer>) => void;
  onDelete: () => void;
  /** The playhead is far enough inside it for both halves to be usable. */
  canSplit: boolean;
  /** Cut it in two at the playhead. */
  onSplit: () => void;
  /** A copy straight after it. */
  onDuplicate: () => void;
  onDone: () => void;
}) {
  const title = layer?.kind === "draw" ? "Drawing" : "Sticker";
  return (
    <StudioSheet title={title} onDone={onDone}>
      {layer && (
        <AnimRow
          value={layer.anim}
          withTypewriter={false}
          onChange={(anim) => onPatch({ anim } as Partial<TimedLayer>)}
        />
      )}
      {layer && (
        <div className="flex gap-2 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
          <Pill
            onClick={() =>
              onPatch({
                startTime: Math.min(currentTime, layer.endTime - 0.3),
              } as Partial<TimedLayer>)
            }
          >
            Start here
          </Pill>
          <Pill
            onClick={() =>
              onPatch({
                endTime: Math.max(currentTime, layer.startTime + 0.3),
              } as Partial<TimedLayer>)
            }
          >
            End here
          </Pill>
          <Pill onClick={onSplit} disabled={!canSplit}>
            <span className="flex items-center gap-1">
              <Scissors size={13} /> Split
            </span>
          </Pill>
          <Pill onClick={onDuplicate}>
            <span className="flex items-center gap-1">
              <Copy size={13} /> Duplicate
            </span>
          </Pill>
          <Pill tone="danger" onClick={onDelete}>
            <span className="flex items-center gap-1">
              <Trash2 size={13} /> Delete
            </span>
          </Pill>
        </div>
      )}
    </StudioSheet>
  );
}
