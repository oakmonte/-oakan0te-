import { authedFetch } from "@/lib/authed-fetch";
import { posterFromVideo, uploadPostPhoto, uploadPostVideo } from "@/lib/post-media-upload";

// Posting/saving-a-draft used to block the publish page until the upload
// finished — the seller couldn't leave, and there was nothing to look at but
// a "Posting…" button. This runs the upload in the background instead: the
// caller fires it and navigates away immediately, and PostUploadToast (mounted
// once in __root.tsx) shows progress/errors regardless of what route the
// seller's on when it settles. Plain module state, not React state — same
// "survives navigation" reasoning as capture-handoff.ts, and there's only
// ever one upload in flight at a time since the publish flow is one-post-at-
// a-time.
export type PostUploadKind = "published" | "draft";
// `preview` is an object URL of the post's cover -- the picked cover, the
// first photo, or a frame from the video -- so the profile grid can show the
// post the instant it's sent, with a spinner, instead of nothing (or black)
// until the upload lands. `postId` arrives with success, so the grid knows
// when the real post has replaced the placeholder.
export type PostUploadState =
  | { status: "uploading"; kind: PostUploadKind; preview: string | null }
  | { status: "success"; kind: PostUploadKind; preview: string | null; postId: string }
  | { status: "error"; kind: PostUploadKind; preview: string | null; message: string }
  | null;

let state: PostUploadState = null;
let pendingFormData: FormData | null = null;
let pendingKind: PostUploadKind | null = null;
const listeners = new Set<() => void>();

function setState(next: PostUploadState) {
  // The preview URL is owned by whichever state holds it; drop it once
  // nothing does.
  const old = state?.preview;
  if (old && old !== next?.preview) URL.revokeObjectURL(old);
  state = next;
  listeners.forEach((l) => l());
}

export function subscribePostUpload(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPostUploadSnapshot(): PostUploadState {
  return state;
}

// The publish screen still builds one FormData holding every file. This
// takes the files back out, puts each one into Bunny on its own (see
// post-media-upload.ts -- Vercel refuses request bodies over 4.5 MB, which is
// what broke video posts), and sends /api/posts the rest of the form plus
// the URLs and video ids.
/** The post's cover image as a Blob: the picked cover, else the first photo,
 *  else a frame grabbed from the first video. Also what's uploaded as the
 *  thumbnail of a video post that had no cover picked. */
async function coverOf(fd: FormData): Promise<{ blob: Blob | null; isPoster: boolean }> {
  const picked = fd.get("thumbnail");
  if (picked instanceof Blob && picked.size > 0) return { blob: picked, isPoster: true };
  const first = fd.getAll("files").find((f): f is File => f instanceof File);
  const types = JSON.parse(String(fd.get("mediaTypes") ?? "[]")) as string[];
  if (!first) return { blob: null, isPoster: false };
  if (types[0] === "video") return { blob: await posterFromVideo(first), isPoster: true };
  return { blob: first, isPoster: false };
}

async function toPublishForm(fd: FormData, poster: Blob | null): Promise<FormData> {
  const files = fd.getAll("files").filter((f): f is File => f instanceof File);
  const types = JSON.parse(String(fd.get("mediaTypes") ?? "[]")) as string[];
  const thumbnail = poster;
  const uploadId = crypto.randomUUID();

  const items: (
    | { type: "photo"; url: string; bytes: number }
    | { type: "video"; videoId: string; bytes: number }
  )[] = [];
  for (const [i, file] of files.entries()) {
    if (types[i] === "video") {
      items.push({ type: "video", ...(await uploadPostVideo(file)) });
    } else {
      items.push({ type: "photo", ...(await uploadPostPhoto(file, uploadId, `media-${i}`)) });
    }
  }

  const out = new FormData();
  for (const [key, value] of fd.entries()) {
    if (key === "files" || key === "mediaTypes" || key === "thumbnail" || key === "audio") continue;
    out.append(key, value);
  }
  out.set("items", JSON.stringify(items));
  if (thumbnail instanceof Blob && thumbnail.size > 0) {
    out.set("thumbnailUrl", (await uploadPostPhoto(thumbnail, uploadId, "thumbnail")).url);
  }
  return out;
}

async function run(fd: FormData, kind: PostUploadKind) {
  // A retry keeps the preview it already has rather than making another.
  const reuse = state?.status === "error" ? state.preview : null;
  setState({ status: "uploading", kind, preview: reuse });
  let preview = reuse;
  try {
    const cover = await coverOf(fd);
    if (!preview && cover.blob) {
      preview = URL.createObjectURL(cover.blob);
      setState({ status: "uploading", kind, preview });
    }
    const publishForm = await toPublishForm(fd, cover.isPoster ? cover.blob : null);
    const res = await authedFetch("/api/posts", { method: "POST", body: publishForm });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || "Could not publish");
    }
    const { id } = (await res.json()) as { id: string };
    setState({ status: "success", kind, preview, postId: id });
    setTimeout(() => {
      // Only clear if nothing newer has started since (a fast second post).
      if (state?.status === "success" && state.postId === id) setState(null);
    }, 4000);
  } catch (err) {
    setState({
      status: "error",
      kind,
      preview,
      message: err instanceof Error ? err.message : "Could not publish",
    });
  }
}

/** Kicks off a post/draft upload in the background. Caller should navigate
 *  away immediately after calling this rather than awaiting it. */
export function startPostUpload(fd: FormData, kind: PostUploadKind) {
  pendingFormData = fd;
  pendingKind = kind;
  void run(fd, kind);
}

/** Retries the most recent upload with the exact FormData it failed with —
 *  safe because the Blob was already read into the FormData at capture time,
 *  independent of whatever after-shot state the seller has since left. */
export function retryPostUpload() {
  if (pendingFormData && pendingKind) void run(pendingFormData, pendingKind);
}

export function dismissPostUpload() {
  pendingFormData = null;
  pendingKind = null;
  setState(null);
}
