// Trim logic for the after-shot edit screen. Wraps mediabunny's Conversion
// API (lossless remux by default — only transcodes if the container/codec
// combo forces it) and exposes the track's actual keyframe positions so the
// UI can snap trim handles to cuts that don't force a re-encode.
import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  EncodedPacketSink,
} from "mediabunny";

export async function getVideoKeyframes(
  blob: Blob
): Promise<{ duration: number; keyframes: number[] }> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const duration = await input.computeDuration();
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) return { duration, keyframes: [0, duration] };

  const sink = new EncodedPacketSink(videoTrack);
  const keyframes: number[] = [];
  let packet = await sink.getKeyPacket(0, { metadataOnly: true, verifyKeyPackets: true });
  while (packet) {
    keyframes.push(packet.timestamp);
    packet = await sink.getNextKeyPacket(packet, { metadataOnly: true, verifyKeyPackets: true });
  }
  if (keyframes.length === 0 || keyframes[0] > 0) keyframes.unshift(0);
  return { duration, keyframes };
}

// Nearest-keyframe snap. Density comes from whatever GOP the capture encoder
// used (~2s by default under MediaRecorder) — this just snaps a requested
// handle position to whatever keyframes actually exist in this clip.
export function snapToNearestKeyframe(time: number, keyframes: number[]): number {
  if (keyframes.length === 0) return time;
  let closest = keyframes[0];
  let closestDist = Math.abs(time - closest);
  for (const k of keyframes) {
    const d = Math.abs(time - k);
    if (d < closestDist) {
      closest = k;
      closestDist = d;
    }
  }
  return closest;
}

export async function trimVideo(
  blob: Blob,
  startTime: number,
  endTime: number,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });

  const conversion = await Conversion.init({
    input,
    output,
    trim: { start: startTime, end: endTime },
  });

  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks.map((t) => t.reason).join(", ");
    throw new Error(`Trim failed: ${reasons}`);
  }

  if (onProgress) conversion.onProgress = onProgress;
  await conversion.execute();

  if (!target.buffer) throw new Error("Trim produced no output buffer");
  return new Blob([target.buffer], { type: "video/mp4" });
}