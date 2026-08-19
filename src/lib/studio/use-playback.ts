// The studio's transport: one requestAnimationFrame clock that every media
// element on the page is slaved to.
//
// The timeline is the master, not any one <video>. That inversion is what makes
// a multi-clip editor work at all — a clip running at 0.4x, a detached audio
// chip sitting three seconds late and a still photo have no shared notion of
// "currentTime", so the wall clock owns the position and each element is nudged
// toward where the timeline says it should be. Elements are left alone while
// they are within DRIFT_TOLERANCE, because seeking a playing video is the one
// thing guaranteed to stutter.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioDuration,
  clipStarts,
  projectDuration,
  type AudioClip,
  type StudioProject,
  type VideoClip,
} from "./types";
import { transitionStateAt } from "./render";

/** How far an element may wander before we correct it, in seconds. */
const DRIFT_TOLERANCE = 0.32;

export type PlaybackApi = {
  time: number;
  timeRef: React.RefObject<number>;
  playing: boolean;
  duration: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  /** Stable per-id ref callbacks. Inline `ref={el => set(id, el)}` arrows are a
   *  new function every render, which makes React detach and re-attach the ref
   *  sixty times a second while playing — and the rAF loop can land in the gap
   *  where the element is deregistered. */
  clipRef: (clipId: string) => (el: HTMLVideoElement | null) => void;
  audioRef: (audioId: string) => (el: HTMLAudioElement | null) => void;
  /** Fires every frame with the current time — for imperative consumers (the
   *  timeline's scroll position) that must not re-render at 60fps. */
  subscribe: (fn: (time: number) => void) => () => void;
};

function clipSourceTime(clip: VideoClip, start: number, time: number): number {
  const local = Math.max(0, time - start);
  return Math.min(clip.outPoint, clip.inPoint + local * clip.speed);
}

function audioSourceTime(audio: AudioClip, time: number): number {
  const local = Math.max(0, time - audio.timelineStart);
  return Math.min(audio.outPoint, audio.inPoint + local * audio.speed);
}

