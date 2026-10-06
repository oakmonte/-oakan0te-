import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, FileVideo, FolderOpen, History, Images, Loader2 } from "lucide-react";
import StudioEditor, { type StudioDone, type StudioPark } from "@/components/studio/StudioEditor";
import { DraftImagePickerSheet } from "@/components/product-form/DraftImagePickerSheet";
import { PostImagePickerSheet } from "@/components/product-form/PostImagePickerSheet";
import type { PickedMedia } from "@/components/product-form/MediaPickerSheet";
import { setPendingCapture } from "@/lib/capture-handoff";
import { takePendingDraft } from "@/lib/draft-handoff";
import type { SoundCredit } from "@/lib/sound-library";
import { projectFrom } from "@/lib/studio/boot";
import { combineCredits } from "@/lib/studio/credits";
import { discardStudioSession, parkStudioSession, takeStudioSession } from "@/lib/studio/session";
import { autosaveStudio, autosavedAt, clearAutosave, loadAutosave } from "@/lib/studio/autosave";
import { STUDIO_ACCEPT, fileLabel, loadSource } from "@/lib/studio/sources";
import type { SourceMap, StudioProject, StudioSource } from "@/lib/studio/types";

export const Route = createFileRoute("/create/studio")({
  head: () => ({ meta: [{ title: "New video — Oakmonte" }] }),
  component: NewVideoRoute,
});

// "New video": the studio opened on its own, from CREATE or a reopened draft,
// and going straight to publish. It replaced the separate video editor
// (create.video-editor.tsx) so there is one multi-clip editor rather than two
// that each had half of what a seller needs.
//
// Three ways in, checked in order:
//   1. a parked session — backing out of publish, or coming back from
//      anywhere else mid-edit, returns to the timeline as it was;
//   2. a draft tapped on the drafts page;
//   3. nothing — pick photos and videos to start from.
//
// `created_with` stays "video-editor" for posts made here: it means "the
// multi-clip editor", which this still is, and drafts made before the switch
// reopen here through the same value.

type Boot = {
  project: StudioProject;
  sources: SourceMap;
  /** Credit for music already inside a reopened draft's video. */
  inheritedCredit: SoundCredit | null;
};

