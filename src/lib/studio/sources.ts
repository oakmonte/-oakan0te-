// Loading media into the studio's source registry.
//
// A source is probed once, on the way in, and every clip that points at it reuses
// those numbers. Probing goes through mediabunny rather than a hidden <video>
// element for one concrete reason: a <video> can tell you width, height and
// duration but cannot tell you whether the file has an audio track at all, and
// "does this clip have sound to detach" is a question the timeline UI asks on
// every render.
import { Input, ALL_FORMATS, BlobSource } from "mediabunny";
import { uid, type StudioSource } from "./types";

/** How long a still photo occupies the timeline when you drop one in. */
export const DEFAULT_IMAGE_DURATION = 3;

/** How many packets to look at when measuring a file's frame rate. Phone
 *  captures are variable-frame-rate, so a single interval is meaningless and the
 *  average over a few seconds is not; 120 packets is four seconds of 30fps
 *  footage. Reading the whole file would be exact and pointless — it is a
 *  metadata-only scan either way, but on a three-minute clip that is thousands
 *  of packets to refine a number we then snap to a standard rate. */
const FPS_SAMPLE_PACKETS = 120;

async function probeVideo(blob: Blob): Promise<{
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  fps: number;
}> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const [videoTrack, audioTrack, duration] = await Promise.all([
    input.getPrimaryVideoTrack(),
    input.getPrimaryAudioTrack(),
    input.computeDuration(),
  ]);
  if (!videoTrack) throw new Error("That file has no video track");
  // metadataOnly keeps this to a header walk — packet timestamps are all the
  // average needs, and loading the frames themselves to count them would make
  // picking a clip visibly slower. A failure here is not fatal: fps 0 means
  // "unknown" and the export falls back to its default rate.
  const stats = await videoTrack
    .computePacketStats(FPS_SAMPLE_PACKETS, { metadataOnly: true })
    .catch(() => null);
  const fps = stats?.averagePacketRate ?? 0;
  return {
    duration,
    // displayWidth/Height rather than codedWidth — a portrait phone capture is
    // very often stored landscape with a rotation flag, and every size the
    // studio works in (preview box, export canvas, filmstrip) is display space.
    width: videoTrack.displayWidth,
    height: videoTrack.displayHeight,
    hasAudio: audioTrack !== null,
    fps: Number.isFinite(fps) && fps > 0 ? fps : 0,
  };
}

async function probeAudio(blob: Blob): Promise<{ duration: number }> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryAudioTrack();
  if (!track) throw new Error("That file has no audio track");
  return { duration: await input.computeDuration() };
}

async function probeImage(url: string): Promise<{ width: number; height: number }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export async function loadSource(blob: Blob, name: string): Promise<StudioSource> {
  const url = URL.createObjectURL(blob);
  try {
    if (blob.type.startsWith("image/")) {
      const { width, height } = await probeImage(url);
      return {
        id: uid("src"),
        kind: "image",
        blob,
        url,
        duration: DEFAULT_IMAGE_DURATION,
        width,
        height,
        hasAudio: false,
        fps: 0,
        name,
      };
    }
    if (blob.type.startsWith("audio/")) {
      const probe = await probeAudio(blob);
      return {
        id: uid("src"),
        kind: "audio",
        blob,
        url,
        width: 0,
        height: 0,
        hasAudio: true,
        fps: 0,
        name,
        ...probe,
      };
    }
    const probe = await probeVideo(blob);
    return { id: uid("src"), kind: "video", blob, url, name, ...probe };
  } catch (err) {
    // The URL is this function's to own until it successfully hands a source
    // back; anything else leaks one blob URL per rejected file.
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Files the gallery picker is allowed to hand back. */
export const STUDIO_ACCEPT = "video/*,image/*";
/** Files the Sound tool accepts. */
export const STUDIO_AUDIO_ACCEPT = "audio/*";

export function fileLabel(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "");
  return base.length > 18 ? `${base.slice(0, 17)}…` : base || "clip";
}
