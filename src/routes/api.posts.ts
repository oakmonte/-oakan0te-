import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAudioSource } from "@/lib/sound-library";
import { getRequestUser } from "@/lib/server-auth";

/**
 * Publishes a post: uploads every carousel item (and, for video, its poster
 * frame) to Bunny Storage, writes the posts row plus one post_media row per
 * item, and tags any of the caller's own products picked on the publish screen.
 *
 * POST multipart/form-data:
 *   files        one or more media blobs, IN CAROUSEL ORDER   (required)
 *   mediaTypes   JSON array of 'photo' | 'video', one per file (required)
 *   thumbnail    poster frame for item 0, video only           (optional)
 *   audio        a sound to play over the post, as bytes       (optional)
 *   audioName    display name for that sound                   (optional)
 *   audioSource  a catalogue track's URL, fetched server-side   (optional)
 *                — an alternative to `audio`, never both
 *   audioLicence licence the track is used under                (required with audioSource)
 *   audioAttribution  credit line to show beside the post       (optional)
 *   audioSourceUrl    page the track came from                  (optional)
 *   caption      text                                          (optional)
 *   location     freeform text                                 (optional)
 *   visibility   'public' | 'followers' | 'only_me'             (default 'public')
 *   status       'published' | 'draft'                         (default 'published')
 *   createdWith  'camera' | 'photo-editor' | 'video-editor'     (optional)
 *   productIds   JSON array of product ids to tag               (optional)
 *
 * Item 0 is the cover, and its url/type/thumbnail are ALSO written to the
 * posts row itself. That mirroring is what lets every existing reader — the
 * feed, the profile grid, the media pickers — keep working without knowing
 * post_media exists. See the migration for the expand/contract plan.
 */

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
/** A carousel can be big, but not unbounded — this is one background upload. */
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const MAX_ITEMS = 10;
const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;
/** A song, not an album. Anything over this is a mistake, not a track. */
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const MAX_AUDIO_NAME_LENGTH = 120;

/** Bunny serves what it is given, so the stored extension is what decides
 *  whether a browser will play the file back. The upload's own filename is not
 *  trustworthy enough to derive it from — this maps the content type instead,
 *  and falls back to the one format every browser handles. */
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};
const MEDIA_TYPES = new Set(["photo", "video"]);
const VISIBILITIES = new Set(["public", "followers", "only_me"]);
const STATUSES = new Set(["published", "draft"]);
const CREATED_WITH = new Set(["camera", "photo-editor", "video-editor"]);

async function uploadToBunny(
  remotePath: string,
  body: Blob,
  endpoint: string,
  zone: string,
  password: string,
) {
  const res = await fetch(`${endpoint.replace(/\/+$/, "")}/${zone}/${remotePath}`, {
    method: "PUT",
    headers: { AccessKey: password, "Content-Type": body.type || "application/octet-stream" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Bunny upload failed:", res.status, text.slice(0, 300));
    return null;
  }
  return remotePath;
}

/** Pull a catalogue track from its provider, so the phone doesn't have to.
 *
 *  The seller's browser sends a URL instead of 3-5 MB of MP3 it would have had
 *  to download first — see the note on `isTrustedAudioSource`, which is also
 *  what stops this being a request-controlled fetch of anything on the
 *  network.
 *
 *  Returns null on anything unexpected rather than throwing: a post that goes
 *  out without its music is a much better failure than a post that doesn't go
 *  out. */
async function fetchTrustedAudio(
  url: string,
  ownHost: string,
): Promise<{ blob: Blob; type: string; size: number } | null> {
  if (!isTrustedAudioSource(url, [ownHost])) {
    console.error("api/posts: refused audio source", url);
    return null;
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Oakmonte/1.0 (https://oakmonte.com) sound-library" },
      signal: AbortSignal.timeout(15_000),
      // The allowlist above checked the URL we were given. It says nothing
      // about where a redirect would take us, and `follow` — the default —
      // would obediently go there, which quietly turns the check into no check
      // at all. Neither host redirects off-site today; that is a property of
      // today's two hosts rather than of this code, and it stops being true
      // the moment a third provider is added.
      redirect: "manual",
    });
    if (!res.ok) return null;

    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!type.startsWith("audio/")) return null;

    // Required, not merely respected. Absent reads as 0 and malformed reads as
    // NaN, and the original check waved both through to `.blob()` — which
    // buffers the whole body into the worker before any size is known. Both
    // hosts send it on static files, so demanding it costs nothing and closes
    // the case where a chunked response gets to decide our memory ceiling.
    const declared = Number(res.headers.get("content-length"));
    if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_AUDIO_BYTES) return null;

    // Still checked again after reading: the header is a claim, `blob.size` is
    // the fact, and a response is free to lie about the former.
    const blob = await res.blob();
    if (blob.size === 0 || blob.size > MAX_AUDIO_BYTES) return null;
    return { blob, type, size: blob.size };
  } catch (error) {
    console.error("api/posts: could not fetch library track", error);
    return null;
  }
}

