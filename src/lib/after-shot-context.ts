import { createContext, useContext } from "react";
import type { CapturedMedia } from "@/lib/capture-handoff";

export type AfterShotContextValue = {
  media: CapturedMedia;
  setMedia: (media: CapturedMedia) => void;
  discard: () => void;
};

export const AfterShotContext = createContext<AfterShotContextValue | null>(null);

export function useAfterShotContext() {
  const ctx = useContext(AfterShotContext);
  if (!ctx) throw new Error("useAfterShotContext must be used within /create/after-shot");
  return ctx;
}
