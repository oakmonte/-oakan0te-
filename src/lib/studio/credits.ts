// Credits for the catalogue sounds the studio mixes into a video.
//
// Music and effects from the library come under licences that, for CC BY and
// CC BY-SA, make the credit a condition of using them at all. The studio
// bakes every sound into the MP4, so nothing about the finished file says
// what's in it: these are worked out from the timeline at export and travel
// to the post as a baked-in credit (see `bakedIn` in capture-handoff.ts).
//
// Only what is actually heard is credited. Crediting a track that was muted,
// or parked past the end of the video where the export cuts it off, puts a
// name under a post for music it doesn't contain — as wrong as leaving one
// off.

import type { SoundCredit } from "@/lib/sound-library";
import { audioDuration, projectDuration, type SourceMap, type StudioProject } from "./types";

/** One entry per distinct catalogue source audible in the finished video,
 *  in timeline order. */
export function creditsInMix(project: StudioProject, sources: SourceMap): SoundCredit[] {
  if (project.masterMuted) return [];
  const end = projectDuration(project);
  const heard = project.audio
    .filter((a) => !a.muted && a.volume > 0 && audioDuration(a) > 0)
    .filter((a) => a.timelineStart < end)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const seen = new Set<string>();
  const credits: SoundCredit[] = [];
  for (const audio of heard) {
    const credit = sources[audio.sourceId]?.credit;
    if (!credit || seen.has(audio.sourceId)) continue;
    seen.add(audio.sourceId);
    credits.push(credit);
  }
  return credits;
}

/** Several credits as the one a post stores.
 *
 *  A post has a single credit line, licence and link. Every attribution goes
 *  into the line — CC BY asks for each of them, and the feed already shows
 *  that line in full — and every distinct licence into the licence field.
 *  The link is the first sound's page. */
export function combineCredits(credits: SoundCredit[]): SoundCredit | null {
  if (credits.length === 0) return null;
  if (credits.length === 1) return credits[0];
  const lines = credits.map((c) => c.attribution).filter((line): line is string => !!line);
  const licences = [...new Set(credits.map((c) => c.licence))];
  return {
    attribution: lines.length > 0 ? lines.join(" · ") : null,
    licence: licences.join(" · ").slice(0, 120),
    sourceUrl: credits[0].sourceUrl,
  };
}