export const Route = createFileRoute("/api/posts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
        const password = process.env.BUNNY_STORAGE_PASSWORD;
        const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com";
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME;

        if (!zone || !password || !pullZone) {
          console.error("Post publish: Bunny Storage is not configured");
          return Response.json({ error: "File storage is not configured" }, { status: 500 });
        }

        const user = await getRequestUser(request);
        if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        const files = form.getAll("files").filter((f): f is File => f instanceof File);
        const mediaTypesRaw = form.get("mediaTypes") as string | null;
        const thumbnail = form.get("thumbnail");
        const audio = form.get("audio");
        const audioName =
          (form.get("audioName") as string | null)?.trim().slice(0, MAX_AUDIO_NAME_LENGTH) || null;
        // A library track arrives as a URL rather than bytes — see
        // `fetchTrustedAudio`. Its credit rides along with it.
        const audioSource = (form.get("audioSource") as string | null)?.trim() || null;
        // Roomy on purpose. A credit is a licence condition, and some sources
        // state it as a sentence rather than a name — one real Commons track
        // gives its artist as a paragraph ending 'Required credit: "music by
        // audionautix.com"'. A cap that cuts that in half stores something
        // that no longer satisfies the licence, so this is set to clear the
        // realistic worst case rather than the typical one.
        const audioAttribution =
          (form.get("audioAttribution") as string | null)?.trim().slice(0, 1000) || null;
        const audioLicence =
          (form.get("audioLicence") as string | null)?.trim().slice(0, 120) || null;
        const audioSourceUrl =
          (form.get("audioSourceUrl") as string | null)?.trim().slice(0, 500) || null;
        const caption = (form.get("caption") as string | null)?.trim() || null;
        const location = (form.get("location") as string | null)?.trim() || null;
        const visibility = (form.get("visibility") as string) || "public";
        const status = (form.get("status") as string) || "published";
        const createdWithRaw = (form.get("createdWith") as string | null) || null;
        const productIdsRaw = form.get("productIds") as string | null;

        if (files.length === 0) {
          return Response.json({ error: "At least one file is required" }, { status: 400 });
        }
        if (files.length > MAX_ITEMS) {
          return Response.json(
            { error: `A post can hold at most ${MAX_ITEMS} items` },
            { status: 400 },
          );
        }

        let mediaTypes: string[] = [];
        try {
          const parsed = JSON.parse(mediaTypesRaw ?? "");
          if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
            mediaTypes = parsed;
          }
        } catch {
          return Response.json({ error: "mediaTypes must be a JSON array" }, { status: 400 });
        }
        // One type per file, positionally. A mismatch means the client and the
        // server disagree about what is being uploaded, which is worse than a
        // missing field — refuse rather than guess.
        if (mediaTypes.length !== files.length) {
          return Response.json(
            { error: "mediaTypes must have one entry per file" },
            { status: 400 },
          );
        }
        if (!mediaTypes.every((t) => MEDIA_TYPES.has(t))) {
          return Response.json(
            { error: "Every mediaType must be 'photo' or 'video'" },
            { status: 400 },
          );
        }
        if (!VISIBILITIES.has(visibility)) {
          return Response.json({ error: "Invalid visibility" }, { status: 400 });
        }
        if (!STATUSES.has(status)) {
          return Response.json({ error: "Invalid status" }, { status: 400 });
        }
        if (createdWithRaw && !CREATED_WITH.has(createdWithRaw)) {
          return Response.json({ error: "Invalid createdWith" }, { status: 400 });
        }

        let totalBytes = 0;
        for (const f of files) {
          if (f.size === 0) {
            return Response.json({ error: "One of the files is empty" }, { status: 400 });
          }
          if (f.size > MAX_MEDIA_BYTES) {
            return Response.json(
              { error: `A file is over the ${MAX_MEDIA_BYTES / 1024 / 1024} MB limit` },
              { status: 413 },
            );
          }
          totalBytes += f.size;
        }
        if (totalBytes > MAX_TOTAL_BYTES) {
          return Response.json(
            { error: `This post is over the ${MAX_TOTAL_BYTES / 1024 / 1024} MB total limit` },
            { status: 413 },
          );
        }
        if (thumbnail instanceof File && thumbnail.size > MAX_THUMBNAIL_BYTES) {
          return Response.json({ error: "Thumbnail is too large" }, { status: 413 });
        }
        if (audio instanceof File && audio.size > 0) {
          if (audio.size > MAX_AUDIO_BYTES) {
            return Response.json(
              { error: `The sound is over the ${MAX_AUDIO_BYTES / 1024 / 1024} MB limit` },
              { status: 413 },
            );
          }
          if (!audio.type.startsWith("audio/")) {
            return Response.json({ error: "That sound is not an audio file" }, { status: 400 });
          }
        }

        // A catalogue track has to arrive with its licence. The three credit
        // fields are stored verbatim and nothing here re-derives them from the
        // file, so without this a request could name a CC BY track as its
        // `audioSource`, omit the credit, and publish an uncredited track with
        // nothing in the row to show it happened. The app always sends both
        // together; anything that doesn't is either broken or trying it on,
        // and neither should be quietly repaired into a licence breach.
        if (audioSource && !audioLicence) {
          return Response.json(
            { error: "That sound is missing its licence details" },
            { status: 400 },
          );
        }

        let productIds: string[] = [];
        if (productIdsRaw) {
          try {
            const parsed = JSON.parse(productIdsRaw);
            if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
              productIds = parsed;
            }
          } catch {
            return Response.json(
              { error: "productIds must be a JSON array of strings" },
              { status: 400 },
            );
          }
        }

        const postId = crypto.randomUUID();

        // Uploaded one after another rather than in parallel. A carousel on a
        // phone connection is already competing for the same uplink, and ten
        // simultaneous PUTs to Bunny make every one of them slower and the
        // failure modes harder to report.
        const uploaded: { url: string; mediaType: string }[] = [];
        for (const [index, f] of files.entries()) {
          const ext = mediaTypes[index] === "video" ? "mp4" : "jpg";
          const path = `posts/${user.id}/${postId}/media-${index}.${ext}`;
          const stored = await uploadToBunny(path, f, endpoint, zone, password);
          if (!stored) {
            return Response.json({ error: "Could not store the uploaded media" }, { status: 502 });
          }
          uploaded.push({ url: `https://${pullZone}/${stored}`, mediaType: mediaTypes[index] });
        }

        let thumbnailUrl: string | null = null;
        if (thumbnail instanceof File && thumbnail.size > 0) {
          const thumbPath = `posts/${user.id}/${postId}/thumbnail.jpg`;
          const uploadedThumb = await uploadToBunny(thumbPath, thumbnail, endpoint, zone, password);
          if (uploadedThumb) thumbnailUrl = `https://${pullZone}/${uploadedThumb}`;
        }

        // A sound that fails to store isn't worth losing the post over — the
        // media is already up by this point, and a silent post is a far better
        // outcome than a 502 after a five-photo upload. It just doesn't get a
        // track.
        let audioUrl: string | null = null;
        let audioBytes = 0;
        // Two ways in, one way out: whichever the sound came from, it ends up
        // copied into our own storage. A post must not depend on a third
        // party's URL still resolving next year.
        const audioBody =
          audio instanceof File && audio.size > 0
            ? { blob: audio, type: audio.type, size: audio.size }
            : audioSource
              ? await fetchTrustedAudio(audioSource, pullZone)
              : null;

        if (audioBody) {
          const ext = AUDIO_EXTENSIONS[audioBody.type] ?? "mp3";
          const audioPath = `posts/${user.id}/${postId}/audio.${ext}`;
          const storedAudio = await uploadToBunny(
            audioPath,
            audioBody.blob,
            endpoint,
            zone,
            password,
          );
          if (storedAudio) {
            audioUrl = `https://${pullZone}/${storedAudio}`;
            audioBytes = audioBody.size;
          }
        }

        const { supabaseAdmin: supabase } =
          await import("@/lib/integrations/my-supabase/client.server");

        // Item 0 is mirrored onto the posts row — see the header comment.
        const cover = uploaded[0];

        const { data: post, error } = await supabase
          .from("posts")
          .insert({
            id: postId,
            user_id: user.id,
            media_url: cover.url,
            media_type: cover.mediaType,
            thumbnail_url: thumbnailUrl,
            audio_url: audioUrl,
            audio_name: audioUrl ? audioName : null,
            // Only meaningful next to a stored track. Writing a credit for a
            // sound that failed to upload would claim we are playing something
            // we are not.
            audio_attribution: audioUrl ? audioAttribution : null,
            audio_licence: audioUrl ? audioLicence : null,
            audio_source_url: audioUrl ? audioSourceUrl : null,
            // What this post costs in storage, which is what the drafts page
            // reports — so the track counts too.
            media_bytes: totalBytes + audioBytes,
            created_with: createdWithRaw,
            caption,
            location,
            visibility,
            status,
          })
          .select("id, status")
          .single();

        if (error) {
          console.error("Failed to create post:", error.message);
          return Response.json({ error: "Something went wrong" }, { status: 500 });
        }

        // The carousel itself. A failure here would leave a post showing only
        // its cover, so it takes the post down with it rather than publishing
        // something quietly missing four of its five photos.
        const { error: mediaError } = await supabase.from("post_media").insert(
          uploaded.map((item, index) => ({
            post_id: postId,
            position: index,
            media_url: item.url,
            media_type: item.mediaType,
            // Only the cover has a poster today: it is the one the publish
            // screen's cover picker produces, and photos are their own poster.
            thumbnail_url: index === 0 ? thumbnailUrl : null,
          })),
        );

        if (mediaError) {
          console.error("Failed to write post media:", mediaError.message);
          await supabase.from("posts").delete().eq("id", postId);
          return Response.json({ error: "Something went wrong" }, { status: 500 });
        }

        // Only tag products the caller actually owns -- productIds is
        // client-supplied and admin bypasses RLS, so this is the only check.
        // Two queries rather than an embedded-filter join, since PostgREST's
        // dot-path filters on embedded resources don't type-check cleanly
        // against the generated types.
        if (productIds.length > 0) {
          const { data: ownedStores, error: storesError } = await supabase
            .from("stores")
            .select("id")
            .eq("owner_id", user.id);

          if (storesError) {
            console.error("Failed to look up owned stores for tags:", storesError.message);
          } else if (ownedStores && ownedStores.length > 0) {
            const storeIds = ownedStores.map((s) => s.id);
            const { data: ownedProducts, error: productsError } = await supabase
              .from("products")
              .select("id")
              .in("id", productIds)
              .in("store_id", storeIds);

            if (productsError) {
              console.error("Failed to verify product ownership for tags:", productsError.message);
            } else if (ownedProducts && ownedProducts.length > 0) {
              const tagRows = ownedProducts.map((p) => ({ post_id: post.id, product_id: p.id }));
              const { error: tagsError } = await supabase.from("post_product_tags").insert(tagRows);
              if (tagsError) console.error("Failed to insert product tags:", tagsError.message);
            }
          }
        }

        return Response.json({ id: post.id, status: post.status }, { status: 201 });
      },
    },
  },
});
