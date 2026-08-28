import { useRef } from "react";

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
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0] ?? null;
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
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
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
