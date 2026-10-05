import { authedFetch } from "@/lib/authed-fetch";
import { posterFromVideo, uploadPostPhoto, uploadPostVideo } from "@/lib/post-media-upload";

// Posting/saving-a-draft used to block the publish page until the upload
// finished — the seller couldn't leave, and there was nothing to look at but
// a "Posting…" button. This runs the upload in the background instead: the
// caller fires it and navigates away immediately, and PostUploadToast (mounted
// once in __root.tsx) shows progress/errors regardless of what route the
// seller's on when it settles. Plain module state, not React state — same
// "survives navigation" reasoning as capture-handoff.ts.
//
// Every post is its own JOB, and jobs run one at a time, in order. A second
// post started while the first is still uploading (post a video, then a
// photo straight after) waits its turn instead of sharing one global slot --
// that used to revoke the first post's preview, make Retry re-send the WRONG
// post, and let one post's success hide the other's failure.
export type PostUploadKind = "published" | "draft";

// What the toast shows: the job running now, or the last one that finished.
// `preview` is an object URL of that post's cover -- the picked cover, the
// first photo, or a frame from the video. `postId` arrives with success.
export type PostUploadState =
  | { status: "uploading"; kind: PostUploadKind; preview: string | null }
  | { status: "success"; kind: PostUploadKind; preview: string | null; postId: string }
  | { status: "error"; kind: PostUploadKind; preview: string | null; message: string }
  | null;

/** A post on its way, for the profile grid to show in place right away:
 *  queued or uploading, or landed but not yet in the grid's own data. */
export type PendingPost = {
  jobId: number;
  kind: PostUploadKind;
  preview: string | null;
  postId: string | null;
};

type Job = {
  id: number;
  fd: FormData;
  kind: PostUploadKind;
  preview: string | null;
  postId: string | null;
  phase: "queued" | "uploading" | "landed" | "failed";
};

let nextJobId = 1;
const queue: Job[] = [];
let active: Job | null = null;
let failed: Job | null = null;
// Landed jobs stay listed briefly so the grid can keep the tile up until its
// refetch has the real post; then they're dropped and their previews freed.
const landed: Job[] = [];
const LANDED_KEEP_MS = 30_000;

let state: PostUploadState = null;
let pendingSnapshot: PendingPost[] = [];
let landedAt = 0;
const listeners = new Set<() => void>();

function notify() {
  const jobs = [...(active ? [active] : []), ...queue, ...landed];
  pendingSnapshot = jobs.map((j) => ({
    jobId: j.id,
    kind: j.kind,
    preview: j.preview,
    postId: j.postId,
  }));
  listeners.forEach((l) => l());
}

function setState(next: PostUploadState) {
  state = next;
  notify();
}

function release(job: Job) {
  if (job.preview) URL.revokeObjectURL(job.preview);
  job.preview = null;
}

export function subscribePostUpload(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPostUploadSnapshot(): PostUploadState {
  return state;
}

/** Posts on their way (see PendingPost). Same subscription as above. */
export function getPendingPostsSnapshot(): PendingPost[] {
  return pendingSnapshot;
}

/** When a post last landed (ms epoch, 0 = never this session). A grid whose
 *  data is older than this refetches, even one that wasn't mounted when it
 *  happened -- publishing navigates away from the profile. */
export function getLastLandedAt(): number {
  return landedAt;
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

  const items: (
    | { type: "photo"; url: string; bytes: number }
    | { type: "video"; videoId: string; bytes: number }
  )[] = [];
  for (const [i, file] of files.entries()) {
    if (types[i] === "video") {
      items.push({ type: "video", ...(await uploadPostVideo(file)) });
    } else {
      items.push({ type: "photo", ...(await uploadPostPhoto(file, `media-${i}`)) });
    }
  }

  const out = new FormData();
  for (const [key, value] of fd.entries()) {
    if (key === "files" || key === "mediaTypes" || key === "thumbnail" || key === "audio") continue;
    out.append(key, value);
  }
  out.set("items", JSON.stringify(items));
  if (thumbnail instanceof Blob && thumbnail.size > 0) {
    out.set("thumbnailUrl", (await uploadPostPhoto(thumbnail, "thumbnail")).url);
  }
  return out;
}

async function runJob(job: Job) {
  job.phase = "uploading";
  setState({ status: "uploading", kind: job.kind, preview: job.preview });
  try {
    const cover = await coverOf(job.fd);
    if (!job.preview && cover.blob) {
      job.preview = URL.createObjectURL(cover.blob);
      setState({ status: "uploading", kind: job.kind, preview: job.preview });
    }
    const publishForm = await toPublishForm(job.fd, cover.isPoster ? cover.blob : null);
    const res = await authedFetch("/api/posts", { method: "POST", body: publishForm });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || "Could not publish");
    }
    const { id } = (await res.json()) as { id: string };
    job.postId = id;
    job.phase = "landed";
    landed.push(job);
    landedAt = Date.now();
    setState({ status: "success", kind: job.kind, preview: job.preview, postId: id });
    setTimeout(() => {
      // Only clear the toast if nothing newer has replaced it since.
      if (state?.status === "success" && state.postId === id) setState(null);
    }, 4000);
    setTimeout(() => {
      const i = landed.indexOf(job);
      if (i >= 0) landed.splice(i, 1);
      release(job);
      notify();
    }, LANDED_KEEP_MS);
  } catch (err) {
    job.phase = "failed";
    // One retryable failure at a time: an older one still waiting is
    // superseded (its toast was already replaced).
    if (failed && failed !== job) release(failed);
    failed = job;
    setState({
      status: "error",
      kind: job.kind,
      preview: job.preview,
      message: err instanceof Error ? err.message : "Could not publish",
    });
  } finally {
    active = null;
    pump();
  }
}

function pump() {
  if (active) return;
  const next = queue.shift();
  if (!next) {
    notify();
    return;
  }
  active = next;
  void runJob(next);
}

/** Kicks off a post/draft upload in the background. Caller should navigate
 *  away immediately after calling this rather than awaiting it. Queued
 *  behind any upload already running. */
export function startPostUpload(fd: FormData, kind: PostUploadKind) {
  queue.push({ id: nextJobId++, fd, kind, preview: null, postId: null, phase: "queued" });
  pump();
}

/** Retries the post that failed -- that exact one, with the FormData it
 *  failed with (its Blobs were read in at capture time, so whatever the
 *  seller has done since doesn't matter). */
export function retryPostUpload() {
  const job = failed;
  if (!job) return;
  failed = null;
  job.phase = "queued";
  queue.unshift(job);
  pump();
}

export function dismissPostUpload() {
  if (failed) {
    release(failed);
    failed = null;
  }
  setState(null);
}