export function usePlayback(project: StudioProject): PlaybackApi {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  const clipEls = useRef(new Map<string, HTMLVideoElement>());
  const audioEls = useRef(new Map<string, HTMLAudioElement>());
  const listeners = useRef(new Set<(t: number) => void>());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  const duration = projectDuration(project);
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const subscribe = useCallback((fn: (t: number) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const setClipEl = useCallback((clipId: string, el: HTMLVideoElement | null) => {
    if (el) clipEls.current.set(clipId, el);
    else clipEls.current.delete(clipId);
  }, []);

  const setAudioEl = useCallback((audioId: string, el: HTMLAudioElement | null) => {
    if (el) audioEls.current.set(audioId, el);
    else audioEls.current.delete(audioId);
  }, []);

  const clipRefCache = useRef(new Map<string, (el: HTMLVideoElement | null) => void>());
  const clipRef = useCallback(
    (clipId: string) => {
      let fn = clipRefCache.current.get(clipId);
      if (!fn) {
        fn = (el: HTMLVideoElement | null) => setClipEl(clipId, el);
        clipRefCache.current.set(clipId, fn);
      }
      return fn;
    },
    [setClipEl],
  );

  const audioRefCache = useRef(new Map<string, (el: HTMLAudioElement | null) => void>());
  const audioRef = useCallback(
    (audioId: string) => {
      let fn = audioRefCache.current.get(audioId);
      if (!fn) {
        fn = (el: HTMLAudioElement | null) => setAudioEl(audioId, el);
        audioRefCache.current.set(audioId, fn);
      }
      return fn;
    },
    [setAudioEl],
  );

  // Pushes every element to where the timeline says it should be. Called from
  // the rAF loop while playing and once per seek while paused.
  const syncElements = useCallback((t: number, isPlaying: boolean) => {
    const current = projectRef.current;
    const starts = clipStarts(current.clips);
    const state = transitionStateAt(current.clips, t);

    for (let i = 0; i < current.clips.length; i++) {
      const clip = current.clips[i];
      const el = clipEls.current.get(clip.id);
      if (!el) continue;

      const isLive = state
        ? state.liveIndex === i
        : t >= starts[i] && t < starts[i] + clipDurationOf(clip);
      // During a transition the partner clip holds a boundary frame; outside one,
      // anything that isn't live is parked at its own start so that stepping into
      // it later is instant rather than a seek-and-stall.
      let target: number;
      if (state && state.outgoingIndex === i) target = state.outgoingSourceTime;
      else if (state && state.incomingIndex === i) target = state.incomingSourceTime;
      else target = clipSourceTime(clip, starts[i], t);

      const muted = current.masterMuted || clip.muted || clip.audioDetached;
      if (el.muted !== muted) el.muted = muted;
      const volume = Math.min(1, Math.max(0, clip.volume));
      if (Math.abs(el.volume - volume) > 0.01) el.volume = volume;

      if (isLive && isPlaying) {
        if (el.playbackRate !== clip.speed) el.playbackRate = clip.speed;
        if (Math.abs(el.currentTime - target) > DRIFT_TOLERANCE) el.currentTime = target;
        if (el.paused) void el.play().catch(() => {});
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - target) > 0.02) el.currentTime = target;
      }
    }

    for (const audio of current.audio) {
      const el = audioEls.current.get(audio.id);
      if (!el) continue;
      const start = audio.timelineStart;
      const end = start + audioDuration(audio);
      const inRange = t >= start && t < end;
      const target = audioSourceTime(audio, t);

      const muted = current.masterMuted || audio.muted;
      if (el.muted !== muted) el.muted = muted;
      const volume = Math.min(1, Math.max(0, audio.volume * fadeGain(audio, t)));
      if (Math.abs(el.volume - volume) > 0.01) el.volume = volume;

      if (inRange && isPlaying) {
        if (el.playbackRate !== audio.speed) el.playbackRate = audio.speed;
        if (Math.abs(el.currentTime - target) > DRIFT_TOLERANCE) el.currentTime = target;
        if (el.paused) void el.play().catch(() => {});
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - target) > 0.05) el.currentTime = target;
      }
    }
  }, []);

  const publish = useCallback((t: number) => {
    timeRef.current = t;
    setTime(t);
    for (const fn of listeners.current) fn(t);
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    for (const el of clipEls.current.values()) if (!el.paused) el.pause();
    for (const el of audioEls.current.values()) if (!el.paused) el.pause();
  }, []);

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.min(durationRef.current, Math.max(0, t));
      publish(clamped);
      syncElements(clamped, playingRef.current);
    },
    [publish, syncElements],
  );

  const play = useCallback(() => {
    if (durationRef.current <= 0) return;
    // Pressing play at the very end restarts, which is what every player does
    // and what "watch it back" means after an edit.
    if (timeRef.current >= durationRef.current - 0.02) publish(0);
    playingRef.current = true;
    setPlaying(true);
    lastTickRef.current = performance.now();
    syncElements(timeRef.current, true);
  }, [publish, syncElements]);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!playingRef.current) return;

      const delta = Math.min(0.25, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      const next = timeRef.current + delta;

      if (next >= durationRef.current) {
        publish(durationRef.current);
        syncElements(durationRef.current, false);
        playingRef.current = false;
        setPlaying(false);
        for (const el of clipEls.current.values()) if (!el.paused) el.pause();
        for (const el of audioEls.current.values()) if (!el.paused) el.pause();
        return;
      }

      publish(next);
      syncElements(next, true);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [publish, syncElements]);

  // Any structural edit (split, delete, speed) can move the ground under the
  // playhead — re-park every element against the new geometry.
  useEffect(() => {
    syncElements(timeRef.current, playingRef.current);
  }, [project, syncElements]);

  // Leaving the screen mid-playback must not leave a video running in the
  // background with the page gone.
  useEffect(() => {
    const els = clipEls.current;
    const auds = audioEls.current;
    return () => {
      for (const el of els.values()) el.pause();
      for (const el of auds.values()) el.pause();
    };
  }, []);

  return {
    time,
    timeRef,
    playing,
    duration,
    play,
    pause,
    toggle,
    seek,
    clipRef,
    audioRef,
    subscribe,
  };
}

function clipDurationOf(clip: VideoClip): number {
  return Math.max(0, (clip.outPoint - clip.inPoint) / clip.speed);
}

/** Preview-side twin of the fade envelope the exporter schedules on the mixer. */
function fadeGain(audio: AudioClip, time: number): number {
  const start = audio.timelineStart;
  const end = start + audioDuration(audio);
  if (time <= start || time >= end) return 0;
  let gain = 1;
  if (audio.fadeIn > 0 && time < start + audio.fadeIn) gain = (time - start) / audio.fadeIn;
  if (audio.fadeOut > 0 && time > end - audio.fadeOut) {
    gain = Math.min(gain, (end - time) / audio.fadeOut);
  }
  return Math.min(1, Math.max(0, gain));
}
