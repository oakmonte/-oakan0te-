import { useEffect, useRef, useState } from "react";

const LENGTH = 6;

/** Six-box OTP entry.
 *
 *  Slot state is held here as a fixed-length array rather than being derived
 *  from the compact string: deriving it meant clearing a middle box shifted
 *  every later digit one place left ("123456" minus box 3 rendered as "12456"),
 *  which is exactly what happens when someone pastes a code then fixes a typo.
 *  The parent still receives a compact string, so an incomplete code is shorter
 *  than LENGTH and keeps the submit button disabled. */
export function CodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [slots, setSlots] = useState<string[]>(() => Array(LENGTH).fill(""));

  // The parent clears `value` on resend / "use a different email".
  useEffect(() => {
    if (value === "") setSlots(Array(LENGTH).fill(""));
  }, [value]);

  const commit = (next: string[]) => {
    setSlots(next);
    onChange(next.join(""));
  };

  const fill = (from: number, digits: string) => {
    const next = [...slots];
    for (let i = 0; i < digits.length && from + i < LENGTH; i++) next[from + i] = digits[i];
    commit(next);
    inputsRef.current[Math.min(from + digits.length, LENGTH - 1)]?.focus();
  };

  const setDigit = (index: number, char: string) => {
    const clean = char.replace(/\D/g, "");
    // Android clipboard chips and some OTP autofills deliver the whole code as
    // one `input` event rather than a paste, so spread it instead of keeping a
    // single digit and silently dropping the other five.
    if (clean.length > 1) {
      fill(index, clean.slice(0, LENGTH - index));
      return;
    }
    const next = [...slots];
    next[index] = clean;
    commit(next);
    if (clean && index < LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !slots[index] && index > 0) {
      e.preventDefault();
      const next = [...slots];
      next[index - 1] = "";
      commit(next);
      inputsRef.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    commit(Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? ""));
    inputsRef.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {slots.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          // Lets iOS and Android offer the code straight from the mail banner
          // instead of making the user switch apps to read it.
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          className="w-11 h-13 rounded-xl border border-[#0A0A0A]/25 bg-transparent text-center text-lg font-medium focus:outline-none focus:border-[#2151F5] transition-colors disabled:opacity-50"
        />
      ))}
    </div>
  );
}
