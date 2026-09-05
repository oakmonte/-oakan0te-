import {
  Input,
  Output,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  VideoSampleSink,
  AudioBufferSource,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from "mediabunny";
import {
  applyCompiledFilter,
  compileFilter,
  IDENTITY_FILTER,
  type CompiledFilter,
} from "@/lib/canvas-filter";
import { compileGrade, CAMERA_FILTERS } from "@/components/camera/filter-data";
import { drawLayers, preloadStickers } from "@/lib/layer-bake";
import type { Layer } from "@/lib/after-shot-layers";
import { adjustToCss } from "@/lib/photo-adjust";
import {
  clipDuration,
  fitRect,
  outputSize,
  type Clip,
  type ProjectRatio,
} from "@/lib/video-sequence";
import { buildSequenceAudio, type MusicTrack } from "@/lib/video-sequence-audio";

// Turning a timeline of clips into ONE video file.
//
// This is the sequence sibling of after-shot-export.ts, and it keeps that
// file's central rule: one composite pass, from the untouched sources. Every
// clip's filter, tone adjustments and layers land on the frame in the same
// draw, and each source is decoded exactly once. Nothing is pre-baked into an
// intermediate clip and re-encoded on the way in — doing that would cost a
// generation of quality per clip, which on a six-clip edit is six.
//
// What is genuinely different from the single-media path: there is one output
// canvas, sized to the PROJECT ratio, and every clip is fitted into it. Mixed
// portrait video and square photos have to agree on a frame somewhere, and the
// project is the only place that can decide.

const OUTPUT_FPS = 30;
// A still doesn't change between frames, so it doesn't need 30 of them a
// second — the encoder would just emit near-empty P-frames. Low enough to be
// cheap, high enough that scrubbing a photo section doesn't feel chunky.
const STILL_FPS = 6;

export type SequenceProgress = (ratio: number) => void;

function drawFilteredFrame(
  ctx: CanvasRenderingContext2D,
  compiled: CompiledFilter,
  width: number,
  height: number,
) {
  if (compiled === IDENTITY_FILTER) return;
  const frame = ctx.getImageData(0, 0, width, height);
  applyCompiledFilter(frame, compiled);
  ctx.putImageData(frame, 0, 0);
}

/** The clip's grade plus its manual tone adjustments, as ONE compiled filter —
 *  same trick as after-shot-export.ts, so the pixels are still walked once. */
function compileClipFilter(clip: Clip): CompiledFilter {
  const filter = CAMERA_FILTERS.find((f) => f.id === clip.filterId) ?? CAMERA_FILTERS[0];
  const grade = compileGrade(filter, clip.filterIntensity);
  const adjustCss = adjustToCss(clip.adjust);
  if (!adjustCss) return grade;
  return { ops: [...grade.ops, ...compileFilter(adjustCss).ops] };
}

/** Real bytes for a clip. Remote clips (drafts, existing posts) are URLs until
 *  export actually needs to decode them. */
async function clipBlob(clip: Clip): Promise<Blob> {
  if (!clip.remote && clip.blob.size > 0) return clip.blob;
  const res = await fetch(clip.url);
  if (!res.ok) throw new Error("Couldn't load one of your clips");
  return res.blob();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load one of your photos"));
    img.src = url;
  });
}

export async function exportSequence(
  clips: Clip[],
  layersByClip: Record<string, Layer[]>,
  ratio: ProjectRatio,
  music: MusicTrack | null,
  onProgress?: SequenceProgress,
): Promise<Blob> {
  if (clips.length === 0) throw new Error("Nothing on the timeline yet");

  const { width, height } = outputSize(ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const target = new BufferTarget();
  const format = new Mp4OutputFormat();
  const output = new Output({ format, target });

  // Only ask for codecs this container can actually hold — VP8-in-MP4 gets you
  // a file nothing will play.
  const videoCodec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
    width,
    height,
    quality: QUALITY_HIGH,
  });
  if (!videoCodec) throw new Error("No encodable video codec available on this device");

  const canvasSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_HIGH });
  output.addVideoTrack(canvasSource);

  // The whole soundtrack, mixed before anything is encoded — see
  // video-sequence-audio.ts. Doing it up front rather than clip-by-clip is
  // what lets several sources overlap (music under speech) and lets a sped-up
  // clip keep its sound; passing encoded packets through, which the
  // single-clip path can do, can express neither.
  //
  // It has to happen BEFORE output.start(), because a track cannot be added to
  // an output that has already begun.
  const mixed = await buildSequenceAudio(clips, music, clipBlob);
  let audioSource: AudioBufferSource | null = null;
  if (mixed) {
    const audioCodec = await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), {
      numberOfChannels: mixed.numberOfChannels,
      sampleRate: mixed.sampleRate,
    });
    if (audioCodec) {
      audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_MEDIUM });
      output.addAudioTrack(audioSource);
    }
  }

  await output.start();

  // One buffer, starting at zero, so the track's timing is the mixdown's own —
  // nothing here has to re-derive where each clip's sound belongs.
  if (mixed && audioSource) await audioSource.add(mixed);

  const totalDuration = clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
  let offset = 0;

  try {
    for (const clip of clips) {
      const duration = clipDuration(clip);
      if (duration <= 0) continue;

      const layers = layersByClip[clip.id] ?? [];
      const stickers = await preloadStickers(layers);
      const compiled = compileClipFilter(clip);

      if (clip.kind === "photo") {
        await writeStill(
          { ctx, canvas, canvasSource, width, height },
          clip,
          compiled,
          layers,
          stickers,
          offset,
          duration,
        );
      } else {
        await writeVideo(
          { ctx, canvas, canvasSource, width, height },
          clip,
          compiled,
          layers,
          stickers,
          offset,
        );
      }

      offset += duration;
      if (onProgress && totalDuration > 0) onProgress(Math.min(1, offset / totalDuration));
    }

    canvasSource.close();
    audioSource?.close();
    await output.finalize();
    onProgress?.(1);

    if (!target.buffer) throw new Error("Export produced no output buffer");
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  }
}

