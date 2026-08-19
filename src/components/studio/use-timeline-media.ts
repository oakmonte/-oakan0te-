import { useEffect, useState } from "react";
import { getFilmstrip, type FilmstripFrame } from "@/lib/studio/filmstrip";
import { cachedPeaks, decodeSourceAudio } from "@/lib/studio/audio";
import type { SourceMap } from "@/lib/studio/types";

// Async decoration for the timeline: the filmstrip behind each video chip and
// the waveform inside each audio chip. Both are cosmetic, both are cached by
// source, and both resolve after the track has already drawn — the editor is
// fully usable while they arrive, which is why neither blocks a render.

/** Peaks per source. 600 is enough resolution to zoom a chip to full screen
 *  without the waveform going blocky. */
const PEAK_RESOLUTION = 600;

export function useFilmstrips(sources: SourceMap): Record<string, FilmstripFrame[]> {
  const [strips, setStrips] = useState<Record<string, FilmstripFrame[]>>({});
  const ids = Object.keys(sources).join(",");

  useEffect(() => {
    let cancelled = false;
    for (const source of Object.values(sources)) {
      void getFilmstrip(source).then((frames) => {
        if (cancelled || frames.length === 0) return;
        setStrips((prev) => (prev[source.id] ? prev : { ...prev, [source.id]: frames }));
      });
    }
    return () => {
      cancelled = true;
    };
    // Keyed on the id list rather than the object: the map is rebuilt on every
    // source add, and depending on the object itself would refetch every strip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return strips;
}

export function useWaveforms(sources: SourceMap): Record<string, number[]> {
  const [peaks, setPeaks] = useState<Record<string, number[]>>({});
  const ids = Object.keys(sources).join(",");

  useEffect(() => {
    let cancelled = false;
    for (const source of Object.values(sources)) {
      if (!source.hasAudio) continue;
      void decodeSourceAudio(source).then((buffer) => {
        if (cancelled || !buffer) return;
        const computed = cachedPeaks(source.id, buffer, PEAK_RESOLUTION);
        setPeaks((prev) => (prev[source.id] ? prev : { ...prev, [source.id]: computed }));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return peaks;
}

/** Slices a source's peak array down to the window a clip actually uses. */
export function peaksForRange(
  peaks: number[] | undefined,
  duration: number,
  inPoint: number,
  outPoint: number,
  bars: number,
): number[] {
  if (!peaks || peaks.length === 0 || duration <= 0 || bars <= 0) return [];
  const from = Math.floor((inPoint / duration) * peaks.length);
  const to = Math.ceil((outPoint / duration) * peaks.length);
  const slice = peaks.slice(Math.max(0, from), Math.max(from + 1, Math.min(peaks.length, to)));
  if (slice.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    out.push(slice[Math.min(slice.length - 1, Math.floor((i / bars) * slice.length))]);
  }
  return out;
}
