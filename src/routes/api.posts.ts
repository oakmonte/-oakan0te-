import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { isOwnPostMediaUrl } from "@/lib/post-media-url";

/**
 * Publishes a post whose media is ALREADY in Bunny: photos and the poster
 * frame went up one at a time through /api/post-media (Bunny Storage), and
 * videos straight from the phone to Bunny Stream (/api/post-video). This
 * request carries no media bytes at all -- Vercel refuses request bodies over
 * 4.5 MB, which is what made video posts fail. It writes the posts row plus
 * one post_media row per item, and tags any of the caller's own products.
 *
 * POST multipart/form-data:
 *   items        JSON array, IN CAROUSEL ORDER                  (required)
 *                  { type: "photo", url, bytes }   url from /api/post-media
 *                  { type: "video", videoId, bytes }  a Bunny Stream video
 *                                                     from /api/post-video
 *   thumbnailUrl poster frame for item 0, from /api/post-media  (optional)
 *   audioName    display name for the post's sound              (optional)
 *   audioSource  a catalogue track's URL, fetched server-side   (optional)
 *   audioLicence licence the track is used under                (required with
 *                audioSource or audioBakedIn)
 *   audioAttribution  credit line to show beside the post       (optional)
 *   audioSourceUrl    page the track came from                  (optional)
 *   audioBakedIn '1' when the track is already inside the media  (optional)
 *                — video editor only; no bytes stored, credit still written
 *   caption      text                                          (optional)
 *   location     freeform text                                 (optional)
 *   visibility   'public' | 'followers' | 'only_me'             (default 'public')
 *   status       'published' | 'draft'                         (default 'published')
 *   createdWith  'camera' | 'photo-editor' | 'video-editor'     (optional)
 *   productIds   JSON array of product ids to tag               (optional)
 *
 * Every URL must sit under this caller's own posts/<user id>/ folder, and
 * every video must be one /api/post-video created for this caller, so a
 * request can't attach someone else's media to its post.
 *
 * Item 0 is the cover, and its url/type/thumbnail are ALSO written to the
 * posts row itself. That mirroring is what lets every existing reader — the
 * feed, the profile grid, the media pickers — keep working without knowing
 * post_media exists. See the migration for the expand/contract plan.
 */

const MAX_ITEMS = 10;
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
type IncomingItem =
  | { type: "photo"; url: string; bytes?: number }
  | { type: "video"; videoId: string; bytes?: number };
type StreamVideo = { title?: string; status?: number; storageSize?: number };
const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

// `fetchTrustedAudio` used to live here. It moved to
// `@/lib/trusted-audio.server` when the video editor needed the same fetch,
// with the same allowlist, to stream a track to the phone — two copies of a
// check like that means the weaker copy is the one that decides.

