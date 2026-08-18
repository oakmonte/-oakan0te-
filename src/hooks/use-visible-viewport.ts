import { useEffect, useState } from "react";

export type VisibleViewport = {
  top: number; // offset of the visible band from the top of the layout viewport, px
  height: number; // height of the band the keyboard does NOT cover, px
  keyboardHeight: number; // 0 when the keyboard is down
};

type VirtualKeyboardLike = EventTarget & {
  overlaysContent: boolean;
  boundingRect: DOMRectReadOnly;
};

function getVirtualKeyboard(): VirtualKeyboardLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { virtualKeyboard?: VirtualKeyboardLike }).virtualKeyboard;
}

// Measures the slice of screen the on-screen keyboard leaves visible, so a
// full-screen editor can lay itself out INSIDE that slice instead of letting the
// browser shove the whole page (and the photo behind it) upward to reveal the
// focused field.
//
// Two browsers, two mechanisms — neither alone is enough:
//   * Chromium honours `interactive-widget=overlays-content` (set in __root.tsx),
//     which means the keyboard covers the page and nothing resizes — visualViewport
//     stays full height, so it cannot tell you the keyboard is even open. The
//     VirtualKeyboard API is the only source of the keyboard rect there, and it
//     only starts reporting once `overlaysContent` is opted into from script.
//   * Safari/iOS ignores `interactive-widget` entirely: it shrinks the VISUAL
//     viewport and pans it upward. visualViewport height/offsetTop is the signal
//     there, and following offsetTop is what re-glues the panel to what's actually
//     on screen if Safari pans anyway.
export function useVisibleViewport(active: boolean): VisibleViewport {
  const [box, setBox] = useState<VisibleViewport>(() => ({
    top: 0,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
    keyboardHeight: 0,
  }));

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const vk = getVirtualKeyboard();
    const vv = window.visualViewport;
    const previousOverlays = vk?.overlaysContent;
    if (vk) vk.overlaysContent = true;

    const read = () => {
      const keyboardHeight = Math.round(vk?.boundingRect.height ?? 0);
      if (keyboardHeight > 0) {
        // Chromium path: layout viewport untouched, so the visible band is
        // simply the top of the page down to the top of the keyboard.
        setBox({
          top: 0,
          height: Math.max(0, window.innerHeight - keyboardHeight),
          keyboardHeight,
        });
        return;
      }
      const height = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      setBox({
        top,
        height,
        keyboardHeight: Math.max(0, Math.round(window.innerHeight - height - top)),
      });
    };

    read();
    vk?.addEventListener("geometrychange", read);
    vv?.addEventListener("resize", read);
    vv?.addEventListener("scroll", read);
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      vk?.removeEventListener("geometrychange", read);
      vv?.removeEventListener("resize", read);
      vv?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      if (vk && previousOverlays !== undefined) vk.overlaysContent = previousOverlays;
    };
  }, [active]);

  return box;
}