function NewVideoRoute() {
  const navigate = useNavigate();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const startFrom = useCallback(async (load: () => Promise<StudioSource[]>) => {
    setLoading(true);
    setError(null);
    try {
      const sources = await load();
      if (!sources.some((s) => s.kind !== "audio")) throw new Error("Pick a photo or a video");
      setBoot({ ...projectFrom(sources), inheritedCredit: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Once, StrictMode notwithstanding: both handoffs are take-once.
    if (started.current) return;
    started.current = true;

    const session = takeStudioSession();
    if (session) {
      setBoot({
        project: session.project,
        sources: session.sources,
        inheritedCredit: session.inheritedCredit,
      });
      return;
    }

    const draft = takePendingDraft();
    if (!draft) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(draft.url);
        if (!res.ok) throw new Error("Couldn't load that draft");
        const source = await loadSource(await res.blob(), "draft");
        // A draft made in the video editor has its music INSIDE the file —
        // `audio_licence` with no `audio_url`. Re-exporting carries the
        // track into the new video, so its credit has to come too; nothing
        // on the timeline can recover it. A draft WITH an `audio_url` has a
        // separate track this editor can't play, and claiming a credit for
        // music the export won't contain would be false — POSTPONED 0.2.
        const inheritedCredit =
          draft.audioLicence && !draft.audioUrl
            ? {
                attribution: draft.audioAttribution ?? null,
                licence: draft.audioLicence,
                sourceUrl: draft.audioSourceUrl ?? "",
              }
            : null;
        setBoot({ ...projectFrom([source]), inheritedCredit });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load that draft");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (boot) return <NewVideoStudio boot={boot} />;

  const resume = () =>
    void (async () => {
      setLoading(true);
      setError(null);
      const saved = await loadAutosave();
      setLoading(false);
      if (saved) setBoot(saved);
      else setError("That edit couldn't be opened. Start a new one.");
    })();

  return (
    <StartScreen
      loading={loading}
      error={error}
      onResume={resume}
      onBack={() => void navigate({ to: "/create", search: { tab: "create" } })}
      onFiles={(files) =>
        void startFrom(() =>
          Promise.all(
            Array.from(files)
              .filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"))
              .map((f) => loadSource(f, fileLabel(f))),
          ),
        )
      }
      onPicked={(picked) =>
        void startFrom(() =>
          Promise.all(
            picked.map(async (item) => {
              const res = await fetch(item.url);
              if (!res.ok) throw new Error("Couldn't load that");
              return loadSource(await res.blob(), item.kind === "video" ? "video" : "photo");
            }),
          ),
        )
      }
    />
  );
}

function NewVideoStudio({ boot }: { boot: Boot }) {
  const navigate = useNavigate();
  // Leaving on purpose ends the edit; anything else — publish, the tab bar —
  // parks it so coming back finds the timeline as it was.
  const leaving = useRef(false);

  const handlePark = useCallback(
    (state: StudioPark) => {
      if (leaving.current) return false;
      parkStudioSession({ ...state, inheritedCredit: boot.inheritedCredit });
      return true;
    },
    [boot.inheritedCredit],
  );

  const handleDone = useCallback(
    async (result: StudioDone) => {
      // Every sound inside the file is credited on the post: library sounds
      // the studio mixed in, and music a reopened draft already carried.
      const credit = combineCredits(
        boot.inheritedCredit ? [...result.credits, boot.inheritedCredit] : result.credits,
      );
      setPendingCapture({
        type: "video",
        blob: result.blob,
        url: result.url,
        poster: result.poster,
        origin: "video-editor",
        audio: credit
          ? {
              blob: null,
              url: "",
              name: result.soundNames.join(" · ").slice(0, 100) || "Sound",
              credit,
              bakedIn: true,
            }
          : undefined,
      });
      await navigate({ to: "/create/after-shot/publish" });
    },
    [boot.inheritedCredit, navigate],
  );

  // Saved to the device a moment after each change, so a reload or a killed
  // tab doesn't take the edit with it — see autosave.ts.
  const saveTimer = useRef<number | null>(null);
  const handleChange = useCallback(
    (state: { project: StudioProject; sources: SourceMap }) => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        if (!leaving.current) {
          void autosaveStudio(state.project, state.sources, boot.inheritedCredit);
        }
      }, 1500);
    },
    [boot.inheritedCredit],
  );
  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  const handleLeave = useCallback(() => {
    leaving.current = true;
    discardStudioSession();
    void clearAutosave();
    void navigate({ to: "/create", search: { tab: "create" } });
  }, [navigate]);

  return (
    <StudioEditor
      initialProject={boot.project}
      initialSources={boot.sources}
      onDone={handleDone}
      onLeave={handleLeave}
      park={handlePark}
      onChange={handleChange}
      doneLabel="Next"
    />
  );
}

/** Nothing to edit yet: where the clips come from. */
function StartScreen({
  loading,
  error,
  onResume,
  onBack,
  onFiles,
  onPicked,
}: {
  loading: boolean;
  error: string | null;
  onResume: () => void;
  onBack: () => void;
  onFiles: (files: FileList) => void;
  onPicked: (picked: PickedMedia[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<"drafts" | "posts" | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    void autosavedAt().then(setSavedAt);
  }, []);

  const pick = (items: PickedMedia[]) => {
    setSheet(null);
    if (items.length) onPicked(items);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <div className="flex items-center px-2 pt-[calc(env(safe-area-inset-top)+8px)]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center active:scale-90"
        >
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-[17px] font-semibold">New video</h1>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 px-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <Loader2 className="animate-spin" size={24} />
            <p className="text-[14px]">Opening…</p>
          </div>
        ) : (
          <>
            {savedAt !== null && (
              <button
                type="button"
                onClick={onResume}
                className="mb-3 flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[16px] font-semibold text-black active:scale-[0.99]"
              >
                <History size={20} /> Resume your last edit
                <span className="text-[13px] font-normal text-black/55">
                  {new Date(savedAt).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </button>
            )}
            <p className="pb-2 text-center text-[15px] text-white/70">
              Pick the photos and videos to put together.
            </p>
            <StartButton
              icon={<Images size={20} />}
              label="From your phone"
              onClick={() => inputRef.current?.click()}
            />
            <StartButton
              icon={<FolderOpen size={20} />}
              label="From your drafts"
              onClick={() => setSheet("drafts")}
            />
            <StartButton
              icon={<FileVideo size={20} />}
              label="From your posts"
              onClick={() => setSheet("posts")}
            />
            {error && <p className="pt-2 text-center text-[13px] text-red-300">{error}</p>}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={STUDIO_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {sheet === "drafts" && (
        <DraftImagePickerSheet include="all" onSelect={pick} onClose={() => setSheet(null)} />
      )}
      {sheet === "posts" && (
        <PostImagePickerSheet include="all" onSelect={pick} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

function StartButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 items-center gap-3 rounded-2xl bg-white/[0.09] px-5 text-[16px] font-semibold active:scale-[0.99]"
    >
      {icon}
      {label}
    </button>
  );
}
