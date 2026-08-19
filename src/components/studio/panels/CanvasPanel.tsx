import { Grid2x2, ImageDown, Loader2 } from "lucide-react";
import { Pill, StudioSheet } from "../controls";
import {
  ASPECT_PRESETS,
  formatTimecode,
  type FitMode,
  type StudioProject,
} from "@/lib/studio/types";

export function CanvasPanel({
  project,
  onAspect,
  onFitMode,
  showGuides,
  onToggleGuides,
  onDone,
}: {
  project: StudioProject;
  onAspect: (id: string) => void;
  onFitMode: (mode: FitMode) => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  onDone: () => void;
}) {
  return (
    <StudioSheet title="Canvas" onDone={onDone}>
      {/* Ratios named by where they actually land in Oakmonte, not by number —
          nobody picks "4:5", they pick "the product card". */}
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {ASPECT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onAspect(preset.id)}
            className="flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-transform active:scale-95"
            style={{
              background: project.aspectId === preset.id ? "#fff" : "rgba(255,255,255,0.08)",
              color: project.aspectId === preset.id ? "#000" : "#fff",
            }}
          >
            <span
              className="block"
              style={{
                width: preset.ratio >= 1 ? 26 : 26 * preset.ratio,
                height: preset.ratio >= 1 ? 26 / preset.ratio : 26,
                border: `1.5px solid ${project.aspectId === preset.id ? "#000" : "#fff"}`,
                borderRadius: 3,
              }}
            />
            <span className="text-[10px] font-semibold leading-none">{preset.label}</span>
            <span className="text-[9px] leading-none opacity-65">{preset.sublabel}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        <Pill active={project.fitMode === "fill"} onClick={() => onFitMode("fill")}>
          Fill
        </Pill>
        <Pill active={project.fitMode === "fit"} onClick={() => onFitMode("fit")}>
          Fit
        </Pill>
        <Pill active={showGuides} onClick={onToggleGuides}>
          <span className="flex items-center gap-1.5">
            <Grid2x2 size={13} /> Safe areas
          </span>
        </Pill>
      </div>
      <p className="pb-2 text-[11px] leading-snug text-white/40">
        Safe areas show where the grid and product-card crops cut into a 9:16 master, and where
        Oakmonte&rsquo;s own controls sit over the video.
      </p>
    </StudioSheet>
  );
}

export function CoverPanel({
  coverTime,
  currentTime,
  onPick,
  busy,
  coverUrl,
  onDone,
}: {
  coverTime: number;
  currentTime: number;
  onPick: () => void;
  busy: boolean;
  coverUrl: string | null;
  onDone: () => void;
}) {
  return (
    <StudioSheet title="Cover" onDone={onDone}>
      <div className="flex items-center gap-3 pb-3">
        <div
          className="flex h-[86px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="Cover frame" className="h-full w-full object-cover" />
          ) : (
            <ImageDown size={18} className="text-white/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-snug text-white/55">
            The still that fronts this listing. Scrub to the frame that sells the piece, then set it
            — it bakes with the same grade and overlays as the video.
          </p>
          <p className="mt-1 text-[11px] text-white/80">
            Cover at {formatTimecode(coverTime)} · playhead {formatTimecode(currentTime)}
          </p>
        </div>
      </div>
      <div className="pb-2">
        <Pill onClick={onPick} disabled={busy}>
          <span className="flex items-center gap-1.5">
            {busy && <Loader2 size={13} className="animate-spin" />}
            Use frame at playhead
          </span>
        </Pill>
      </div>
    </StudioSheet>
  );
}
