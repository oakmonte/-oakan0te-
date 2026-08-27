import { useEffect, useState } from "react";
import heroEditorial from "@/assets/hero-editorial.jpg";
import { applyCompiledFilter, IDENTITY_FILTER } from "./canvas-filter";
import { compileGrade, isNoopFilter, type CameraFilter } from "@/components/camera/filter-data";

// Real baked preview images instead of flat color swatches or a CSS filter
// on a static <img> — every filter-listing surface (camera swatch strip,
// after-shot FilterPanel, studio GradePanel) shares this cache, so a given
// filter is only ever baked once per session regardless of how many of those
// surfaces render it.
const THUMB_SIZE = 160;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
let sourceImagePromise: Promise<HTMLImageElement> | null = null;

function loadSourceImage(): Promise<HTMLImageElement> {
  if (!sourceImagePromise) {
    sourceImagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load filter thumbnail source"));
      img.src = heroEditorial;
    });
  }
  return sourceImagePromise;
}

/** Bakes (and caches) a real preview thumbnail for a filter: a small
 *  cover-cropped square of the shared reference photo, run through the
 *  filter's actual grade — the same bake a shutter press or export produces,
 *  just at thumbnail size. */
export async function getFilterThumbnail(filter: CameraFilter): Promise<string> {
  const cached = cache.get(filter.id);
  if (cached) return cached;
  const inFlight = pending.get(filter.id);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const img = await loadSourceImage();
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // Cover-crop into the square thumbnail, matching what object-fit: cover
    // would give an <img> of the same source.
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    let sx = 0;
    let sy = 0;
    if (sw > sh) {
      sx = (sw - sh) / 2;
      sw = sh;
    } else {
      sy = (sh - sw) / 2;
      sh = sw;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, THUMB_SIZE, THUMB_SIZE);

    if (!isNoopFilter(filter)) {
      const compiled = compileGrade(filter);
      if (compiled !== IDENTITY_FILTER) {
        const imgData = ctx.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE);
        applyCompiledFilter(imgData, compiled);
        ctx.putImageData(imgData, 0, 0);
      }
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    cache.set(filter.id, dataUrl);
    pending.delete(filter.id);
    return dataUrl;
  })();

  pending.set(filter.id, promise);
  return promise;
}

function peekFilterThumbnail(filterId: string): string | null {
  return cache.get(filterId) ?? null;
}

/** React hook wrapper: returns the baked thumbnail once ready, null while
 *  it's still baking (callers fall back to `thumbnailColor` for that gap). */
export function useFilterThumbnail(filter: CameraFilter): string | null {
  const [url, setUrl] = useState<string | null>(() => peekFilterThumbnail(filter.id));

  useEffect(() => {
    const cached = peekFilterThumbnail(filter.id);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    setUrl(null);
    getFilterThumbnail(filter)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch((err) => console.error("Failed to bake filter thumbnail:", err));
    return () => {
      cancelled = true;
    };
    // filter objects are stable module-level constants keyed by id, so id is
    // the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.id]);

  return url;
}
