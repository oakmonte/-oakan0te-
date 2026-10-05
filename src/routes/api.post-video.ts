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
 * POST, no body. Returns { libraryId, videoId, expires, signature }.
 */

const SIGNATURE_TTL_SECONDS = 6 * 60 * 60;

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

        const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
          method: "POST",
          headers: { AccessKey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ title: `${user.id}/${crypto.randomUUID()}` }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("Bunny Stream create failed:", res.status, text.slice(0, 300));
          return Response.json({ error: "Could not start the video upload" }, { status: 502 });
        }
        const { guid } = (await res.json()) as { guid: string };

        const expires = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS;
        const signature = await sha256Hex(`${libraryId}${apiKey}${expires}${guid}`);
        return Response.json({ libraryId, videoId: guid, expires, signature });
      },
    },
  },
});
