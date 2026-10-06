import { Trash2 } from "lucide-react";
import { Pill, StudioSheet } from "../controls";
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
  onDone,
}: {
  layer: TimedLayer | null;
  currentTime: number;
  onPatch: (patch: Partial<TimedLayer>) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const title = layer?.kind === "draw" ? "Drawing" : "Sticker";
  return (
    <StudioSheet title={title} onDone={onDone}>
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
