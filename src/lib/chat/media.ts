/**
 * Getting photos and voice notes small enough to send over a slow mobile
 * connection, in the browser, before upload.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export type PreparedImage = {
  blob: Blob;
  extension: string;
  width: number;
  height: number;
};

/** Downscales to `maxEdge` (MAX_EDGE by default) on the long side and
 *  re-encodes as JPEG. GIFs pass through untouched so they keep animating. */
export async function prepareImage(
  file: File,
  { maxEdge = MAX_EDGE }: { maxEdge?: number } = {},
): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);
  const { width, height } = bitmap;

  if (file.type === "image/gif") {
    closeBitmap(bitmap);
    return { blob: file, extension: "gif", width, height };
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  closeBitmap(bitmap);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  // Tiny canvases on old Safari can come back null; the original still sends.
  if (!blob) return { blob: file, extension: extensionFor(file.type), width, height };
  return { blob, extension: "jpg", width: targetWidth, height: targetHeight };
}

type Drawable = ImageBitmap | HTMLImageElement;

async function loadBitmap(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF orientation, so phone photos aren't
      // sent sideways.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img>, which Safari decodes HEIC with */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function closeBitmap(bitmap: Drawable) {
  if ("close" in bitmap) bitmap.close();
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

/* ---------- voice notes ---------- */

export type VoiceRecording = {
  blob: Blob;
  extension: string;
  duration: number;
  waveform: number[];
};

const WAVEFORM_BARS = 40;

/** iOS Safari records audio/mp4 only; Chromium prefers webm/opus. */
function pickAudioType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function canRecordVoice(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** A started recording. `levels` is sampled live for the recording UI; the
 *  final waveform is those samples bucketed down to WAVEFORM_BARS. */
export class VoiceRecorder {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private samples: number[] = [];
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;
  private startedAt = Date.now();

  onLevel?: (level: number) => void;

  private constructor(private stream: MediaStream) {
    const mimeType = pickAudioType();
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start(250);
    this.startedAt = Date.now();
    this.meter();
  }

  static async start(): Promise<VoiceRecorder> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    return new VoiceRecorder(stream);
  }

  get elapsed(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  private meter() {
    try {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      this.context = new AudioContextCtor();
      const source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      const buffer = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const value of buffer) {
          const centred = (value - 128) / 128;
          sum += centred * centred;
        }
        const level = Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
        this.samples.push(level);
        this.onLevel?.(level);
        this.frame = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* no meter: the recording itself still works */
    }
  }

  private teardown() {
    cancelAnimationFrame(this.frame);
    this.analyser = null;
    void this.context?.close().catch(() => undefined);
    for (const track of this.stream.getTracks()) track.stop();
  }

  cancel() {
    if (this.recorder.state !== "inactive") this.recorder.stop();
    this.teardown();
  }

  stop(): Promise<VoiceRecording> {
    const duration = this.elapsed;
    return new Promise((resolve) => {
      this.recorder.onstop = () => {
        this.teardown();
        const type = this.recorder.mimeType || pickAudioType() || "audio/mp4";
        const blob = new Blob(this.chunks, { type: type.split(";")[0] });
        resolve({
          blob,
          extension: type.includes("webm") ? "webm" : type.includes("ogg") ? "ogg" : "m4a",
          duration,
          waveform: bucket(this.samples, WAVEFORM_BARS),
        });
      };
      if (this.recorder.state === "inactive") this.recorder.onstop?.(new Event("stop"));
      else this.recorder.stop();
    });
  }
}

export function bucket(samples: number[], bars: number): number[] {
  if (samples.length === 0) return Array.from({ length: bars }, () => 0.15);
  const size = samples.length / bars;
  const out: number[] = [];
  for (let index = 0; index < bars; index += 1) {
    const slice = samples.slice(
      Math.floor(index * size),
      Math.max(Math.floor((index + 1) * size), Math.floor(index * size) + 1),
    );
    const peak = slice.length ? Math.max(...slice) : 0;
    out.push(Math.round(Math.max(0.08, Math.min(1, peak)) * 100) / 100);
  }
  return out;
}
