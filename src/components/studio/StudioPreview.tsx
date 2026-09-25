import { useMemo, useRef } from "react";
import { useFittedSize } from "@/hooks/use-fitted-size";
import LayerOverlay from "@/components/camera/LayerOverlay";
import { useLayerRenderer } from "@/components/camera/aftershot/use-layer-renderer";
import { combinedFilterCss } from "@/lib/studio/adjustments";
import {
  transformCss,
  transitionFrame,
  transitionStateAt,
  vignetteCss,
  type LayerTransform,
} from "@/lib/studio/render";
import {
  clipStarts,
  findAspect,
  type ProductPin,
  type SourceMap,
  type StudioProject,
  type StudioSelection,
  type TimedLayer,
} from "@/lib/studio/types";
import type { Layer } from "@/lib/after-shot-layers";
import ProductPinOverlay from "./ProductPinOverlay";
import { useTimelineTime, type PlaybackApi } from "@/lib/studio/use-playback";

const NEUTRAL: LayerTransform = { opacity: 1, scale: 1, offsetX: 0 };

type Props = {
  project: StudioProject;
  sources: SourceMap;
  playback: PlaybackApi;
  selection: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
  onUpdateLayer: (id: string, patch: Partial<TimedLayer>) => void;
  onUpdatePin: (id: string, patch: Partial<ProductPin>) => void;
  /** Read-only captions and drawings carried in from the after-shot screen.
   *  Shown so the framing is honest, never baked here — after-shot-export.ts
   *  still owns them. */
  inheritedLayers: Layer[];
  showGuides: boolean;
  /** Auditioning a filter grades the preview without committing, exactly like
   *  the after-shot screen's filter list. */
  filterPreviewId: string | null;
  /** WHICH clip the audition applies to. It used to be whatever was under the
   *  playhead, while the panel committed to the SELECTED clip \u2014 so with the
   *  playhead over clip 1 and clip 3 selected you graded clip 1 by eye and the
   *  filter landed on clip 3. */
  gradeClipId: string | null;
};

