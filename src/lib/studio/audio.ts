// Decoding, waveform peaks and beat detection for the studio's audio track.
//
// Everything here works on a whole decoded AudioBuffer, cached per source. That
// is deliberate: the mixer (export.ts) schedules buffer sources into an
// OfflineAudioContext, the timeline draws peaks, and Beat sync reads onsets —
// three consumers of one decode instead of three decodes.
import { Input, ALL_FORMATS, BlobSource, AudioBufferSink } from "mediabunny";
import type { StudioSource } from "./types";

let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext {
  // One context for the whole studio. iOS caps how many a page may hold, and a
  // per-decode context is the classic way to hit that cap on the fifth clip.
  if (!sharedContext) sharedContext = new AudioContext();
  return sharedContext;
}

/** decodeAudioData is the fast path but only understands containers the browser
 *  itself can demux. Anything it refuses gets rebuilt from mediabunny's decoder,
 *  which is the same one the rest of the pipeline already relies on. */
async function decodeViaMediabunny(blob: Blob): Promise<AudioBuffer | null> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;

  const chunks: { buffer: AudioBuffer; timestamp: number }[] = [];
  const sink = new AudioBufferSink(track);
  for await (const wrapped of sink.buffers()) {
    chunks.push({ buffer: wrapped.buffer, timestamp: wrapped.timestamp });
  }
  if (chunks.length === 0) return null;

  const sampleRate = chunks[0].buffer.sampleRate;
  const channels = chunks[0].buffer.numberOfChannels;
  const last = chunks[chunks.length - 1];
  const totalFrames = Math.ceil((last.timestamp + last.buffer.duration) * sampleRate);
  const out = audioContext().createBuffer(channels, Math.max(1, totalFrames), sampleRate);

  for (const { buffer, timestamp } of chunks) {
    const offset = Math.round(timestamp * sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const src = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
      const dst = out.getChannelData(ch);
      const room = Math.min(src.length, dst.length - offset);
      if (room > 0) dst.set(src.subarray(0, room), offset);
    }
  }
  return out;
}

const decodeCache = new Map<string, Promise<AudioBuffer | null>>();

export function decodeSourceAudio(source: StudioSource): Promise<AudioBuffer | null> {
  const existing = decodeCache.get(source.id);
  if (existing) return existing;

  const promise = (async () => {
    if (!source.hasAudio) return null;
    try {
      // decodeAudioData detaches the ArrayBuffer it is handed, so this must be
      // its own copy — the blob is shared with the video decoder and the export.
      const bytes = await source.blob.arrayBuffer();
      return await audioContext().decodeAudioData(bytes.slice(0));
    } catch {
      try {
        return await decodeViaMediabunny(source.blob);
      } catch (err) {
        console.warn("Audio decode failed:", err);
        return null;
      }
    }
  })();

  decodeCache.set(source.id, promise);
  return promise;
}

export function clearAudioCache(): void {
  decodeCache.clear();
}

// ---------------------------------------------------------------------------
// Waveform
// ---------------------------------------------------------------------------

/** Per-bucket peak amplitude, 0..1, normalised so a quiet recording still draws
 *  a readable waveform rather than a flat line. */
export function waveformPeaks(buffer: AudioBuffer, count: number): number[] {
  const data = buffer.getChannelData(0);
  const per = Math.max(1, Math.floor(data.length / count));
  const peaks: number[] = [];
  let max = 0.0001;
  for (let i = 0; i < count; i++) {
    let peak = 0;
    const start = i * per;
    const end = Math.min(data.length, start + per);
    // Stride instead of touching every sample: a 30s clip is 1.3M samples and
    // this runs on the render path for a bar that is 200px wide.
    for (let j = start; j < end; j += 4) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    if (peak > max) max = peak;
    peaks.push(peak);
  }
  return peaks.map((p) => Math.min(1, p / max));
}

const peakCache = new Map<string, number[]>();

export function cachedPeaks(sourceId: string, buffer: AudioBuffer, count: number): number[] {
  const key = `${sourceId}:${count}`;
  const hit = peakCache.get(key);
  if (hit) return hit;
  const peaks = waveformPeaks(buffer, count);
  peakCache.set(key, peaks);
  return peaks;
}

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

const HOP = 1024;
/** ~1 second of history to compare a frame against. */
const LOCAL_WINDOW = 43;
const ONSET_RATIO = 1.32;
const MIN_BEAT_GAP = 0.22;

/** Energy-based onset detection: a frame is a beat when its short-term energy
 *  spikes above the local running average and is a local maximum.
 *
 *  Not a full beat tracker — it will not infer a grid through a silent bar — but
 *  it lands on the transients that matter for cutting an outfit change, and it
 *  runs over a decoded buffer in a few milliseconds with no dependency. */
export function detectBeats(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const frames = Math.floor(data.length / HOP);
  if (frames < LOCAL_WINDOW) return [];

  const energy = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    const start = i * HOP;
    for (let j = 0; j < HOP; j += 2) {
      const v = data[start + j];
      sum += v * v;
    }
    energy[i] = sum / (HOP / 2);
  }

  const beats: number[] = [];
  let lastBeat = -Infinity;
  for (let i = LOCAL_WINDOW; i < frames - 1; i++) {
    let avg = 0;
    for (let j = i - LOCAL_WINDOW; j < i; j++) avg += energy[j];
    avg /= LOCAL_WINDOW;
    if (avg <= 0) continue;

    const isPeak = energy[i] > energy[i - 1] && energy[i] >= energy[i + 1];
    if (!isPeak || energy[i] < avg * ONSET_RATIO) continue;

    const time = (i * HOP) / sampleRate;
    if (time - lastBeat < MIN_BEAT_GAP) continue;
    beats.push(time);
    lastBeat = time;
  }
  return beats;
}

const beatCache = new Map<string, number[]>();

export function cachedBeats(sourceId: string, buffer: AudioBuffer): number[] {
  const hit = beatCache.get(sourceId);
  if (hit) return hit;
  const beats = detectBeats(buffer);
  beatCache.set(sourceId, beats);
  return beats;
}

/** Median inter-onset interval as BPM. Shown next to the Beat sync button so
 *  there's some evidence the detector actually found the groove. */
export function estimateBpm(beats: number[]): number | null {
  if (beats.length < 4) return null;
  const gaps: number[] = [];
  for (let i = 1; i < beats.length; i++) gaps.push(beats[i] - beats[i - 1]);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (!median) return null;
  let bpm = 60 / median;
  // Onset detectors habitually latch onto eighth notes; fold into a musical range.
  while (bpm > 180) bpm /= 2;
  while (bpm < 60) bpm *= 2;
  return Math.round(bpm);
}
