import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  CloudOff,
  Download,
  Film,
  Images,
  Music,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { ConfirmDialog } from "@/components/messages/Sheet";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useDarkOverlay } from "@/lib/dark-overlay";
import { claimMediaSession, releaseMediaSession } from "@/lib/media-session";
import {
  deleteAllOffline,
  deleteOffline,
  formatBytes,
  formatSavedAt,
  getStorageInfo,
  indexBytes,
  isOfflineSupported,
  listOffline,
  primeOfflineShell,
  readCachedBlob,
  useOfflineEntries,
  type OfflineEntry,
  type StorageInfo,
} from "@/lib/offline-videos";

export const Route = createFileRoute("/offline-videos")({
  head: () => ({ meta: [{ title: "Offline videos — Oakmonte" }] }),
  component: OfflineVideosPage,
});

// ---------------------------------------------------------------------------
// Small browser-state hooks
// ---------------------------------------------------------------------------

function subscribeOnline(fn: () => void) {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
}

/** navigator.onLine. Only ever trusted in the "offline" direction -- false
 *  means there is definitely no network; true only means there might be. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** An object URL for a file in the offline cache: undefined while it loads,
 *  null when it isn't there. Revoked when the url changes or on unmount --
 *  each one pins the whole blob in memory until it is. */
