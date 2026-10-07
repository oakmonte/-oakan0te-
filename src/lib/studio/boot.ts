// Turning picked files into a starting project. Shared by the two screens
// that open the studio: after a camera capture (create.after-shot.studio)
// and "New video" (create.studio).

import { DEFAULT_IMAGE_DURATION } from "./sources";
import {
  ASPECT_PRESETS,
  NEUTRAL_ADJUSTMENTS,
  NO_TRANSITION,
  uid,
  type SourceMap,
  type StudioProject,
  type StudioSource,
  type VideoClip,
} from "./types";

/** The canvas closest to the first clip's own shape, so a portrait phone
 *  video opens as 9:16 rather than letterboxed into something else. */
export function nearestAspectId(width: number, height: number): string {
  if (!width || !height) return ASPECT_PRESETS[0].id;
  const ratio = width / height;
  let best = ASPECT_PRESETS[0];
  for (const preset of ASPECT_PRESETS) {
    if (Math.abs(preset.ratio - ratio) < Math.abs(best.ratio - ratio)) best = preset;
  }
  return best.id;
}

/** A whole source as one clip: a video end to end, a photo held for the
 *  default still length. */
export function makeClip(source: StudioSource): VideoClip {
  return {
    id: uid("clip"),
    sourceId: source.id,
    inPoint: 0,
    outPoint: source.kind === "image" ? DEFAULT_IMAGE_DURATION : source.duration,
    speed: 1,
    volume: 1,
    muted: false,
    audioDetached: false,
    filterId: "natural",
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    transitionIn: NO_TRANSITION,
  };
}

/** A project with each picture source as a clip, in order. */
export function projectFrom(sources: StudioSource[]): {
  project: StudioProject;
  sources: SourceMap;
} {
  const pictures = sources.filter((s) => s.kind !== "audio");
  const first = pictures[0];
  return {
    sources: Object.fromEntries(sources.map((s) => [s.id, s])),
    project: {
      clips: pictures.map(makeClip),
      audio: [],
      layers: [],
      pins: [],
      aspectId: first ? nearestAspectId(first.width, first.height) : ASPECT_PRESETS[0].id,
      fitMode: "fill",
      coverTime: 0,
      masterMuted: false,
    },
  };
}
