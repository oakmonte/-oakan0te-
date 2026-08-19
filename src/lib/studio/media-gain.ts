// Per-element gain for the preview, for the browsers where `el.volume` is a lie.
//
// iOS Safari makes HTMLMediaElement.volume read-only: assignment is silently
// ignored, the property keeps reporting 1, and no error is raised. On the
// studio's primary target device that means every per-clip volume fader and
// every audio fade envelope does nothing in the preview while working perfectly
// in the export — so the seller mixes by ear against full-volume playback and
// ships something they never heard.
//
// Routing through Web Audio fixes it, but it is not free: once an element is
// wired into a MediaElementAudioSourceNode, ALL of its audio goes through the
// graph, and a suspended AudioContext means silence. So this is used ONLY where
// the direct property is genuinely broken — detected by writing a value and
// reading it back, not by sniffing the user agent.
import { getAudioContext } from "./audio";

let volumeWritable: boolean | null = null;

/** Feature-tests `el.volume` once per session against a real element. */
export function supportsElementVolume(el: HTMLMediaElement): boolean {
  if (volumeWritable !== null) return volumeWritable;
  const previous = el.volume;
  try {
    el.volume = 0.5;
    volumeWritable = Math.abs(el.volume - 0.5) < 0.01;
    el.volume = previous;
  } catch {
    volumeWritable = false;
  }
  return volumeWritable;
}

const gains = new WeakMap<HTMLMediaElement, GainNode>();
const failed = new WeakSet<HTMLMediaElement>();

/** The GainNode carrying this element's audio, created on first use.
 *  Returns null when routing isn't possible, so callers fall back to
 *  `el.volume` rather than losing the audio entirely. */
function gainFor(el: HTMLMediaElement): GainNode | null {
  const existing = gains.get(el);
  if (existing) return existing;
  if (failed.has(el)) return null;
  try {
    const ctx = getAudioContext();
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    gains.set(el, gain);
    return gain;
  } catch {
    // Already routed by something else, or the context refused. Never retry —
    // createMediaElementSource throws permanently once an element is taken.
    failed.add(el);
    return null;
  }
}

/** Sets an element's playback gain by whichever mechanism actually works here. */
export function applyGain(el: HTMLMediaElement, volume: number): void {
  const target = Math.min(1, Math.max(0, volume));
  if (supportsElementVolume(el)) {
    if (Math.abs(el.volume - target) > 0.01) el.volume = target;
    return;
  }
  const gain = gainFor(el);
  if (!gain) {
    // No route and no writable property: the best remaining approximation is
    // all-or-nothing, which at least honours a fader dragged to zero.
    el.muted = el.muted || target <= 0.01;
    return;
  }
  if (Math.abs(gain.gain.value - target) > 0.01) gain.gain.value = target;
}

/** A suspended context produces silence through the graph. Call from the play
 *  gesture, which is the only moment a browser will let it start. */
export function resumeAudioRouting(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* nothing routed yet */
  }
}
