// Filmstrip thumbnails for the timeline track.
//
// Decoded with mediabunny's CanvasSink rather than by seeking a hidden <video>
// element, which is what the old trim screen did. A <video> can only be seeked
// one frame at a time and every seek is a round trip through the media stack, so
// twelve thumbnails meant twelve sequential awaits and a visible second of empty
// track. canvasesAtTimestamps() walks a sorted timestamp list through a single
// decode pass, decoding each packet at most once, and CanvasSink does the
// downscale and the rotation-metadata fix on the way out.
import { Input, ALL_FORMATS, BlobSource, CanvasSink } from "mediabunny";
import type { StudioSource } from "./types";

export type FilmstripFrame = { time: number; url: string };

// Decoded at 2x the on-screen tile so the strip stays crisp on a phone.
const TILE_W = 60;
const TILE_H = 96;

/** Roughly two per second, clamped — enough that a fast scrub still shows motion
 *  without decoding a 30-second clip frame by frame. */
function frameCount(duration: number): number {
  return Math.min(48, Math.max(6, Math.ceil(duration * 2)));
}

const cache = new Map<string, Promise<FilmstripFrame[]>>();

function canvasToDataUrl(canvas: HTMLCanvasElement | OffscreenCanvas): string | null {
  // CanvasSink hands back a pooled canvas that gets overwritten a few frames
  // later, so this has to copy the pixels out now, not hold a reference.
  if ("toDataURL" in canvas) return canvas.toDataURL("image/jpeg", 0.62);
  return null;
}

async function extract(source: StudioSource): Promise<FilmstripFrame[]> {
  if (source.kind === "image") return [{ time: 0, url: source.url }];
  if (source.kind === "audio") return [];

  const input = new Input({ source: new BlobSource(source.blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) return [];

  const count = frameCount(source.duration);
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    // Sampled at tile centres, not edges — asking for exactly `duration` returns
    // nothing on most files because there is no frame at the very end.
    times.push(((i + 0.5) / count) * source.duration);
  }

  const sink = new CanvasSink(track, {
    width: TILE_W,
    height: TILE_H,
    fit: "cover",
    poolSize: 2,
  });

  const frames: FilmstripFrame[] = [];
  let i = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(times)) {
    const time = times[i];
    i += 1;
    if (!wrapped) continue;
    const url = canvasToDataUrl(wrapped.canvas);
    if (url) frames.push({ time, url });
  }
  return frames;
}

/** Cached per source — the same file dropped in twice, or split into six clips,
 *  decodes its strip exactly once. */
export function getFilmstrip(source: StudioSource): Promise<FilmstripFrame[]> {
  const existing = cache.get(source.id);
  if (existing) return existing;
  const promise = extract(source).catch((err) => {
    // A missing strip is cosmetic; the clip still plays, trims and exports. Drop
    // the rejected promise so a transient decode failure can be retried.
    console.warn("Filmstrip failed:", err);
    cache.delete(source.id);
    return [] as FilmstripFrame[];
  });
  cache.set(source.id, promise);
  return promise;
}

export function clearFilmstripCache(): void {
  cache.clear();
}

/** Picks the tiles that fall inside a clip's trimmed range, then repeats or
 *  clips them to fill however many tiles the chip is wide right now. */
export function tilesForRange(
  frames: FilmstripFrame[],
  inPoint: number,
  outPoint: number,
  tileCount: number,
): string[] {
  if (frames.length === 0 || tileCount <= 0) return [];
  const span = Math.max(0.0001, outPoint - inPoint);
  const out: string[] = [];
  for (let i = 0; i < tileCount; i++) {
    const t = inPoint + ((i + 0.5) / tileCount) * span;
    let best = frames[0];
    let bestDist = Math.abs(best.time - t);
    for (const f of frames) {
      const d = Math.abs(f.time - t);
      if (d < bestDist) {
        best = f;
        bestDist = d;
      }
    }
    out.push(best.url);
  }
  return out;
}
