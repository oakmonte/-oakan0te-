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
import { compileFilter, applyCompiledFilter, IDENTITY_FILTER } from "@/lib/canvas-filter";
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

const OUTPUT_FPS = 30;
// 720x1280 for a 9:16 edit. High enough for a feed, low enough that a phone
// hardware encoder keeps up with a multi-clip timeline.
const TARGET_LONG_EDGE = 1280;
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

function planFrames(project: StudioProject, duration: number) {
  const frames: FramePlan[] = [];
  const transitions: NonNullable<PlannedTransition>[] = [];
  const total = Math.max(1, Math.ceil(duration * OUTPUT_FPS));

  for (let i = 0; i < total; i++) {
    const time = i / OUTPUT_FPS;
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
      liveIndex: resolved ? resolved.index : project.clips.length - 1,
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

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Ctx2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // willReadFrequently because every graded frame goes through getImageData —
  // without it the browser keeps the surface on the GPU and each read stalls.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

/** Grades one clip's frame into a full-size canvas: black ground, the frame
 *  fitted, the colour matrix, then the vignette. The result is what both the
 *  simple path and the transition compositor draw from. */
function gradeInto(
  ctx: Ctx2D,
  width: number,
  height: number,
  clip: VideoClip,
  image: CanvasImageSource | null,
  sourceW: number,
  sourceH: number,
  fitMode: StudioProject["fitMode"],
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (image) drawFitted(ctx, image, sourceW, sourceH, width, height, fitMode, NEUTRAL_TRANSFORM);

  const compiled = compileFilter(combinedFilterCss(clip.filterId, clip.adjustments));
  if (compiled !== IDENTITY_FILTER) {
    const frame = ctx.getImageData(0, 0, width, height);
    applyCompiledFilter(frame, compiled);
    ctx.putImageData(frame, 0, 0);
  }
  drawVignette(ctx, width, height, clip.adjustments.vignette);
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
    gain.connect(offline.destination);
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
  const { frames, transitions } = planFrames(project, duration);

  const target = new BufferTarget();
  const format = new Mp4OutputFormat();
  const muxer = new Output({ format, target });

  const videoCodec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
    width,
    height,
    quality: QUALITY_HIGH,
  });
  if (!videoCodec) throw new Error("No encodable video codec available on this device");

  const { canvas: outCanvas, ctx: outCtx } = makeCanvas(width, height);
  const { canvas: liveCanvas, ctx: liveCtx } = makeCanvas(width, height);

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

  for (const key of needsFreeze) {
    const [indexText, at] = key.split(":");
    const index = Number(indexText);
    const clip = project.clips[index];
    if (!clip) continue;
    const source = sources[clip.sourceId];
    if (!source) continue;

    const { canvas, ctx } = makeCanvas(width, height);
    if (source.kind === "image") {
      const img = images.get(source.id) ?? null;
      gradeInto(ctx, width, height, clip, img, source.width, source.height, project.fitMode);
    } else {
      const track = await getInput(source).getPrimaryVideoTrack();
      if (track) {
        const sink = new CanvasSink(track, { width, height, fit: fitOption, poolSize: 1 });
        // A hair inside the out point — asking for the exact boundary lands past
        // the last frame on most files and returns null.
        const at2 = at === "in" ? clip.inPoint : Math.max(clip.inPoint, clip.outPoint - 0.001);
        const wrapped = await sink.getCanvas(at2);
        gradeInto(
          ctx,
          width,
          height,
          clip,
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

    const frameDuration = 1 / OUTPUT_FPS;
    let encoded = 0;

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
      onProgress?.(0.15 + (encoded / frames.length) * 0.82);
    };

    for (const run of runs) {
      const clip = project.clips[run.clipIndex];
      const source = clip ? sources[clip.sourceId] : undefined;
      if (!clip || !source) continue;

      if (source.kind === "image") {
        const img = images.get(source.id) ?? null;
        gradeInto(liveCtx, width, height, clip, img, source.width, source.height, project.fitMode);
        for (let i = run.from; i <= run.to; i++) await composeAndEncode(frames[i]);
        continue;
      }

      const track = await getInput(source).getPrimaryVideoTrack();
      if (!track) continue;
      const sink = new CanvasSink(track, { width, height, fit: fitOption, poolSize: 2 });
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

  const { canvas, ctx } = makeCanvas(width, height);

  if (source.kind === "image") {
    const img = await loadImageElement(source);
    gradeInto(ctx, width, height, clip, img, source.width, source.height, project.fitMode);
  } else {
    const input = new Input({ source: new BlobSource(source.blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("No video track for cover frame");
    const sink = new CanvasSink(track, {
      width,
      height,
      fit: project.fitMode === "fill" ? "cover" : "contain",
      poolSize: 1,
    });
    const wrapped = await sink.getCanvas(resolved.sourceTime);
    gradeInto(
      ctx,
      width,
      height,
      clip,
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
