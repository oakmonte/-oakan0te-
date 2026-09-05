import { Input, ALL_FORMATS, BlobSource, AudioBufferSink } from "mediabunny";
import { clipDuration, type Clip } from "@/lib/video-sequence";

// The finished video's sound, built as one mixdown.
//
// Every source lands in a single OfflineAudioContext render: each clip's own
// audio, scheduled at its position on the timeline, plus any music the user
// added on top. That is the only arrangement that makes both of the things
// this screen needs cheap.
//
// **Speed.** An AudioBufferSourceNode's `playbackRate` resamples as it plays,
// so a 2x clip's audio comes out twice as fast and an octave up. That is the
// sped-up sound people actually expect from a short-form editor — the same
// thing TikTok gives you — rather than the silence this used to export.
// Preserving pitch instead would need a real time-stretch, which is a much
// larger piece of work and, per the reference, not what anyone is asking for.
//
// **Mixing.** Two sources playing at once is what a graph does by default, so
// music over clip audio costs a second node rather than a second pipeline.
//
// The whole track is rendered into memory before it is encoded. At 48kHz
// stereo that is ~23MB a minute, which is fine for the short posts this
// product makes and worth knowing before someone tries to edit an hour.

/** Music laid over the whole timeline. */
export type MusicTrack = {
  file: Blob;
  name: string;
  /** 0–1. Clip audio is unaffected; mute individual clips to duck them. */
  volume: number;
};

const SAMPLE_RATE = 48000;
const CHANNELS = 2;

/** Whether a clip contributes its own sound. Speed no longer disqualifies it —
 *  it just changes how the sound comes out. */
export function clipCarriesAudio(clip: Clip): boolean {
  return clip.kind === "video" && !clip.muted;
}

/** Every decoded AudioBuffer of a track's trim window, joined into one.
 *
 *  Joining first, rather than scheduling each decoded chunk as its own node,
 *  is what keeps speed changes clean: one node covering the whole clip
 *  resamples continuously, where a node per chunk would resample each in
 *  isolation and leave an audible seam at every boundary. */
async function readClipAudio(
  blob: Blob,
  from: number,
  to: number,
  ctx: OfflineAudioContext,
): Promise<AudioBuffer | null> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;

  const chunks: AudioBuffer[] = [];
  let frames = 0;
  let channels = 0;
  const sink = new AudioBufferSink(track);
  for await (const wrapped of sink.buffers(from, to)) {
    chunks.push(wrapped.buffer);
    frames += wrapped.buffer.length;
    channels = Math.max(channels, wrapped.buffer.numberOfChannels);
  }
  if (chunks.length === 0 || frames === 0) return null;

  // Built at the source's own rate; the graph resamples it on the way to the
  // 48kHz render, so there's no need to do it by hand here.
  const joined = ctx.createBuffer(Math.max(1, channels), frames, chunks[0].sampleRate);
  let offset = 0;
  for (const chunk of chunks) {
    for (let ch = 0; ch < joined.numberOfChannels; ch++) {
      // A mono source feeds every output channel rather than going silent on
      // the right.
      const source = chunk.getChannelData(Math.min(ch, chunk.numberOfChannels - 1));
      joined.getChannelData(ch).set(source, offset);
    }
    offset += chunk.length;
  }
  return joined;
}

/** The whole timeline's audio, or null when there is nothing to hear.
 *
 *  `blobFor` is injected rather than imported so this file never has to know
 *  how a clip's bytes are fetched — the export module already owns that. */
export async function buildSequenceAudio(
  clips: Clip[],
  music: MusicTrack | null,
  blobFor: (clip: Clip) => Promise<Blob>,
): Promise<AudioBuffer | null> {
  const total = clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
  if (total <= 0) return null;
  const audible = clips.filter(clipCarriesAudio);
  if (audible.length === 0 && !music) return null;

  const ctx = new OfflineAudioContext(
    CHANNELS,
    Math.max(1, Math.ceil(total * SAMPLE_RATE)),
    SAMPLE_RATE,
  );

  let scheduled = 0;
  let offset = 0;
  for (const clip of clips) {
    const duration = clipDuration(clip);
    if (duration <= 0) continue;
    if (!clipCarriesAudio(clip)) {
      offset += duration;
      continue;
    }

    try {
      const buffer = await readClipAudio(await blobFor(clip), clip.trimStart, clip.trimEnd, ctx);
      if (buffer) {
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        // Here is the chipmunk. The node plays the same samples faster, which
        // raises the pitch by exactly the speed ratio.
        node.playbackRate.value = clip.speed || 1;
        node.connect(ctx.destination);
        // Stopping at the clip's end matters: playbackRate makes the source
        // shorter than its buffer, but a trim that ends mid-decode-chunk can
        // still leave a tail that would bleed into the next clip.
        node.start(offset, 0, duration);
        scheduled++;
      }
    } catch {
      // One clip's sound failing shouldn't cost the whole export. A silent
      // stretch is recoverable; a failed render is not.
    }
    offset += duration;
  }

  if (music) {
    try {
      const decoded = await ctx.decodeAudioData(await music.file.arrayBuffer());
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(music.volume, 1));
      gain.connect(ctx.destination);
      // Looped, so a 15-second song still covers a 40-second edit instead of
      // dropping out two thirds of the way through. The render length clips
      // the tail for free.
      const node = ctx.createBufferSource();
      node.buffer = decoded;
      node.loop = true;
      node.connect(gain);
      node.start(0);
      scheduled++;
    } catch {
      // An audio file the browser can't decode. Same reasoning as above.
    }
  }

  if (scheduled === 0) return null;
  return ctx.startRendering();
}
