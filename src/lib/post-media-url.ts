/** Whether `u` is a post image this user uploaded through /api/post-media:
 *  exactly https://<pullZone>/posts/<userId>/<uuid>/<media-N|thumbnail>.<ext>,
 *  no query or fragment. Parsed with URL rather than prefix-matched -- a URL
 *  parser resolves "%2e%2e/" to "..", so a startsWith check let
 *  "posts/<me>/%2e%2e/<someone else>/..." through to another user's files. */
export function isOwnPostMediaUrl(u: unknown, pullZone: string, userId: string): boolean {
  if (typeof u !== "string") return false;
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.host !== pullZone || url.search || url.hash) return false;
  const parts = url.pathname.split("/");
  // ["", "posts", userId, uuid, file]
  return (
    parts.length === 5 &&
    parts[1] === "posts" &&
    parts[2] === userId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(parts[3]) &&
    /^(media-\d{1,2}|thumbnail)\.(jpg|png|webp|gif)$/.test(parts[4])
  );
}
