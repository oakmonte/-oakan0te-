import { useEffect, useRef } from "react";

// The one "are you sure?" the three video editors share.
//
// Every editor here keeps its work in memory only, so leaving is the single
// action none of them can undo. It asks once, in the same words everywhere, and
// the safe answer is the prominent one: the thumb that mis-tapped Back is
// likelier to hit the big button than to read the small one.

export default function ConfirmDiscard({
  message,
  discardLabel = "Discard",
  onKeep,
  onDiscard,
}: {
  message: string;
  discardLabel?: string;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => keepRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={message}
      className="oak-motion-fade absolute inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-black/85 px-8 text-white"
      onKeyDown={(e) => {
        if (e.key === "Escape") onKeep();
      }}
    >
      <p className="max-w-[280px] text-center text-[14px] leading-snug text-white/85">{message}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDiscard}
          className="h-11 rounded-full bg-white/[0.12] px-5 text-[14px] font-semibold text-[#FF7A7A] active:scale-95"
        >
          {discardLabel}
        </button>
        <button
          ref={keepRef}
          type="button"
          onClick={onKeep}
          className="h-11 rounded-full bg-white px-5 text-[14px] font-semibold text-black active:scale-95"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}
