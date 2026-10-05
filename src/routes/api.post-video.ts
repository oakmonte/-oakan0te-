import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

/**
 * Lets the phone upload a post's video STRAIGHT to Bunny Stream, never
 * through us. Vercel caps a request body at 4.5 MB, so routing video bytes
 * through a server route failed for practically every real video.
 *
 * Creates an empty video in the Stream library (titled with the caller's
 * user id, which /api/posts checks before accepting it) and returns a TUS
 * upload signature for that one video, valid for a few hours. The API key
 * never leaves the server: the signature is sha256(library + key + expiry +
 * videoId), so it can't be reused for any other video.
 *
 * POST, no body. Returns { libraryId, videoId, title, expires, signature }.
 */

// Long enough for a 60-second clip on a slow connection, short enough that a
// leaked signature isn't a standing upload slot.
const SIGNATURE_TTL_SECONDS = 2 * 60 * 60;
// Upload slots one account can open per hour. A real person posts a few
// videos an hour; without a cap, any signed-in account could loop this route
// and use the library as free unlimited video hosting on our bill.
const MAX_VIDEOS_PER_HOUR = 20;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/post-video")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
        const apiKey = process.env.BUNNY_STREAM_API_KEY;
        if (!libraryId || !apiKey) {
          console.error("Post video upload: Bunny Stream is not configured");
          return Response.json({ error: "Video uploads are not configured" }, { status: 500 });
        }

        const user = await getRequestUser(request);
        if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

        // Counted from the library itself (every video this route makes is
        // titled "<user id>/..."), so no table to keep in step with Bunny.
        const recent = await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos?page=1&itemsPerPage=100&orderBy=date&search=${user.id}`,
          { headers: { AccessKey: apiKey, Accept: "application/json" } },
        );
        if (recent.ok) {
          const { items = [] } = (await recent.json()) as {
            items?: { title?: string; dateUploaded?: string }[];
          };
          const hourAgo = Date.now() - 60 * 60 * 1000;
          const count = items.filter(
            (v) =>
              v.title?.startsWith(`${user.id}/`) &&
              // Bunny returns this without a zone suffix; it is UTC.
              Date.parse(v.dateUploaded?.endsWith("Z") ? v.dateUploaded : `${v.dateUploaded}Z`) >
                hourAgo,
          ).length;
          if (count >= MAX_VIDEOS_PER_HOUR) {
            return Response.json(
              { error: "You've posted a lot of videos in the last hour — try again a bit later" },
              { status: 429 },
            );
          }
        } else {
          // Fail open: a listing hiccup shouldn't stop someone posting.
          console.error("Bunny Stream list failed:", recent.status);
        }

        // The title is how /api/posts knows this video is the caller's. The
        // client must send this exact title in its TUS metadata: Bunny
        // overwrites the video's title with whatever the upload says.
        const title = `${user.id}/${crypto.randomUUID()}`;
        const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
          method: "POST",
          headers: { AccessKey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("Bunny Stream create failed:", res.status, text.slice(0, 300));
          return Response.json({ error: "Could not start the video upload" }, { status: 502 });
        }
        const { guid } = (await res.json()) as { guid: string };

        const expires = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS;
        const signature = await sha256Hex(`${libraryId}${apiKey}${expires}${guid}`);
        return Response.json({ libraryId, videoId: guid, title, expires, signature });
      },
    },
  },
});
