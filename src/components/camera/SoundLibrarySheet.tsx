import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Search } from "lucide-react";
import CameraPanel from "@/components/camera/CameraPanel";
import { authedFetch } from "@/lib/authed-fetch";
import { type LibraryTrack, SOUND_GENRES, formatDuration } from "@/lib/sound-library";

// Pick a track from the catalogue.
//
// Shared by the photo editor and the after-shot editor so a sound is chosen
// the same way whichever screen the seller arrived from.
//
// It hands back a `LibraryTrack` rather than a ready-made sound. The caller
// owns the shape it keeps (`PhotoSound` on one screen, `CaptureAudio` on the
// other) and this component has no business knowing about either.
//
// This catalogue is the ONLY way to put a sound on a post. There used to be a
// "use a sound from your phone" row here as well, and it was removed on
// purpose — see the note in POSTPONED 0.2. The short version: Oakmonte stores
// the file on its own CDN and serves it publicly under a post selling
// something, so an uploaded track is Oakmonte distributing it commercially,
// and we hold no licences for that. Every track reachable from this sheet is
// one we can prove we were allowed to use.

const SEARCH_DEBOUNCE_MS = 350;

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (track: LibraryTrack) => void;
};

export default function SoundLibrarySheet({ open, onClose, onPick }: Props) {
  const [genre, setGenre] = useState<string>(SOUND_GENRES[0].id);
  const [text, setText] = useState("");
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Every search supersedes the one before it. Without this a fast typist gets
  // whichever response happens to land last rather than the one matching what
  // is on screen — the classic search-box race, and on screen it just looks
  // like the filter is broken.
  const requestRef = useRef(0);

  const load = useCallback(async (nextGenre: string, nextText: string) => {
    const id = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ genre: nextGenre });
      if (nextText.trim()) params.set("q", nextText.trim());
      const res = await authedFetch(`/api/sounds?${params.toString()}`);
      const body = await res.json();
      if (id !== requestRef.current) return;
      if (!res.ok) throw new Error(body?.error ?? "Couldn't load sounds");
      setTracks(body.tracks ?? []);
    } catch (err) {
      if (id !== requestRef.current) return;
      console.error("SoundLibrarySheet: load failed", err);
      setError("Couldn't load sounds. Check your connection and try again.");
      setTracks([]);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  // A genre tap applies at once; typing waits, so we aren't firing a search
  // per keystroke at somebody else's free service.
  useEffect(() => {
    if (!open) return;
    if (!text.trim()) {
      void load(genre, "");
      return;
    }
    const timer = setTimeout(() => void load(genre, text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, genre, text, load]);

  // Nothing should still be playing behind a closed sheet.
  useEffect(() => {
    if (open) return;
    audioRef.current?.pause();
    setPlayingId(null);
  }, [open]);

  function togglePreview(track: LibraryTrack) {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === track.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = track.streamUrl;
    // This runs inside a tap, so autoplay policy is already satisfied. A
    // rejection here is a real failure — a transcode that never got made, or
    // no network — and saying so beats a button that silently does nothing.
    void el.play().then(
      () => setPlayingId(track.id),
      () => {
        setPlayingId(null);
        setError("That track wouldn't play. Try another one.");
      },
    );
  }

  function choose(track: LibraryTrack) {
    audioRef.current?.pause();
    setPlayingId(null);
    onPick(track);
    onClose();
  }

  return (
    <CameraPanel open={open} title="Sound" onClose={onClose} height={520}>
      <div className="relative mb-3">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search for a sound"
          className="w-full rounded-xl bg-white/[0.08] py-2.5 pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-white/35 focus:bg-white/[0.12]"
        />
      </div>

      {/* Genres rather than only a search box. Nobody knows what to type into
          a catalogue they have never seen, and the honest answer to "what is
          in here" is a row of things to tap. */}
      <div className="no-scrollbar -mx-6 mb-3 flex gap-2 overflow-x-auto px-6 pb-1">
        {SOUND_GENRES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGenre(g.id)}
            aria-pressed={genre === g.id}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors active:scale-95 ${
              genre === g.id ? "bg-white text-black" : "bg-white/[0.10] text-white/75"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error && <p className="px-1 pb-2 text-[12px] leading-snug text-red-300">{error}</p>}

      {loading && tracks.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-white/40" />
        </div>
      ) : tracks.length === 0 ? (
        <p className="px-2 py-10 text-center text-[13px] leading-snug text-white/40">
          {text.trim() ? `Nothing here for "${text.trim()}".` : "No sounds in this one yet."}
        </p>
      ) : (
        <ul className="pb-4">
          {tracks.map((track) => {
            const playing = playingId === track.id;
            return (
              <li key={track.id} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => togglePreview(track)}
                  aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.12] active:scale-90"
                >
                  {playing ? (
                    <Pause size={14} fill="white" strokeWidth={0} />
                  ) : (
                    <Play size={14} className="ml-[2px]" fill="white" strokeWidth={0} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] leading-tight text-white">{track.title}</p>
                  {/* Artist and licence are shown before the track is picked,
                      not after. For a CC BY track the credit is a condition of
                      using it at all, so a seller is entitled to see whose name
                      is about to go under their post. */}
                  <p className="truncate text-[11px] leading-tight text-white/40">
                    {[track.artist, formatDuration(track.durationSeconds), track.licence.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => choose(track)}
                  className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black active:scale-95"
                >
                  Use
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />
    </CameraPanel>
  );
}