export const Route = createFileRoute("/api/posts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
        const password = process.env.BUNNY_STORAGE_PASSWORD;
        const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com";
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME;
        const streamLibrary = process.env.BUNNY_STREAM_LIBRARY_ID;
        const streamKey = process.env.BUNNY_STREAM_API_KEY;
        const streamCdn = process.env.BUNNY_STREAM_CDN_HOSTNAME;

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

        const itemsRaw = form.get("items") as string | null;
        const thumbnailUrlRaw = (form.get("thumbnailUrl") as string | null) || null;
        const audioName =
          (form.get("audioName") as string | null)?.trim().slice(0, MAX_AUDIO_NAME_LENGTH) || null;
        // A library track arrives as a URL rather than bytes — see
        // `fetchTrustedAudio`. Its credit rides along with it.
        const audioSource = (form.get("audioSource") as string | null)?.trim() || null;
        // The video editor mixes its music into the MP4, so there are no
        // separate bytes to store and nothing for the feed to play. The credit
        // still has to be written: the post IS playing that track, and a row
        // that doesn't say so is the licence breach, not the missing file.
        const audioBakedIn = (form.get("audioBakedIn") as string | null) === "1";
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

        let items: IncomingItem[] = [];
        try {
          const parsed: unknown = JSON.parse(itemsRaw ?? "");
          if (Array.isArray(parsed)) items = parsed as IncomingItem[];
        } catch {
          return Response.json({ error: "items must be a JSON array" }, { status: 400 });
        }
        if (items.length === 0) {
          return Response.json({ error: "At least one item is required" }, { status: 400 });
        }
        if (items.length > MAX_ITEMS) {
          return Response.json(
            { error: `A post can hold at most ${MAX_ITEMS} items` },
            { status: 400 },
          );
        }
        // Only media this caller uploaded: photos under their own folder,
        // videos /api/post-video created for them. Parsed, not prefix-matched:
        // a URL parser resolves "%2e%2e/" to "..", so a string startsWith
        // check let "posts/<me>/%2e%2e/<someone else>/..." through. The path
        // has to be exactly what /api/post-media writes, nothing else.
        const ownsUrl = (u: unknown) => isOwnPostMediaUrl(u, pullZone, user.id);
        const validBytes = (b: unknown) =>
          b === undefined || (typeof b === "number" && Number.isSafeInteger(b) && b > 0);
        for (const it of items) {
          if (!validBytes(it?.bytes)) {
            return Response.json({ error: "Invalid item size" }, { status: 400 });
          }
          if (it?.type === "photo") {
            if (!ownsUrl(it.url)) {
              return Response.json({ error: "Invalid photo" }, { status: 400 });
            }
          } else if (it?.type === "video") {
            if (typeof it.videoId !== "string" || !VIDEO_ID.test(it.videoId)) {
              return Response.json({ error: "Invalid video" }, { status: 400 });
            }
          } else {
            return Response.json(
              { error: "Every item must be a photo or a video" },
              { status: 400 },
            );
          }
        }
        if (thumbnailUrlRaw && !ownsUrl(thumbnailUrlRaw)) {
          return Response.json({ error: "Invalid thumbnail" }, { status: 400 });
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

        const videoIds = items.flatMap((it) => (it.type === "video" ? [it.videoId] : []));
        if (videoIds.length > 0 && (!streamLibrary || !streamKey || !streamCdn)) {
          console.error("Post publish: Bunny Stream is not configured");
          return Response.json({ error: "Video uploads are not configured" }, { status: 500 });
        }
        // Each video must exist in our library, have been created for this
        // caller (api.post-video.ts titles it "<user id>/..."), and actually
        // have been uploaded -- a created-but-never-uploaded video would be a
        // post whose /original 404s. Bunny status: 0 created, 1 uploaded,
        // 2-4 processing..finished, 5 encode error (the original is still
        // fine), 6 upload failed. A just-finished TUS upload can still read 0
        // for a moment, so 0 is re-checked briefly before giving up.
        for (const videoId of videoIds) {
          let video: StreamVideo | null = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            const res = await fetch(
              `https://video.bunnycdn.com/library/${streamLibrary}/videos/${videoId}`,
              { headers: { AccessKey: streamKey!, Accept: "application/json" } },
            );
            video = res.ok ? ((await res.json()) as StreamVideo) : null;
            if (!video || video.status !== 0 || (video.storageSize ?? 0) > 0) break;
            await new Promise((r) => setTimeout(r, 750));
          }
          if (!video?.title?.startsWith(`${user.id}/`)) {
            return Response.json({ error: "Invalid video" }, { status: 400 });
          }
          if (video.status === 6 || (video.status === 0 && !(video.storageSize ?? 0))) {
            return Response.json(
              { error: "That video didn't finish uploading — try posting again" },
              { status: 409 },
            );
          }
        }

        // Server-only, so it comes in through the handler rather than at the
        // top of a route file — same rule as the admin Supabase client.
        const { fetchTrustedAudio } = await import("@/lib/trusted-audio.server");

        // A catalogue track has to arrive with its licence. The three credit
        // fields are stored verbatim and nothing here re-derives them from the
        // file, so without this a request could name a CC BY track as its
        // `audioSource`, omit the credit, and publish an uncredited track with
        // nothing in the row to show it happened. The app always sends both
        // together; anything that doesn't is either broken or trying it on,
        // and neither should be quietly repaired into a licence breach.
        if ((audioSource || audioBakedIn) && !audioLicence) {
          return Response.json(
            { error: "That sound is missing its licence details" },
            { status: 400 },
          );
        }
        // Baked in means "already inside the media". Sending bytes as well
        // would publish a post playing two tracks at once, so this is a
        // disagreement about what is being published rather than a field to
        // reconcile.
        if (audioBakedIn && audioSource) {
          return Response.json(
            { error: "A baked-in sound cannot also be uploaded" },
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

        // A Stream video plays from its ORIGINAL -- the file the phone
        // uploaded, which is already a 720p H.264 MP4 (post-media-upload.ts
        // makes sure of that). It's there the moment the upload finishes,
        // where Bunny's play_720p.mp4 404'd for the minute encoding took (the
        // black-screen posts), and it skips a second lossy re-encode that
        // left video blocky and dark. Needs "Keep original files" on in the
        // library's Encoding settings.
        const uploaded = items.map((it) =>
          it.type === "photo"
            ? { url: it.url, mediaType: "photo" }
            : { url: `https://${streamCdn}/${it.videoId}/original`, mediaType: "video" },
        );
        const totalBytes = items.reduce(
          (n, it) => n + (typeof it.bytes === "number" && it.bytes > 0 ? it.bytes : 0),
          0,
        );
        const first = items[0];
        const thumbnailUrl =
          thumbnailUrlRaw ??
          (first.type === "video" ? `https://${streamCdn}/${first.videoId}/thumbnail.jpg` : null);

        // A sound that fails to store isn't worth losing the post over — the
        // media is already up by this point, and a silent post is a far better
        // outcome than a 502 after a five-photo upload. It just doesn't get a
        // track.
        let audioUrl: string | null = null;
        let audioBytes = 0;
        // Two ways in, one way out: whichever the sound came from, it ends up
        // copied into our own storage. A post must not depend on a third
        // party's URL still resolving next year.
        const audioBody = audioSource ? await fetchTrustedAudio(audioSource, [pullZone]) : null;

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
            audio_name: audioUrl || audioBakedIn ? audioName : null,
            // A credit is written when the post actually carries the track:
            // either as a stored file, or mixed into the media itself. Writing
            // one for a sound that failed to upload would claim we are playing
            // something we are not; withholding one from a baked-in track
            // would hide a credit the licence requires.
            audio_attribution: audioUrl || audioBakedIn ? audioAttribution : null,
            audio_licence: audioUrl || audioBakedIn ? audioLicence : null,
            audio_source_url: audioUrl || audioBakedIn ? audioSourceUrl : null,
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
