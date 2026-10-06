import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { StudioSheet } from "../controls";
import { formatTimecode } from "@/lib/studio/types";

// Talk over the video. Recorded in the app, never picked from the phone: a
// sound on a post is Oakmonte distributing it, and the one sound a seller
// unquestionably has the rights to is their own voice, recorded here — see
// POSTPONED "Decided against", which names in-app recording as the way back.
//
// The timeline plays while you talk, silenced, so you can time the words to
// the picture without the video's own sound going back into the mic. The
// take lands as a voiceover chip where recording began, and music ducks
// under it (ducking.ts).

/** iOS Safari records MP4/AAC and can't decode WebM; Chrome records WebM and
 *  decodes both. Ask for MP4 first so a take made on an iPhone plays on one. */
function recorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function VoiceoverPanel({
  playing,
  currentTime,
  onStart,
  onStop,
  onRecorded,
  onDone,
}: {
  playing: boolean;
  currentTime: number;
  /** Start the timeline playing, silenced. */
  onStart: () => void;
  /** Stop it and give the sound back. */
  onStop: () => void;
  onRecorded: (blob: Blob, startTime: number) => void;
  onDone: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const stopRef = useRef<() => void>(() => {});

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record sound.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError("Oakmonte needs your microphone for this. Allow it in your browser's settings.");
      return;
    }
    const mimeType = recorderMime();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/mp4" });
      if (blob.size > 0) onRecorded(blob, startedAt.current);
    };
    startedAt.current = currentTime;
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    onStart();
  }

  function stop() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    onStop();
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }
  stopRef.current = stop;

  // The video ran out: the take ends with it.
  useEffect(() => {
    if (recording && !playing) stopRef.current();
  }, [recording, playing]);

  // Closing the sheet mid-take keeps what was said rather than throwing it away.
  useEffect(() => () => stopRef.current(), []);

  return (
    <StudioSheet title="Voiceover" onDone={onDone}>
      <div className="flex flex-col items-center gap-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => (recording ? stop() : void start())}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={`flex h-16 w-16 items-center justify-center rounded-full active:scale-95 ${
            recording ? "bg-white text-red-500" : "bg-red-500 text-white"
          }`}
        >
          {recording ? <Square size={22} fill="currentColor" /> : <Mic size={26} />}
        </button>
        <p className="text-center text-[12px] leading-snug text-white/65">
          {recording
            ? `Recording from ${formatTimecode(startedAt.current, false)} — tap to stop`
            : "Records from the playhead while the video plays. Headphones keep the room quiet."}
        </p>
        {error && <p className="text-center text-[12px] text-red-300">{error}</p>}
      </div>
    </StudioSheet>
  );
}
