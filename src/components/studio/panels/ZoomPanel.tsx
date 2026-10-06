import { Pill, StudioSheet } from "../controls";
import { ZOOM_PRESETS, zoomPresetOf, type ClipZoom } from "@/lib/studio/render";
import type { VideoClip } from "@/lib/studio/types";

// Movement on a still: a slow push in or pull out over the clip (Ken Burns),
// or a fixed close-up that crops in on a video. A photo held for five seconds
// with nothing moving reads as a slideshow; the same photo drifting in reads
// as footage.

export function ZoomPanel({
  clip,
  onZoom,
  onDone,
}: {
  clip: VideoClip | null;
  onZoom: (zoom: ClipZoom | undefined) => void;
  onDone: () => void;
}) {
  const current = clip ? zoomPresetOf(clip.zoom) : "none";
  return (
    <StudioSheet title="Zoom" onDone={onDone}>
      <div className="flex gap-2 overflow-x-auto pb-3 [&::-webkit-scrollbar]:hidden">
        {ZOOM_PRESETS.map((preset) => (
          <Pill
            key={preset.id}
            active={current === preset.id}
            disabled={!clip}
            onClick={() => onZoom(preset.zoom)}
          >
            {preset.label}
          </Pill>
        ))}
      </div>
    </StudioSheet>
  );
}
