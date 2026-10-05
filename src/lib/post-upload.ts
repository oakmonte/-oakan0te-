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
export type PostUploadState =
  | { status: "uploading"; kind: PostUploadKind }
  | { status: "success"; kind: PostUploadKind }
  | { status: "error"; kind: PostUploadKind; message: string }
  | null;

let state: PostUploadState = null;
let pendingFormData: FormData | null = null;
let pendingKind: PostUploadKind | null = null;
const listeners = new Set<() => void>();

function setState(next: PostUploadState) {
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
async function toPublishForm(fd: FormData): Promise<FormData> {
  const files = fd.getAll("files").filter((f): f is File => f instanceof File);
  const types = JSON.parse(String(fd.get("mediaTypes") ?? "[]")) as string[];
  let thumbnail: FormDataEntryValue | Blob | null = fd.get("thumbnail");
  // No cover picked for a video post: make one from the clip itself, so the
  // grid never waits on (or shows black for) Bunny's own thumbnail.
  if (!(thumbnail instanceof Blob && thumbnail.size > 0) && types[0] === "video" && files[0]) {
    thumbnail = await posterFromVideo(files[0]);
  }
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
  setState({ status: "uploading", kind });
  try {
    const publishForm = await toPublishForm(fd);
    const res = await authedFetch("/api/posts", { method: "POST", body: publishForm });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || "Could not publish");
    }
    setState({ status: "success", kind });
    setTimeout(() => {
      // Only clear if nothing newer has started since (a fast second post).
      if (state?.status === "success") setState(null);
    }, 2500);
  } catch (err) {
    setState({
      status: "error",
      kind,
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