export default function StudioPreview({
  project,
  sources,
  playback,
  selection,
  onSelect,
  onUpdateLayer,
  onUpdatePin,
  inheritedLayers,
  showGuides,
  filterPreviewId,
  gradeClipId,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const aspect = findAspect(project.aspectId).ratio;
  const fitted = useFittedSize(areaRef, aspect);
  const renderLayerContent = useLayerRenderer(boxRef);

  // Full rate, not the route's ten-per-second state: transition opacity and the
  // pop-in on a product tag both animate against this.
  const time = useTimelineTime(playback);
  const starts = useMemo(() => clipStarts(project.clips), [project.clips]);
  const transition = transitionStateAt(project.clips, time);

  // Which clip is actually on screen right now — and whether the playhead is in
  // an empty gap, in which case nothing is (the box's own black shows) while
  // the next clip stays mounted so it's ready when the gap ends.
  const { liveIndex, inGap } = useMemo(() => {
    if (transition) return { liveIndex: transition.liveIndex, inGap: false };
    for (let i = project.clips.length - 1; i >= 0; i--) {
      if (time >= starts[i] || i === 0) return { liveIndex: i, inGap: false };
      if (time >= starts[i] - (project.clips[i].gapBefore ?? 0)) {
        return { liveIndex: i, inGap: true };
      }
    }
    return { liveIndex: 0, inGap: false };
  }, [transition, project.clips, starts, time]);

  // Only a window of clips is mounted. Every clip getting its own <video> is
  // what makes clip switching instant (no src swap, no reload), but mobile
  // Safari caps how many decoders a page may hold — so neighbours are kept
  // warm and everything else is unmounted.
  const mountedIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = liveIndex - 1; i <= liveIndex + 1; i++) {
      if (i >= 0 && i < project.clips.length) set.add(i);
    }
    if (transition) {
      set.add(transition.outgoingIndex);
      set.add(transition.incomingIndex);
    }
    return [...set].sort((a, b) => a - b);
  }, [liveIndex, transition, project.clips.length]);

  const frame = transition ? transitionFrame(transition.kind, transition.progress) : null;

  const transformFor = (index: number): LayerTransform => {
    if (!frame || !transition) return NEUTRAL;
    if (index === transition.outgoingIndex) return frame.outgoing;
    if (index === transition.incomingIndex) return frame.incoming;
    return { ...NEUTRAL, opacity: 0 };
  };

  const visibleLayers = project.layers.filter((l) => time >= l.startTime && time <= l.endTime);
  const objectFit = project.fitMode === "fill" ? "cover" : "contain";

  return (
    <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center px-4">
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-2xl"
        style={{
          width: fitted.width || undefined,
          height: fitted.height || undefined,
          background: "#000",
        }}
      >
        {mountedIndices.map((index) => {
          const clip = project.clips[index];
          const source = sources[clip.sourceId];
          if (!source) return null;
          const t = transformFor(index);
          // Outside a transition exactly one clip is on screen; inside one, both
          // participants are, at whatever opacity the transition calls for.
          const opacity = transition ? t.opacity : index === liveIndex && !inGap ? 1 : 0;
          const filterId =
            filterPreviewId && clip.id === gradeClipId ? filterPreviewId : clip.filterId;

          return (
            <div
              key={clip.id}
              className="absolute inset-0"
              style={{
                opacity,
                transform: transformCss(t),
                willChange: "opacity, transform",
              }}
            >
              {/* The grade goes on the MEDIA element, never on this wrapper. A
                  CSS filter applies to the whole flattened subtree, so with it
                  up here the vignette below became part of what got graded \u2014
                  while gradeInto() in the exporter draws the vignette AFTER the
                  colour matrix. Same numbers, opposite compositing order, and a
                  Fade + Vignette combination came out visibly different in the
                  file than on screen. */}
              {source.kind === "image" ? (
                <img
                  src={source.url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit, filter: combinedFilterCss(filterId, clip.adjustments) }}
                />
              ) : (
                <video
                  ref={playback.clipRef(clip.id)}
                  src={source.url}
                  playsInline
                  disablePictureInPicture
                  disableRemotePlayback
                  preload="auto"
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit, filter: combinedFilterCss(filterId, clip.adjustments) }}
                />
              )}
              {clip.adjustments.vignette > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: vignetteCss(clip.adjustments.vignette) }}
                />
              )}
            </div>
          );
        })}

        {frame && frame.flash > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "#fff", opacity: frame.flash }}
          />
        )}

        {/* Detached sound, music and voiceover. Audio-only elements so they can
            sit anywhere on the timeline independently of the picture. */}
        {project.audio.map((audio) => {
          const source = sources[audio.sourceId];
          if (!source) return null;
          return (
            <audio
              key={audio.id}
              ref={playback.audioRef(audio.id)}
              src={source.url}
              preload="auto"
              className="hidden"
            />
          );
        })}

        {showGuides && <FramingGuides />}

        {/* Captions carried over from the after-shot screen — inert here. */}
        {inheritedLayers.length > 0 && (
          <div className="absolute inset-0 pointer-events-none opacity-90">
            <LayerOverlay
              containerRef={boxRef}
              layers={inheritedLayers}
              updateLayer={() => {}}
              selectedLayerId={null}
              setSelectedLayerId={() => {}}
              renderLayerContent={renderLayerContent}
            />
          </div>
        )}

        <LayerOverlay
          containerRef={boxRef}
          layers={visibleLayers}
          updateLayer={(id, patch) => onUpdateLayer(id, patch as Partial<TimedLayer>)}
          selectedLayerId={selection?.kind === "layer" ? selection.id : null}
          setSelectedLayerId={(id) => onSelect(id ? { kind: "layer", id } : null)}
          renderLayerContent={renderLayerContent}
        />

        <ProductPinOverlay
          pins={project.pins}
          time={time}
          containerRef={boxRef}
          selectedId={selection?.kind === "pin" ? selection.id : null}
          onSelect={(id) => onSelect(id ? { kind: "pin", id } : null)}
          onUpdate={onUpdatePin}
        />
      </div>
    </div>
  );
}

/** Where Oakmonte's own chrome lands on a published video, plus the 4:5 and 1:1
 *  crops the grid and product card take out of a 9:16 master. Shooting blind to
 *  these is how a price tag ends up sitting on the model's face. */
function FramingGuides() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute left-0 right-0 border-y border-dashed"
        style={{ top: "10%", bottom: "10%", borderColor: "rgba(255,255,255,0.35)" }}
      />
      <div
        className="absolute left-0 right-0 border-y border-dashed"
        style={{ top: "21.875%", bottom: "21.875%", borderColor: "rgba(255,255,255,0.18)" }}
      />
      <span
        className="absolute text-[9px] uppercase tracking-widest"
        style={{ top: "10%", left: 6, marginTop: 3, color: "rgba(255,255,255,0.45)" }}
      >
        4:5 crop
      </span>
      <span
        className="absolute text-[9px] uppercase tracking-widest"
        style={{ top: "21.875%", left: 6, marginTop: 3, color: "rgba(255,255,255,0.28)" }}
      >
        1:1 crop
      </span>
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ height: "13%", background: "rgba(255,0,80,0.10)" }}
      />
      <span
        className="absolute left-1.5 text-[9px] uppercase tracking-widest"
        style={{ bottom: 6, color: "rgba(255,255,255,0.5)" }}
      >
        UI overlay
      </span>
    </div>
  );
}
