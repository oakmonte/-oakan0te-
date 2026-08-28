import { useRef } from "react";

/** Renders a hidden `<input type=file>` and resolves a promise with whatever
 *  the user picked (or null on cancel) instead of wiring up onChange/refs at
 *  every call site. `node` must be rendered somewhere in the tree. */
export function useFilePicker(accept: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveRef = useRef<((file: File | null) => void) | null>(null);

  const node = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
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
