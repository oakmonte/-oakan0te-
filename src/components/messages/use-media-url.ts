import { useEffect, useState } from "react";
import { cachedMediaUrl, mediaUrl } from "@/lib/chat/api";

/** A displayable URL for a chat attachment: the local blob while it is still
 *  uploading, otherwise a (cached) signed URL for the private bucket. */
export function useMediaUrl(path: string | null, localUrl?: string): string | null {
  const [url, setUrl] = useState<string | null>(
    () => localUrl ?? (path ? cachedMediaUrl(path) : null),
  );

  useEffect(() => {
    if (localUrl) {
      setUrl(localUrl);
      return;
    }
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = cachedMediaUrl(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    void mediaUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path, localUrl]);

  return url;
}
