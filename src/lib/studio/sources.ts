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

async function probeVideo(blob: Blob): Promise<{
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const [videoTrack, audioTrack, duration] = await Promise.all([
    input.getPrimaryVideoTrack(),
    input.getPrimaryAudioTrack(),
    input.computeDuration(),
  ]);
  if (!videoTrack) throw new Error("That file has no video track");
  return {
    duration,
    // displayWidth/Height rather than codedWidth — a portrait phone capture is
    // very often stored landscape with a rotation flag, and every size the
    // studio works in (preview box, export canvas, filmstrip) is display space.
    width: videoTrack.displayWidth,
    height: videoTrack.displayHeight,
    hasAudio: audioTrack !== null,
  };
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
        name,
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

export function fileLabel(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "");
  return base.length > 18 ? `${base.slice(0, 17)}…` : base || "clip";
}
