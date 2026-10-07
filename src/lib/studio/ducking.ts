// Ducking: music drops under a voiceover and comes back after it.
//
// A seller talking over a track has to win, and asking them to hand-draw a
// volume dip around every sentence is asking them not to bother. So while any
// voiceover is audible, every music clip plays at DUCK_LEVEL, easing down and
// back up over DUCK_RAMP either side. Only voiceover ducks: a clip's own
// sound is usually room noise, and ducking under it would keep the music
// down for the whole video.
//
// Preview and export read the same spans — the preview multiplies each
// music element's gain by `duckAt`, the export schedules the same shape on a
// gain node — so what plays in the editor is what's in the file.

import { audioDuration, projectDuration, type AudioClip, type StudioProject } from "./types";

export const DUCK_LEVEL = 0.35;
export const DUCK_RAMP = 0.25;

/** The stretches of timeline a voiceover is heard over, merged where they
 *  overlap or nearly touch (a gap shorter than two ramps isn't worth
 *  bringing the music up for). */
export function voiceSpans(project: StudioProject): [number, number][] {
  if (project.masterMuted) return [];
  const end = projectDuration(project);
  const spans = project.audio
    .filter((a) => a.kind === "voiceover" && !a.muted && a.volume > 0)
    .map((a): [number, number] => [
      a.timelineStart,
      Math.min(end, a.timelineStart + audioDuration(a)),
    ])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1] + DUCK_RAMP * 2) last[1] = Math.max(last[1], span[1]);
    else merged.push([span[0], span[1]]);
  }
  return merged;
}

/** Whether a clip is one that ducks. */
export function ducks(audio: AudioClip): boolean {
  return audio.kind === "music";
}

/** The music multiplier at time `t`: 1 clear of any voice, DUCK_LEVEL under
 *  one, a straight ramp in between. */
export function duckAt(spans: [number, number][], t: number): number {
  let factor = 1;
  for (const [start, end] of spans) {
    let f = 1;
    if (t >= start && t <= end) f = DUCK_LEVEL;
    else if (t > start - DUCK_RAMP && t < start)
      f = 1 - ((t - (start - DUCK_RAMP)) / DUCK_RAMP) * (1 - DUCK_LEVEL);
    else if (t > end && t < end + DUCK_RAMP)
      f = DUCK_LEVEL + ((t - end) / DUCK_RAMP) * (1 - DUCK_LEVEL);
    factor = Math.min(factor, f);
  }
  return factor;
}

/** The same shape as automation for a Web Audio gain param, for the export. */
export function scheduleDucking(param: AudioParam, spans: [number, number][]) {
  param.setValueAtTime(1, 0);
  for (const [start, end] of spans) {
    const downAt = Math.max(0, start - DUCK_RAMP);
    param.setValueAtTime(1, downAt);
    param.linearRampToValueAtTime(DUCK_LEVEL, start);
    param.setValueAtTime(DUCK_LEVEL, end);
    param.linearRampToValueAtTime(1, end + DUCK_RAMP);
  }
}
