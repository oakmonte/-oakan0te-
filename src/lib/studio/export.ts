// Baking a StudioProject into one file.
//
// This is the studio's counterpart to after-shot-export.ts and it follows the
// same rule: ONE pass from the untouched sources. Per-clip grades, transitions,
// timed captions, product pins and the whole audio mix land on each frame in a
// single encode, so a five-clip edit with three filters costs exactly one
// generation of compression, not five.
//
// It does NOT replace after-shot-export.ts. That file still owns the
// single-capture composite (and its encoded-audio passthrough, which is lossless
// and worth keeping), and this module hands control straight back to it via two
// fast paths below whenever the timeline hasn't actually done anything a remux
// couldn't do.
import {
  Input,
  Output,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSink,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from "mediabunny";
import {
  compileFilter,
  applyCompiledFilter,
  IDENTITY_FILTER,
  type CompiledFilter,
} from "@/lib/canvas-filter";
import { drawLayers, preloadStickers } from "@/lib/layer-bake";
import { trimVideo } from "@/lib/video-trim";
import { combinedFilterCss } from "./adjustments";
import { decodeSourceAudio } from "./audio";
import {
  drawFitted,
  drawPins,
  drawVignette,
  transitionFrame,
  transitionStateAt,
  type LayerTransform,
} from "./render";
import {
  audioDuration,
  clipDuration,
  clipStarts,
  findAspect,
  isNeutral,
  projectDuration,
  resolveAtTime,
  type SourceMap,
  type StudioProject,
  type StudioSource,
  type VideoClip,
} from "./types";

export type ExportProgress = (ratio: number) => void;

// Frame rate is measured, not assumed — see timelineFps(). These are the rates
// it is allowed to land on: every one of them is a rate a phone actually shoots
// or a clean multiple of one, which is the whole point of snapping.
const FPS_LADDER = [24, 25, 30, 48, 50, 60];
const MIN_FPS = 24;
const MAX_FPS = 60;
// 29.97 and 59.94 are the same rates as 30 and 60 wearing NTSC hats, and a
// measured average is never exact anyway. Without this a 30.1 reading would step
// all the way up to 48 and double the encode for nothing.
const FPS_TOLERANCE = 1.02;
const FALLBACK_FPS = 30;
// 1080x1920 for a 9:16 edit — the standard for a social master, and what a phone
// capture already is. outputSize() never upscales past the footage, so a smaller
// source still exports at its own size; this is only a ceiling. It was 1280,
// which quietly downscaled every 1080p capture: the seller's hero asset is the
// last place to be saving encode time.
const TARGET_LONG_EDGE = 1920;
const MIN_LONG_EDGE = 480;

const NEUTRAL_TRANSFORM: LayerTransform = { opacity: 1, scale: 1, offsetX: 0 };

// ---------------------------------------------------------------------------
// Output geometry
// ---------------------------------------------------------------------------

export function outputSize(
  project: StudioProject,
  sources: SourceMap,
): { width: number; height: number } {
  const aspect = findAspect(project.aspectId).ratio;
  let longest = 0;
  for (const clip of project.clips) {
    const source = sources[clip.sourceId];
    if (source) longest = Math.max(longest, source.width, source.height);
  }
  // Never upscale past what the footage actually holds — a 480p clip blown up to
  // 1280 is a bigger file with no more detail in it.
  const edge = Math.max(MIN_LONG_EDGE, Math.min(TARGET_LONG_EDGE, longest || TARGET_LONG_EDGE));
  let width: number;
  let height: number;
  if (aspect >= 1) {
    width = edge;
    height = Math.round(edge / aspect);
  } else {
    height = edge;
    width = Math.round(edge * aspect);
  }
  // H.264 wants even dimensions; an odd one is rejected outright on some encoders.
  return { width: width - (width % 2), height: height - (height % 2) };
}

/** Snaps a measured demand onto the ladder. */
function snapFps(needed: number): number {
  if (needed >= MIN_FPS) {
    return FPS_LADDER.find((step) => step >= needed / FPS_TOLERANCE) ?? MAX_FPS;
  }
  // Below the floor every real frame is held for several output frames, so what
  // matters is that the hold is EVEN. 12 real fps into 30 is 2.5 output frames
  // per source frame, which alternates 2,3,2,3 and reads as judder on a pan;
  // 12 into 24 is a clean 2. Prefer a floor rate the demand divides into.
  const even = FPS_LADDER.find(
    (step) => step >= MIN_FPS && Math.abs(step / needed - Math.round(step / needed)) < 0.02,
  );
  return even ?? MIN_FPS;
}

/** The frame rate this timeline actually needs.
 *
 *  It used to be a flat 30, which threw away half of every 60fps capture and
 *  half of every clip sped past 1x — the two cases where motion is precisely
 *  what the seller is showing off. A clip playing at speed s walks s seconds of
 *  source per second of output, so it has sourceFps * s distinct frames a second
 *  in it; the timeline needs the largest such demand across its clips.
 *
 *  Deliberately measured rather than pinned high: asking for 60 from footage
 *  that only holds 30 buys nothing but duplicate frames the encoder still has to
 *  be paid for, and export already costs a full pixel pass per frame. */
export function timelineFps(project: StudioProject, sources: SourceMap): number {
  let needed = 0;
  for (const clip of project.clips) {
    const source = sources[clip.sourceId];
    if (!source || source.kind !== "video" || !source.fps) continue;
    needed = Math.max(needed, source.fps * clip.speed);
  }
  // Stills only, or a file whose rate we could not read.
  if (needed <= 0) return FALLBACK_FPS;
  return snapFps(Math.min(MAX_FPS, needed));
}

// ---------------------------------------------------------------------------
// Fast paths
// ---------------------------------------------------------------------------

function clipIsPlain(clip: VideoClip): boolean {
  return (
    clip.speed === 1 &&
    clip.volume === 1 &&
    !clip.muted &&
    !clip.audioDetached &&
    combinedFilterCss(clip.filterId, clip.adjustments) === "none" &&
    isNeutral(clip.adjustments) &&
    clip.transitionIn.kind === "none"
  );
}

/** True when the project is a single untouched clip whose native shape already
 *  matches the chosen aspect — nothing to bake, hand the original file back. */
function isPassthrough(project: StudioProject, sources: SourceMap): boolean {
  if (project.clips.length !== 1) return false;
  const clip = project.clips[0];
  const source = sources[clip.sourceId];
  if (!source || source.kind !== "video") return false;
  if (project.audio.length || project.layers.length || project.pins.length) return false;
  if (project.masterMuted) return false;
  if (!clipIsPlain(clip)) return false;
  if (clip.inPoint > 0.001 || clip.outPoint < source.duration - 0.001) return false;
  const aspect = findAspect(project.aspectId).ratio;
  return Math.abs(source.width / source.height - aspect) < 0.02;
}

/** True when the only edit is a trim — mediabunny can remux that losslessly,
 *  which is strictly better than anything this module can produce. */
function isTrimOnly(project: StudioProject, sources: SourceMap): boolean {
  if (project.clips.length !== 1) return false;
  const clip = project.clips[0];
  const source = sources[clip.sourceId];
  if (!source || source.kind !== "video") return false;
  if (project.audio.length || project.layers.length || project.pins.length) return false;
  if (project.masterMuted) return false;
  if (!clipIsPlain(clip)) return false;
  const aspect = findAspect(project.aspectId).ratio;
  return Math.abs(source.width / source.height - aspect) < 0.02;
}

// ---------------------------------------------------------------------------
// Frame planning
// ---------------------------------------------------------------------------

type FramePlan = {
  time: number;
  liveIndex: number;
  liveSourceTime: number;
  transitionAt: number | null; // index into the transition list, or null
};

type PlannedTransition = ReturnType<typeof transitionStateAt>;

function planFrames(project: StudioProject, duration: number, fps: number) {
  const frames: FramePlan[] = [];
  const transitions: NonNullable<PlannedTransition>[] = [];
  const total = Math.max(1, Math.ceil(duration * fps));

  for (let i = 0; i < total; i++) {
    const time = i / fps;
    const state = transitionStateAt(project.clips, time);
    if (state) {
      transitions.push(state);
      frames.push({
        time,
        liveIndex: state.liveIndex,
        liveSourceTime:
          state.liveIndex === state.outgoingIndex
            ? state.outgoingSourceTime
            : state.incomingSourceTime,
        transitionAt: transitions.length - 1,
      });
      continue;
    }
    const resolved = resolveAtTime(project.clips, Math.min(time, duration));
    frames.push({
      time,
      // -1 = a gap: nothing live, the frame is black (see the run loop).
      liveIndex: resolved ? (resolved.inGap ? -1 : resolved.index) : project.clips.length - 1,
      liveSourceTime: resolved ? resolved.sourceTime : 0,
      transitionAt: null,
    });
  }
  return { frames, transitions };
}

// ---------------------------------------------------------------------------
// Per-clip frame rendering
// ---------------------------------------------------------------------------

type Ctx2D = CanvasRenderingContext2D;

function makeCanvas(
  width: number,
  height: number,
  readFrequently: boolean,
): { canvas: HTMLCanvasElement; ctx: Ctx2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // willReadFrequently only where a getImageData actually happens. Setting it on
  // the canvas the encoder reads from is counterproductive: it pins the surface
  // to the CPU, and every frame then has to be uploaded again for the encode.
  const ctx = canvas.getContext("2d", readFrequently ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

/** Grades one clip's frame into a full-size canvas: black ground, the frame
 *  fitted, the colour matrix, then the vignette. The result is what both the
 *  simple path and the transition compositor draw from.
 *
 *  The compiled filter is passed in rather than derived here — it is constant
 *  for the whole clip, and re-parsing the CSS string on every one of a thousand
 *  frames is work for nothing. */
function gradeInto(
  ctx: Ctx2D,
  width: number,
  height: number,
  clip: VideoClip,
  compiled: CompiledFilter,
  image: CanvasImageSource | null,
  sourceW: number,
  sourceH: number,
  fitMode: StudioProject["fitMode"],
): void {
  // Start transparent, not black. In "fit" mode the letterbox bars would
  // otherwise be real black PIXELS by the time the colour matrix runs, and any
  // filter with an offset (contrast, fade) lifts them to grey — while the
  // preview's bars are the un-filtered background of the media box and stay
  // black. The picture is composited over black AFTER grading instead, so both
  // sides letterbox with the same untouched black.
  ctx.clearRect(0, 0, width, height);
  if (image) drawFitted(ctx, image, sourceW, sourceH, width, height, fitMode, NEUTRAL_TRANSFORM);

  if (compiled !== IDENTITY_FILTER) {
    // applyCompiledFilter leaves alpha alone, so transparent bars stay
    // transparent however far the matrix pushes their RGB.
    const frame = ctx.getImageData(0, 0, width, height);
    applyCompiledFilter(frame, compiled);
    ctx.putImageData(frame, 0, 0);
  }

  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Vignette last, on top of the grade — matching the preview, where it is a
  // sibling of the filtered media element rather than a child of it.
  drawVignette(ctx, width, height, clip.adjustments.vignette);
}

function compiledFor(clip: VideoClip): CompiledFilter {
  return compileFilter(combinedFilterCss(clip.filterId, clip.adjustments));
}

async function loadImageElement(source: StudioSource): Promise<HTMLImageElement> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Could not load ${source.name}`));
    img.src = source.url;
  });
  return img;
}

// ---------------------------------------------------------------------------
// Audio mixing
// ---------------------------------------------------------------------------

function createOfflineContext(duration: number): OfflineAudioContext {
  const frames = (rate: number) => Math.max(1, Math.ceil(duration * rate));
  try {
    return new OfflineAudioContext(2, frames(48000), 48000);
  } catch {
    // Some Safari builds refuse anything but the hardware rate here.
    return new OfflineAudioContext(2, frames(44100), 44100);
  }
}

async function mixAudio(
  project: StudioProject,
  sources: SourceMap,
  duration: number,
): Promise<AudioBuffer | null> {
  if (project.masterMuted || duration <= 0) return null;

  type Scheduled = {
    buffer: AudioBuffer;
    start: number;
    offset: number;
    length: number;
    speed: number;
    volume: number;
    fadeIn: number;
    fadeOut: number;
  };

  const scheduled: Scheduled[] = [];
  const starts = clipStarts(project.clips);

  for (let i = 0; i < project.clips.length; i++) {
    const clip = project.clips[i];
    if (clip.audioDetached || clip.muted || clip.volume <= 0) continue;
    const source = sources[clip.sourceId];
    if (!source || !source.hasAudio) continue;
    const buffer = await decodeSourceAudio(source);
    if (!buffer) continue;
    scheduled.push({
      buffer,
      start: starts[i],
      offset: clip.inPoint,
      length: clipDuration(clip),
      speed: clip.speed,
      volume: clip.volume,
      fadeIn: 0,
      fadeOut: 0,
    });
  }

  for (const audio of project.audio) {
    if (audio.muted || audio.volume <= 0) continue;
    const source = sources[audio.sourceId];
    if (!source || !source.hasAudio) continue;
    const buffer = await decodeSourceAudio(source);
    if (!buffer) continue;
    scheduled.push({
      buffer,
      start: audio.timelineStart,
      offset: audio.inPoint,
      length: audioDuration(audio),
      speed: audio.speed,
      volume: audio.volume,
      fadeIn: audio.fadeIn,
      fadeOut: audio.fadeOut,
    });
  }

  // No contributing source means no audio track at all, rather than a silent one
  // padding out the file.
  if (scheduled.length === 0) return null;

  const offline = createOfflineContext(duration);

  // A brickwall limiter on the master bus. Per-source volume goes to 200%, so a
  // clip at full plus a music bed at full plus a voiceover sums well past 0dBFS
  // and hard-clips into buzz. Threshold -1dB with a 20:1 ratio and no knee does
  // nothing at all to a normal mix and simply refuses to let a loud one clip.
  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(offline.destination);

  for (const item of scheduled) {
    const node = offline.createBufferSource();
    node.buffer = item.buffer;
    node.playbackRate.value = item.speed;

    const gain = offline.createGain();
    const start = Math.max(0, item.start);
    const end = Math.min(duration, start + item.length);
    if (end <= start) continue;

    // Envelope, not a constant: a hard start on a music bed is the single most
    // amateur-sounding thing an editor can produce.
    const fadeIn = Math.min(item.fadeIn, (end - start) / 2);
    const fadeOut = Math.min(item.fadeOut, (end - start) / 2);
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(item.volume, start + fadeIn);
    } else {
      gain.gain.setValueAtTime(item.volume, start);
    }
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(item.volume, end - fadeOut);
      gain.gain.linearRampToValueAtTime(0.0001, end);
    }

    node.connect(gain);
    gain.connect(limiter);
    node.start(start, item.offset);
    node.stop(end);
  }

  return await offline.startRendering();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportTimeline(
  project: StudioProject,
  sources: SourceMap,
  onProgress?: ExportProgress,
): Promise<Blob> {
  if (project.clips.length === 0) throw new Error("Nothing on the timeline");

  if (isPassthrough(project, sources)) {
    onProgress?.(1);
    return sources[project.clips[0].sourceId].blob;
  }
  if (isTrimOnly(project, sources)) {
    const clip = project.clips[0];
    return await trimVideo(sources[clip.sourceId].blob, clip.inPoint, clip.outPoint, onProgress);
  }

  const duration = projectDuration(project);
  const { width, height } = outputSize(project, sources);
  const fps = timelineFps(project, sources);
  const { frames, transitions } = planFrames(project, duration, fps);

  const target = new BufferTarget();
  const format = new Mp4OutputFormat();
  const muxer = new Output({ format, target });

  const videoCodec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
    width,
    height,
    quality: QUALITY_HIGH,
  });
  if (!videoCodec) throw new Error("No encodable video codec available on this device");

  // Only pin the grading canvas to the CPU when something is actually graded.
  // The pixel pass costs about 20ms a frame at 540x960, but the readback it
  // forces on every drawImage from the decoder's GPU-backed canvas costs more
  // than that again — so a timeline that is purely cuts, with no filter on any
  // clip, must not pay for a pass it never runs.
  const anyGraded = project.clips.some((c) => compiledFor(c) !== IDENTITY_FILTER);
  const { canvas: outCanvas, ctx: outCtx } = makeCanvas(width, height, false);
  const { canvas: liveCanvas, ctx: liveCtx } = makeCanvas(width, height, anyGraded);

  const canvasSource = new CanvasSource(outCanvas, { codec: videoCodec, quality: QUALITY_HIGH });
  muxer.addVideoTrack(canvasSource);

  onProgress?.(0.02);
  const mixed = await mixAudio(project, sources, duration);
  onProgress?.(0.14);

  let audioSource: AudioBufferSource | null = null;
  if (mixed) {
    const audioCodec = await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), {
      numberOfChannels: mixed.numberOfChannels,
      sampleRate: mixed.sampleRate,
      quality: QUALITY_HIGH,
    });
    if (audioCodec) {
      audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH });
      muxer.addAudioTrack(audioSource);
    }
  }

  const stickers = await preloadStickers(project.layers);

  // Inputs are shared: the same file split into six clips is parsed once.
  const inputs = new Map<string, Input>();
  const getInput = (source: StudioSource) => {
    let input = inputs.get(source.id);
    if (!input) {
      input = new Input({ source: new BlobSource(source.blob), formats: ALL_FORMATS });
      inputs.set(source.id, input);
    }
    return input;
  };

  const images = new Map<string, HTMLImageElement>();
  for (const clip of project.clips) {
    const source = sources[clip.sourceId];
    if (source?.kind === "image" && !images.has(source.id)) {
      images.set(source.id, await loadImageElement(source));
    }
  }

  // Boundary frames. Every transition freezes one of its two clips, so those
  // frames are constant for the whole window — decoded and graded exactly once
  // here rather than re-fetched thirty times a second.
  const frozen = new Map<string, HTMLCanvasElement>();
  const freezeKey = (clipIndex: number, at: "in" | "out") => `${clipIndex}:${at}`;
  const needsFreeze = new Set<string>();
  for (const state of transitions) {
    needsFreeze.add(freezeKey(state.outgoingIndex, "out"));
    needsFreeze.add(freezeKey(state.incomingIndex, "in"));
  }

  const fitOption = project.fitMode === "fill" ? ("cover" as const) : ("contain" as const);
  // Transparent letterboxing, so gradeInto can composite over black afterwards.
  const sinkAlpha = project.fitMode === "fit";

  for (const key of needsFreeze) {
    const [indexText, at] = key.split(":");
    const index = Number(indexText);
    const clip = project.clips[index];
    if (!clip) continue;
    const source = sources[clip.sourceId];
    if (!source) continue;

    const { canvas, ctx } = makeCanvas(width, height, true);
    if (source.kind === "image") {
      const img = images.get(source.id) ?? null;
      gradeInto(
        ctx,
        width,
        height,
        clip,
        compiledFor(clip),
        img,
        source.width,
        source.height,
        project.fitMode,
      );
    } else {
      const track = await getInput(source).getPrimaryVideoTrack();
      if (track) {
        const sink = new CanvasSink(track, {
          width,
          height,
          fit: fitOption,
          alpha: sinkAlpha,
          poolSize: 1,
        });
        // A hair inside the out point — asking for the exact boundary lands past
        // the last frame on most files and returns null.
        const at2 = at === "in" ? clip.inPoint : Math.max(clip.inPoint, clip.outPoint - 0.001);
        const wrapped = await sink.getCanvas(at2);
        gradeInto(
          ctx,
          width,
          height,
          clip,
          compiledFor(clip),
          wrapped ? (wrapped.canvas as CanvasImageSource) : null,
          width,
          height,
          project.fitMode,
        );
      }
    }
    frozen.set(key, canvas);
  }

  await muxer.start();

  try {
    if (mixed && audioSource) {
      await audioSource.add(mixed);
      audioSource.close();
    }

    // Frames grouped into contiguous runs of one live clip, so each clip is
    // decoded in a single forward pass instead of being seeked per frame.
    type Run = { clipIndex: number; from: number; to: number };
    const runs: Run[] = [];
    for (let i = 0; i < frames.length; i++) {
      const last = runs[runs.length - 1];
      if (last && last.clipIndex === frames[i].liveIndex) last.to = i;
      else runs.push({ clipIndex: frames[i].liveIndex, from: i, to: i });
    }

    const frameDuration = 1 / fps;
    let encoded = 0;

    // Progress drives a React render of the whole editor, and at 60fps a
    // thirty-second edit would fire it eighteen hundred times to move a number
    // that only has a hundred values. Report on whole percent changes only.
    let reportedPercent = -1;
    const report = (ratio: number) => {
      const percent = Math.round(ratio * 100);
      if (percent === reportedPercent) return;
      reportedPercent = percent;
      onProgress?.(ratio);
    };

    const composeAndEncode = async (plan: FramePlan) => {
      outCtx.clearRect(0, 0, width, height);
      outCtx.fillStyle = "#000";
      outCtx.fillRect(0, 0, width, height);

      const state = plan.transitionAt === null ? null : transitions[plan.transitionAt];
      if (!state) {
        outCtx.drawImage(liveCanvas, 0, 0);
      } else {
        const tf = transitionFrame(state.kind, state.progress);
        const liveIsOutgoing = state.liveIndex === state.outgoingIndex;
        const outgoingImage = liveIsOutgoing
          ? liveCanvas
          : (frozen.get(freezeKey(state.outgoingIndex, "out")) ?? null);
        const incomingImage = liveIsOutgoing
          ? (frozen.get(freezeKey(state.incomingIndex, "in")) ?? null)
          : liveCanvas;

        // Both layers are already full-size and graded, so "fitting" them into
        // the box is just the transition's own scale/offset.
        if (outgoingImage) {
          drawFitted(outCtx, outgoingImage, width, height, width, height, "fill", tf.outgoing);
        }
        if (incomingImage) {
          drawFitted(outCtx, incomingImage, width, height, width, height, "fill", tf.incoming);
        }
        if (tf.flash > 0) {
          outCtx.save();
          outCtx.globalAlpha = tf.flash;
          outCtx.fillStyle = "#fff";
          outCtx.fillRect(0, 0, width, height);
          outCtx.restore();
        }
      }

      // Overlays go on last and ungraded — a caption or a price tag must never
      // pick up the clip's filter, exactly as after-shot-export.ts orders it.
      const visibleLayers = project.layers.filter(
        (l) => plan.time >= l.startTime && plan.time <= l.endTime,
      );
      if (visibleLayers.length) drawLayers(outCtx, visibleLayers, width, height, stickers);
      if (project.pins.length) drawPins(outCtx, project.pins, plan.time, width, height);

      await canvasSource.add(plan.time, frameDuration);
      encoded += 1;
      report(0.15 + (encoded / frames.length) * 0.82);
    };

    for (const run of runs) {
      // A gap between clips: black, with overlays still drawn over it.
      // Skipping the run instead would drop its frames from the file and
      // everything after it would land early.
      if (run.clipIndex < 0) {
        liveCtx.clearRect(0, 0, width, height);
        liveCtx.fillStyle = "#000";
        liveCtx.fillRect(0, 0, width, height);
        for (let i = run.from; i <= run.to; i++) await composeAndEncode(frames[i]);
        continue;
      }
      const clip = project.clips[run.clipIndex];
      const source = clip ? sources[clip.sourceId] : undefined;
      if (!clip || !source) continue;

      const compiled = compiledFor(clip);

      if (source.kind === "image") {
        const img = images.get(source.id) ?? null;
        gradeInto(
          liveCtx,
          width,
          height,
          clip,
          compiled,
          img,
          source.width,
          source.height,
          project.fitMode,
        );
        for (let i = run.from; i <= run.to; i++) await composeAndEncode(frames[i]);
        continue;
      }

      const track = await getInput(source).getPrimaryVideoTrack();
      if (!track) continue;
      const sink = new CanvasSink(track, {
        width,
        height,
        fit: fitOption,
        alpha: sinkAlpha,
        poolSize: 2,
      });
      const times = frames.slice(run.from, run.to + 1).map((f) => f.liveSourceTime);

      let offset = 0;
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        const plan = frames[run.from + offset];
        offset += 1;
        if (!plan) break;
        // A null means no frame exists at that timestamp; the previous grade is
        // still in liveCanvas, which reads as a held frame rather than a flash
        // of black.
        if (wrapped) {
          gradeInto(
            liveCtx,
            width,
            height,
            clip,
            compiled,
            wrapped.canvas as CanvasImageSource,
            width,
            height,
            project.fitMode,
          );
        }
        await composeAndEncode(plan);
      }
    }

    canvasSource.close();
    await muxer.finalize();
    onProgress?.(1);

    if (!target.buffer) throw new Error("Export produced no output buffer");
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (err) {
    await muxer.cancel().catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Cover frame
// ---------------------------------------------------------------------------

/** The still that fronts the listing. Rendered through the same grade + overlay
 *  path as the video so the thumbnail is a real frame of the finished edit and
 *  not an unfiltered grab of the raw capture. */
export async function exportCover(
  project: StudioProject,
  sources: SourceMap,
  time: number,
): Promise<Blob> {
  const { width, height } = outputSize(project, sources);
  const resolved = resolveAtTime(project.clips, time);
  if (!resolved) throw new Error("Nothing on the timeline");

  const { clip } = resolved;
  const source = sources[clip.sourceId];
  if (!source) throw new Error("Missing source for cover frame");

  const { canvas, ctx } = makeCanvas(width, height, true);

  if (source.kind === "image") {
    const img = await loadImageElement(source);
    gradeInto(
      ctx,
      width,
      height,
      clip,
      compiledFor(clip),
      img,
      source.width,
      source.height,
      project.fitMode,
    );
  } else {
    const input = new Input({ source: new BlobSource(source.blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("No video track for cover frame");
    const sink = new CanvasSink(track, {
      width,
      height,
      fit: project.fitMode === "fill" ? "cover" : "contain",
      alpha: project.fitMode === "fit",
      poolSize: 1,
    });
    const wrapped = await sink.getCanvas(resolved.sourceTime);
    gradeInto(
      ctx,
      width,
      height,
      clip,
      compiledFor(clip),
      wrapped ? (wrapped.canvas as CanvasImageSource) : null,
      width,
      height,
      project.fitMode,
    );
  }

  const stickers = await preloadStickers(project.layers);
  const visible = project.layers.filter((l) => time >= l.startTime && time <= l.endTime);
  if (visible.length) drawLayers(ctx, visible, width, height, stickers);
  if (project.pins.length) drawPins(ctx, project.pins, time, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Cover frame encode failed"))),
      "image/jpeg",
      0.92,
    );
  });
}