function useCachedObjectUrl(url: string | null): string | null | undefined {
  const [objectUrl, setObjectUrl] = useState<string | null | undefined>(url ? undefined : null);
  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }
    let cancelled = false;
    let made: string | null = null;
    setObjectUrl(undefined);
    void readCachedBlob(url).then((blob) => {
      if (cancelled) return;
      made = blob ? URL.createObjectURL(blob) : null;
      setObjectUrl(made);
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [url]);
  return objectUrl;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Pending = { kind: "one"; entry: OfflineEntry } | { kind: "all" } | null;

/** Posts saved from the share sheet, played straight out of Cache Storage.
 *
 *  Nothing on this page touches the network: the list comes from the local
 *  index, the posters and media from the offline cache, so it keeps working
 *  with the connection off once the page is open. It also works signed out --
 *  what's saved belongs to the device, not the account.
 *
 *  The social surface (chat-* tokens), so it follows the phone's light/dark
 *  setting like the profile it's opened from. The viewer is black in both,
 *  like every other full-bleed media screen. */
function OfflineVideosPage() {
  const navigate = useNavigate();
  const live = useOfflineEntries();
  const online = useOnline();
  // null until the index has been checked against what's actually on disk
  // (see listOffline). Rendering the raw index first would briefly show a
  // post the browser has already evicted, then yank it away.
  const [checked, setChecked] = useState<{ pruned: number } | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [prunedDismissed, setPrunedDismissed] = useState(false);

  useEffect(() => {
    const ok = isOfflineSupported();
    setSupported(ok);
    if (!ok) return;
    // Refreshes the copy of this page the service worker opens with no
    // connection, so it matches the build that's live now.
    primeOfflineShell({ includeLoaded: true });
    let cancelled = false;
    listOffline()
      .then(({ pruned }) => {
        if (!cancelled) setChecked({ pruned });
      })
      .catch((err) => {
        console.error("offline-videos: couldn't read the offline cache", err);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-measured whenever what's saved changes: a delete should visibly give
  // the space back.
  const totalBytes = indexBytes(live);
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void getStorageInfo().then((info) => {
      if (!cancelled) setStorage(info);
    });
    return () => {
      cancelled = true;
    };
  }, [supported, totalBytes, live.length]);

  const openEntry = openId ? (live.find((e) => e.postId === openId) ?? null) : null;
  const closeViewer = useCallback(() => setOpenId(null), []);

  async function confirmDelete() {
    const target = pending;
    setPending(null);
    if (!target) return;
    setDeleteFailed(false);
    try {
      if (target.kind === "all") {
        setOpenId(null);
        await deleteAllOffline();
      } else {
        if (openId === target.entry.postId) setOpenId(null);
        await deleteOffline(target.entry.postId);
      }
    } catch (err) {
      console.error("offline-videos: delete failed", err);
      setDeleteFailed(true);
    }
  }

  const ready = supported === true && checked !== null && !loadFailed;
  const entries = ready ? live : [];

  return (
    <div className="min-h-[100dvh] bg-chat-bg text-chat-text">
      <header
        className="sticky top-0 z-10 bg-chat-bg"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="relative flex h-14 items-center justify-center px-14">
          <BackButton
            icon="chevron"
            size={26}
            className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full text-chat-text active:scale-95"
          />
          <h1 className="truncate text-[17px] font-semibold">Offline videos</h1>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setPending({ kind: "all" })}
              className="absolute right-2 h-10 rounded-full px-3 text-[14px] font-semibold text-chat-danger active:bg-chat-text/[0.08]"
            >
              Delete all
            </button>
          )}
        </div>
      </header>

      <main
        className="mx-auto max-w-[640px] px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
      >
        {!online && (
          <p className="mb-3 flex items-center gap-2 rounded-[14px] bg-chat-soft px-3.5 py-2.5 text-[13px]">
            <WifiOff size={16} className="shrink-0" />
            You&apos;re offline. Saved posts still play.
          </p>
        )}

        {deleteFailed && (
          <p className="mb-3 rounded-[14px] bg-chat-soft px-3.5 py-2.5 text-[13px] text-chat-danger">
            Couldn&apos;t delete everything just now. It will be cleaned up next time you open this
            page.
          </p>
        )}

        {ready && checked.pruned > 0 && !prunedDismissed && (
          <div className="mb-3 flex items-start gap-3 rounded-[14px] bg-chat-soft px-3.5 py-2.5">
            <p className="flex-1 text-[13px] leading-snug">
              {checked.pruned === 1
                ? "1 saved post was cleared by your browser to free up space."
                : `${checked.pruned} saved posts were cleared by your browser to free up space.`}{" "}
              Save them again while you&apos;re online.
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setPrunedDismissed(true)}
              className="-my-1.5 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-chat-muted"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {supported === false || loadFailed ? (
          <Unsupported loadFailed={loadFailed} />
        ) : !ready ? (
          <GridSkeleton />
        ) : entries.length === 0 ? (
          <EmptyState onBrowse={() => void navigate({ to: "/home" })} />
        ) : (
          <>
            <StorageSummary count={entries.length} bytes={totalBytes} storage={storage} />
            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
              {entries.map((entry) => (
                <li key={entry.postId}>
                  <SavedTile
                    entry={entry}
                    onOpen={() => setOpenId(entry.postId)}
                    onDelete={() => setPending({ kind: "one", entry })}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <AnimatePresence>
        {openEntry && (
          <OfflineViewer
            key={openEntry.postId}
            entry={openEntry}
            onClose={closeViewer}
            onDelete={() => setPending({ kind: "one", entry: openEntry })}
          />
        )}
      </AnimatePresence>

      {/* At page level, never inside the viewer: the viewer is a transformed
          (draggable) layer, and a `fixed` dialog inside one is laid out
          against it instead of the screen. */}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "all" ? "Delete all offline posts?" : "Remove from offline?"}
        body={
          pending?.kind === "all"
            ? `This frees ${formatBytes(totalBytes)}. You'll need a connection to save them again.`
            : "You'll need a connection to save it again."
        }
        confirmLabel={pending?.kind === "all" ? "Delete all" : "Remove"}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StorageSummary({
  count,
  bytes,
  storage,
}: {
  count: number;
  bytes: number;
  storage: StorageInfo | null;
}) {
  const quota = storage?.quota ?? null;
  const usage = storage?.usage ?? null;
  const free = quota !== null && usage !== null ? Math.max(0, quota - usage) : null;
  // The bar is this app's whole allowance; the dark part is offline posts,
  // the lighter part everything else the app keeps (sign-in, drafts, cache).
  const postsShare = quota ? Math.min(1, bytes / quota) : null;
  const otherShare = quota && usage !== null ? Math.min(1, Math.max(0, usage - bytes) / quota) : 0;

  return (
    <section className="rounded-[18px] bg-chat-elevated px-4 py-3.5" aria-label="Storage">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold">
          {count === 1 ? "1 post" : `${count} posts`} · {formatBytes(bytes)}
        </p>
        {free !== null && (
          <p className="text-[12.5px] text-chat-muted">{formatBytes(free)} available</p>
        )}
      </div>
      {postsShare !== null && (
        <div
          className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-chat-soft"
          role="img"
          aria-label={`Offline posts use ${formatBytes(bytes)} of ${formatBytes(quota ?? 0)} this app can store`}
        >
          {/* A sliver at minimum, so a few MB against a multi-GB quota still
              shows as something rather than an empty track. */}
          <span
            className="h-full bg-chat-text"
            style={{ width: `${Math.max(1.5, postsShare * 100)}%` }}
          />
          <span className="h-full bg-chat-text/30" style={{ width: `${otherShare * 100}%` }} />
        </div>
      )}
      <p className="mt-2 text-[12.5px] leading-snug text-chat-muted">
        {storage?.persisted === true
          ? "Kept on this device until you delete them."
          : storage?.persisted === false
            ? "Stored on this device. Your browser may clear them if your phone runs low on space."
            : "Stored on this device."}
      </p>
    </section>
  );
}

function SavedTile({
  entry,
  onOpen,
  onDelete,
}: {
  entry: OfflineEntry;
  onOpen: () => void;
  onDelete: () => void;
}) {
  // The saved poster, else the first photo in the post: both are in the
  // cache, so the grid needs no network either.
  const stillUrl = entry.posterUrl ?? entry.media.find((m) => m.type === "photo")?.url ?? null;
  const still = useCachedObjectUrl(stillUrl);
  const first = entry.media[0];
  const who = entry.author.username
    ? `@${entry.author.username}`
    : (entry.author.displayName ?? "Unknown");

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Play post by ${who}`}
          className="relative block aspect-[3/4] w-full overflow-hidden rounded-[14px] bg-chat-soft active:opacity-80"
        >
          {still ? (
            <img src={still} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : still === null ? (
            <span className="absolute inset-0 flex items-center justify-center text-chat-faint">
              <Film size={30} />
            </span>
          ) : null}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute bottom-2 left-2.5 flex items-center gap-1 text-[12px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
            {entry.media.length > 1 ? (
              <>
                <Images size={14} /> {entry.media.length}
              </>
            ) : first?.type === "video" ? (
              <Film size={14} />
            ) : null}
          </span>
        </button>
        {/* A 40px target around a 30px visible chip in the corner. */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove post by ${who} from offline`}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center"
        >
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Trash2 size={15} />
          </span>
        </button>
      </div>
      <p className="mt-1.5 truncate text-[13.5px] font-semibold">{who}</p>
      <p className="truncate text-[12px] text-chat-muted">
        {formatBytes(entry.bytes)} · {formatSavedAt(entry.savedAt)}
      </p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading offline posts">
      <div className="h-[86px] animate-pulse rounded-[18px] bg-chat-soft" />
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="aspect-[3/4] animate-pulse rounded-[14px] bg-chat-soft" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-chat-soft" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 pt-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-chat-soft">
        <Download size={28} strokeWidth={1.9} />
      </span>
      <h2 className="mt-4 text-[18px] font-semibold">No offline posts yet</h2>
      <p className="mt-2 max-w-[290px] text-[14px] leading-snug text-chat-muted">
        On any post, tap the share arrow{" "}
        <Send size={13} className="inline-block -translate-y-px" aria-label="share arrow" /> and
        choose <span className="font-semibold text-chat-text">Save for offline</span>. Saved posts
        play here even with no connection.
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-6 h-11 rounded-full bg-chat-text px-6 text-[15px] font-semibold text-chat-inverse active:scale-[0.98]"
      >
        Browse posts
      </button>
    </div>
  );
}

function Unsupported({ loadFailed }: { loadFailed: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 pt-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-chat-soft">
        <CloudOff size={28} strokeWidth={1.9} />
      </span>
      <h2 className="mt-4 text-[18px] font-semibold">
        {loadFailed ? "Couldn't open offline storage" : "Offline posts aren't available here"}
      </h2>
      <p className="mt-2 max-w-[300px] text-[14px] leading-snug text-chat-muted">
        Private browsing and some in-app browsers block the storage offline posts need. Open
        Oakmonte in Safari or Chrome, or add it to your Home Screen, and try again.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full-screen viewer
// ---------------------------------------------------------------------------

type Sources = { media: (string | null)[]; audio: string | null; poster: string | null };

/** One saved post, full screen, played entirely from object URLs over the
 *  cached blobs -- no request leaves the phone.
 *
 *  Tap toggles sound. A post with its own chosen sound plays THAT (the video
 *  stays muted, as in the feed, so nothing ever plays two tracks); otherwise
 *  the video's own audio is unmuted. Swipe down, the X, or back closes it. */
function OfflineViewer({
  entry,
  onClose,
  onDelete,
}: {
  entry: OfflineEntry;
  onClose: () => void;
  onDelete: () => void;
}) {
  useOverlayHistory(true, onClose);
  // Black over a light page: the status strip and scroll edge go black too.
  useDarkOverlay(true);
  useBodyScrollLock(true);

  const [sources, setSources] = useState<Sources | null>(null);
  const [index, setIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const tapStart = useRef({ x: 0, y: 0 });
  const sessionId = `offline:${entry.postId}`;

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    const toObjectUrl = async (url: string) => {
      const blob = await readCachedBlob(url);
      if (!blob) return null;
      const objectUrl = URL.createObjectURL(blob);
      made.push(objectUrl);
      return objectUrl;
    };
    void Promise.all([
      Promise.all(entry.media.map((m) => toObjectUrl(m.url))),
      entry.audio ? toObjectUrl(entry.audio.url) : Promise.resolve(null),
      entry.posterUrl ? toObjectUrl(entry.posterUrl) : Promise.resolve(null),
    ]).then(([media, audio, poster]) => {
      // Anything made after an unmount is revoked here instead.
      if (cancelled) made.forEach((u) => URL.revokeObjectURL(u));
      else setSources({ media, audio, poster });
    });
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [entry]);

  const hasTrack = !!sources?.audio;
  const hasVideo = entry.media.some((m) => m.type === "video");
  const canSound = hasTrack || hasVideo;
  const missing = sources !== null && sources.media.some((u) => u === null);

  // Only the visible slide's video plays; the rest pause and rewind, and only
  // the visible one is ever unmuted.
  useEffect(() => {
    if (!sources) return;
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      v.muted = hasTrack || !soundOn || i !== index;
      if (i === index) {
        void v.play().catch(() => {});
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [index, soundOn, hasTrack, sources]);

  useEffect(() => {
    if (soundOn) {
      claimMediaSession(sessionId, {
        title: entry.audio?.label ?? "Original sound",
        artist: entry.author.displayName ?? entry.author.username,
        // The cached poster, as an object URL: the remote one may be
        // unreachable, which is the whole point of this page.
        artworkUrl: sources?.poster ?? null,
      });
    } else {
      releaseMediaSession(sessionId);
    }
  }, [soundOn, sessionId, entry, sources?.poster]);
  useEffect(() => () => releaseMediaSession(sessionId), [sessionId]);

  function toggleSound() {
    if (!canSound) return;
    const next = !soundOn;
    setSoundOn(next);
    // Started HERE, inside the tap: iOS only lets audible playback begin from
    // a user gesture, and the effect above runs too late to count as one.
    if (hasTrack) {
      const a = audioRef.current;
      if (!a) return;
      if (next) void a.play().catch(() => setSoundOn(false));
      else a.pause();
    } else {
      const v = videoRefs.current[index];
      if (!v) return;
      v.muted = !next;
      if (next) void v.play().catch(() => {});
    }
  }

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.min(
      entry.media.length - 1,
      Math.max(0, Math.round(el.scrollLeft / el.clientWidth)),
    );
    setIndex((cur) => (cur === next ? cur : next));
  };

  const tap = {
    onPointerDown: (e: ReactPointerEvent) => {
      tapStart.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const dx = e.clientX - tapStart.current.x;
      const dy = e.clientY - tapStart.current.y;
      if (Math.hypot(dx, dy) < 10) toggleSound();
    },
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Vertical drag on this layer only: framer marks it pan-x, so the
          carousel inside keeps its native horizontal scrolling. */}
      <motion.div
        className="absolute inset-0"
        drag="y"
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.85 }}
        dragSnapToOrigin
        onDragEnd={(_: unknown, info: PanInfo) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
      >
        {sources === null ? null : missing ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <CloudOff size={30} className="text-white/70" />
            <p className="mt-3 text-[16px] font-semibold">This post is no longer on this device</p>
            <p className="mt-1.5 max-w-[260px] text-[13px] text-white/60">
              Your browser cleared part of it. Remove it here and save it again while you&apos;re
              online.
            </p>
            <button
              type="button"
              onClick={onDelete}
              className="mt-5 h-11 rounded-full bg-white px-6 text-[15px] font-semibold text-black active:scale-[0.98]"
            >
              Remove
            </button>
          </div>
        ) : (
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            {...tap}
            className="no-scrollbar absolute inset-0 flex overflow-x-auto overflow-y-hidden"
            style={{ scrollSnapType: "x mandatory", overscrollBehaviorX: "contain" }}
          >
            {entry.media.map((m, i) => (
              <div
                key={`${m.url}-${i}`}
                className="relative h-full w-full shrink-0"
                style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
              >
                {m.type === "video" ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[i] = el;
                    }}
                    src={sources.media[i] ?? undefined}
                    poster={i === 0 ? (sources.poster ?? undefined) : undefined}
                    loop
                    muted
                    playsInline
                    disablePictureInPicture
                    disableRemotePlayback
                    preload="auto"
                    className="h-full w-full select-none object-contain"
                    style={{ WebkitTouchCallout: "none" }}
                  />
                ) : (
                  <img
                    src={sources.media[i] ?? undefined}
                    alt=""
                    draggable={false}
                    className="h-full w-full select-none object-contain"
                    style={{ WebkitTouchCallout: "none" }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {sources?.audio && <audio ref={audioRef} src={sources.audio} loop preload="auto" />}

        {/* Caption block, over a scrim so it reads on a bright post. */}
        {!missing && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pt-16"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
          >
            {entry.media.length > 1 && (
              <div className="mb-2.5 flex justify-center gap-1.5">
                {entry.media.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
                      i === index ? "bg-white" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
            <p className="truncate text-[14px] font-semibold">
              {entry.author.displayName ?? entry.author.username ?? "Unknown"}
            </p>
            {entry.caption && (
              <p className="mt-0.5 line-clamp-3 text-[13px] text-white/80">{entry.caption}</p>
            )}
            {entry.audio && (
              <p className="mt-1 flex items-start gap-1 text-[12px] text-white/60">
                <Music size={12} className="mt-[3px] shrink-0" />
                <span>{entry.audio.label ?? "Original sound"}</span>
              </p>
            )}
            <p className="mt-1 text-[11.5px] text-white/45">
              Saved offline · {formatBytes(entry.bytes)}
            </p>
          </div>
        )}
      </motion.div>

      {/* Top chrome: outside the draggable layer so its buttons stay put. */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between px-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
        >
          <X size={26} className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
        </button>
        <div className="flex items-center gap-1">
          {entry.media.length > 1 && (
            <span className="mr-1 rounded-full bg-black/45 px-2.5 py-1 text-[12px] font-semibold tabular-nums backdrop-blur-sm">
              {index + 1}/{entry.media.length}
            </span>
          )}
          {canSound && !missing && (
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundOn ? "Mute" : "Turn sound on"}
              aria-pressed={soundOn}
              className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
            >
              {soundOn ? (
                <Volume2 size={23} className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
              ) : (
                <VolumeX size={23} className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Remove from offline"
            className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
          >
            <Trash2 size={21} className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
          </button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