type Stage = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  canvasSource: CanvasSource;
  width: number;
  height: number;
};

/** Composite the frame once, then hold it for the clip's duration. */
async function writeStill(
  stage: Stage,
  clip: Clip,
  compiled: CompiledFilter,
  layers: Layer[],
  stickers: Awaited<ReturnType<typeof preloadStickers>>,
  offset: number,
  duration: number,
) {
  const { ctx, canvasSource, width, height } = stage;
  const blob = await clipBlob(clip);
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const rect = fitRect(
      { w: img.naturalWidth, h: img.naturalHeight },
      { w: width, h: height },
      clip.fit,
    );
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
    drawFilteredFrame(ctx, compiled, width, height);
    drawLayers(ctx, layers, width, height, stickers);

    const step = 1 / STILL_FPS;
    for (let t = 0; t < duration - 1e-4; t += step) {
      await canvasSource.add(offset + t, Math.min(step, duration - t));
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode the trimmed window, composite each frame, and re-time it onto the
 *  sequence's clock. */
async function writeVideo(
  stage: Stage,
  clip: Clip,
  compiled: CompiledFilter,
  layers: Layer[],
  stickers: Awaited<ReturnType<typeof preloadStickers>>,
  offset: number,
) {
  const { ctx, canvasSource, width, height } = stage;
  const blob = await clipBlob(clip);
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error("One of your clips has no video track");

  const speed = clip.speed || 1;
  const sourceRect = fitRect(
    { w: videoTrack.displayWidth, h: videoTrack.displayHeight },
    { w: width, h: height },
    clip.fit,
  );
  const fallback = 1 / OUTPUT_FPS;

  const sink = new VideoSampleSink(videoTrack);
  for await (const sample of sink.samples(clip.trimStart, clip.trimEnd)) {
    try {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      // VideoSample.draw has no source-rect form, so fitting is done the way
      // after-shot-export.ts does cropping: draw the whole frame scaled and
      // shifted so the wanted region lands on the canvas, and let the canvas
      // bounds clip the rest.
      const scaleX = sourceRect.dw / sourceRect.sw;
      const scaleY = sourceRect.dh / sourceRect.sh;
      sample.draw(
        ctx,
        sourceRect.dx - sourceRect.sx * scaleX,
        sourceRect.dy - sourceRect.sy * scaleY,
        videoTrack.displayWidth * scaleX,
        videoTrack.displayHeight * scaleY,
      );
      drawFilteredFrame(ctx, compiled, width, height);
      drawLayers(ctx, layers, width, height, stickers);

      // Timestamps come from the source frame, re-based onto the sequence and
      // divided by speed. Index-times-FPS would drift, because phone captures
      // are variable-frame-rate.
      const timestamp = offset + (sample.timestamp - clip.trimStart) / speed;
      const duration = (sample.duration || fallback) / speed;
      if (timestamp >= offset - 1e-6) await canvasSource.add(timestamp, duration);
    } finally {
      sample.close();
    }
  }
  // Sound is not this function's job. It was, once — walking each clip's audio
  // packets here — but that could only ever append one clip after another at
  // 1x. Music over speech and sped-up audio both need sources to overlap and
  // be resampled, which is a mix, and a mix has to happen before encoding
  // starts. buildSequenceAudio owns it now.
}
