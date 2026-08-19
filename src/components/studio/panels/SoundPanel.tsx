import { Music4, Scissors, Unlink, Waves } from "lucide-react";
import { EmptyHint, Pill, StudioSheet } from "../controls";
import type { VideoClip } from "@/lib/studio/types";

export function SoundPanel({
  clip,
  canDetach,
  onAddMusic,
  onDetach,
  onDetectBeats,
  onCutToBeats,
  beatCount,
  bpm,
  detecting,
  onDone,
}: {
  clip: VideoClip | null;
  canDetach: boolean;
  onAddMusic: () => void;
  onDetach: () => void;
  onDetectBeats: () => void;
  onCutToBeats: () => void;
  beatCount: number;
  bpm: number | null;
  detecting: boolean;
  onDone: () => void;
}) {
  return (
    <StudioSheet title="Sound" onDone={onDone}>
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        <Pill onClick={onAddMusic}>
          <span className="flex items-center gap-1.5">
            <Music4 size={13} /> Add track
          </span>
        </Pill>
        <Pill onClick={onDetach} disabled={!clip || !canDetach || clip.audioDetached}>
          <span className="flex items-center gap-1.5">
            <Unlink size={13} /> Separate audio
          </span>
        </Pill>
        <Pill onClick={onDetectBeats} disabled={detecting}>
          <span className="flex items-center gap-1.5">
            <Waves size={13} /> {detecting ? "Listening…" : "Find beats"}
          </span>
        </Pill>
        <Pill onClick={onCutToBeats} disabled={beatCount === 0}>
          <span className="flex items-center gap-1.5">
            <Scissors size={13} /> Cut on beats
          </span>
        </Pill>
      </div>

      {beatCount > 0 ? (
        <p className="pb-3 text-[11px] text-white/55">
          {beatCount} beats found{bpm ? ` · about ${bpm} BPM` : ""}. They are marked on the timeline
          — &ldquo;Cut on beats&rdquo; splits the clip under the playhead at every one.
        </p>
      ) : (
        <EmptyHint>
          Add a track or separate a clip&rsquo;s audio, then find beats to cut an outfit change
          exactly on the drop.
        </EmptyHint>
      )}
    </StudioSheet>
  );
}
