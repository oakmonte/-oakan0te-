import { useRef } from "react";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp)$/i;

/** Only real files of an accepted type. The OS picker's `accept` is a
 *  hint, not a rule: Windows lets a folder be multi-selected alongside
 *  photos, and Chrome hands it over as an empty, typeless "file" -- an
 *  upload that can only fail. A file with no type (HEIC on some Windows
 *  setups) is judged by its extension. */
export function acceptedFiles(files: Iterable<File>, accept: string): File[] {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const wantsImage = tokens.some((t) => t.startsWith("image/"));
  const wantsVideo = tokens.some((t) => t.startsWith("video/"));
  return Array.from(files).filter((file) => {
    if (file.size === 0) return false;
    if (tokens.length === 0) return true;
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (!type) {
      return (
        (wantsImage && IMAGE_EXT.test(name)) ||
        (wantsVideo && VIDEO_EXT.test(name)) ||
        tokens.some((t) => t.startsWith(".") && name.endsWith(t))
      );
    }
    return tokens.some((t) =>
      t.startsWith(".")
        ? name.endsWith(t)
        : t.endsWith("/*")
          ? type.startsWith(t.slice(0, -1))
          : type === t,
    );
  });
}

/** Renders a hidden `<input type=file>` and resolves a promise with whatever
 *  the user picked (or null on cancel) instead of wiring up onChange/refs at
 *  every call site. `node` must be rendered somewhere in the tree.
 *
 *  `capture: "environment"` jumps a mobile browser straight to the rear
 *  camera, skipping the OS's own library/camera/files chooser — there is no
 *  web API to steer that combined chooser toward just one of its other two
 *  options, so a picker without `capture` still lets the OS show its full
 *  menu regardless of how the button that triggered it was labeled. */
export function useFilePicker(accept: string, capture?: "user" | "environment") {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveRef = useRef<((file: File | null) => void) | null>(null);

  const node = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      capture={capture}
      // Visually hidden, NOT display:none: some Android WebViews (the
      // in-app browsers of Instagram, TikTok and others) silently ignore a
      // programmatic click() on a display:none file input, so the tap did
      // nothing at all -- no picker, no error.
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const file = acceptedFiles(e.target.files ?? [], accept)[0] ?? null;
        e.target.value = "";
        resolveRef.current?.(file);
        resolveRef.current = null;
      }}
    />
  );

  function pick(): Promise<File | null> {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      inputRef.current?.click();
    });
  }

  return { node, pick };
}

/** Same as useFilePicker, but resolves every file the user picked (native
 *  multi-select) instead of just the first — used wherever more than one
 *  image can be uploaded in one go. */
export function useMultiFilePicker(accept: string, multiple = true) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveRef = useRef<((files: File[]) => void) | null>(null);

  const node = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      // Visually hidden, NOT display:none: some Android WebViews (the
      // in-app browsers of Instagram, TikTok and others) silently ignore a
      // programmatic click() on a display:none file input, so the tap did
      // nothing at all -- no picker, no error.
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const files = acceptedFiles(e.target.files ?? [], accept);
        e.target.value = "";
        resolveRef.current?.(files);
        resolveRef.current = null;
      }}
    />
  );

  function pick(): Promise<File[]> {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      inputRef.current?.click();
    });
  }

  return { node, pick };
}
