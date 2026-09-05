import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Play } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { setPendingDraft } from "@/lib/draft-handoff";
import { discardVideoEditorSession } from "@/lib/video-editor-session";

export const Route = createFileRoute("/create/drafts")({
  head: () => ({ meta: [{ title: "Drafts — Oakmonte" }] }),
  component: DraftsPage,
});

// The user's saved-but-unpublished posts, reached from CREATE → Drafts.
//
// Tapping one reopens it in the editor that suits its media: a video goes to
// the video editor, a still to the photo editor. That is an inference from
// `media_type` rather than a record of where it was actually made — the posts
// table has no column saying which screen produced a row. It gets the answer
// right for everything the app can currently create, and the note on
// `editorFor` says what would make it exact.

type Draft = {
  id: string;
  media_url: string;
  thumbnail_url: string | null;
  media_type: string;
  caption: string | null;
  created_at: string;
};

type SortKey = "recent" | "size";

function editorFor(draft: Draft): "/create/video-editor" | "/create/photo-editor" {
  // A `created_with` column on posts would make this a lookup instead of a
  // guess, and would matter the day a third editor produces videos too. It
  // needs a migration, so it isn't here.
  return draft.media_type === "video" ? "/create/video-editor" : "/create/photo-editor";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** "5 Sept" — the badge in the corner of each tile. */
function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${d.toLocaleString(undefined, { month: "short" })}`;
}

function DraftsPage() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setDrafts([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("posts")
      .select("id, media_url, thumbnail_url, media_type, caption, created_at")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("DraftsPage: failed to load drafts", error);
        setDrafts(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [user, sessionLoading]);

  // File sizes come from a HEAD request per draft, because `posts` has no
  // column for them. Cheap individually — headers only, no body — but it is
  // still one request per row, so they run a few at a time and fill in as they
  // land rather than gating the grid. A `media_bytes` column written at upload
  // would make this free; that needs a migration.
  useEffect(() => {
    if (!drafts || drafts.length === 0) return;
    let cancelled = false;
    const queue = drafts.slice();

    async function worker() {
      while (!cancelled) {
        const draft = queue.shift();
        if (!draft) return;
        try {
          const res = await fetch(draft.media_url, { method: "HEAD" });
          const length = Number(res.headers.get("content-length"));
          if (!cancelled && Number.isFinite(length) && length > 0) {
            setSizes((prev) => ({ ...prev, [draft.id]: length }));
          }
        } catch {
          // A size we can't read just sorts last. Not worth surfacing.
        }
      }
    }

    // Three at a time: enough to finish a normal drafts list quickly without
    // opening twenty sockets on a phone.
    void Promise.all([worker(), worker(), worker()]);
    return () => {
      cancelled = true;
    };
  }, [drafts]);

  const sorted = useMemo(() => {
    if (!drafts) return null;
    if (sort === "recent") return drafts;
    return drafts.slice().sort((a, b) => {
      // Unknown sizes sink rather than jumping to the top as zero.
      const sa = sizes[a.id] ?? -1;
      const sb = sizes[b.id] ?? -1;
      return sb - sa;
    });
  }, [drafts, sizes, sort]);

  const totalBytes = useMemo(() => Object.values(sizes).reduce((sum, n) => sum + n, 0), [sizes]);

  const open = useCallback(
    (draft: Draft) => {
      // Opening a draft starts a new edit, so any timeline parked from a
      // previous one is finished with — otherwise the video editor would
      // restore that instead of loading this.
      discardVideoEditorSession();
      setPendingDraft({
        url: draft.media_url,
        kind: draft.media_type === "video" ? "video" : "photo",
        postId: draft.id,
        thumbnailUrl: draft.thumbnail_url,
      });
      void navigate({ to: editorFor(draft) });
    },
    [navigate],
  );

  return (
    <div
      className="fixed inset-0 overflow-y-auto bg-black text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div
        className="sticky top-0 z-10 flex items-center justify-between bg-black/90 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button
          type="button"
          onClick={() => navigate({ to: "/create" })}
          aria-label="Back"
          className="-ml-1 flex h-9 w-9 items-center justify-center active:scale-90"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-[17px] font-semibold">Drafts</span>
        <span className="w-9" />
      </div>

      {sorted === null ? (
        <p className="py-20 text-center text-[13px] text-white/40">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-10 pt-32 text-center">
          <p className="text-[15px] font-semibold text-white/80">You have no drafts yet</p>
          <p className="max-w-[240px] text-[12px] leading-snug text-white/40">
            Anything you save instead of posting shows up here, ready to pick back up.
          </p>
        </div>
      ) : (
        <>
          <div className="px-4 pb-3">
            <p className="text-[19px] font-bold">
              {sorted.length} draft{sorted.length === 1 ? "" : "s"}
              {totalBytes > 0 && (
                <span className="text-white/45"> · {formatBytes(totalBytes)}</span>
              )}
            </p>
          </div>

          <div className="flex gap-2 px-4 pb-3">
            {(
              [
                { key: "recent", label: "Most recent" },
                { key: "size", label: "File size" },
              ] as { key: SortKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors active:scale-95 ${
                  sort === key ? "bg-white text-black" : "bg-white/[0.12] text-white/80"
                }`}
              >
                Sort by: {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-[3px] px-[3px]">
            {sorted.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => open(draft)}
                aria-label={`Open draft from ${formatDay(draft.created_at)}`}
                className="relative aspect-[9/16] overflow-hidden bg-white/[0.06] active:scale-[0.97]"
              >
                {draft.thumbnail_url ? (
                  <img
                    src={draft.thumbnail_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : draft.media_type === "video" ? (
                  // No stored poster: the element's own first frame, which
                  // needs no canvas read and so no CORS on the bucket.
                  <video
                    src={draft.media_url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={draft.media_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}

                <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-white px-1.5 py-0.5 text-[10px] font-bold leading-tight text-black">
                  {formatDay(draft.created_at)}
                </span>

                {draft.media_type === "video" && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55">
                    <Play size={10} className="ml-[1px]" fill="white" strokeWidth={0} />
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-5">
                  <span className="truncate text-[10px] text-white/85">
                    {draft.caption?.trim() || "No caption"}
                  </span>
                  {sizes[draft.id] && (
                    <span className="shrink-0 text-[10px] tabular-nums text-white/60">
                      {formatBytes(sizes[draft.id])}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <p className="px-10 pb-10 pt-6 text-center text-[12px] leading-snug text-white/40">
            Only you can see your drafts.
          </p>
        </>
      )}
    </div>
  );
}
