import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { MapPin } from "lucide-react";
import { authedFetch } from "@/lib/authed-fetch";
import { requestAutocomplete, requestPlaceAddress } from "@/lib/places-google";

// Public, referrer-restricted key: lets the phone ask Google directly instead
// of going through our server in Washington (~1s saved per keystroke from
// Nigeria). Absent, or if a direct call fails, the server route is used.
const BROWSER_KEY = import.meta.env.VITE_GOOGLE_PLACES_BROWSER_KEY as string | undefined;

// Answers already fetched, per country + text: backspacing or retyping is
// instant. Module-level so it survives the form closing and reopening.
const suggestionCache = new Map<string, Suggestion[]>();

async function fetchSuggestions(
  q: string,
  sessionToken: string,
  regionCode: string | undefined,
  signal: AbortSignal,
): Promise<Suggestion[]> {
  if (BROWSER_KEY) {
    try {
      return await requestAutocomplete(BROWSER_KEY, q, sessionToken, regionCode ?? null, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      // Fall through to the server route.
    }
  }
  const res = await authedFetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: q, sessionToken, regionCode }),
    signal,
  });
  const body = (await res.json().catch(() => null)) as { suggestions?: Suggestion[] } | null;
  return body?.suggestions ?? [];
}

async function fetchAddress(placeId: string, sessionToken: string): Promise<PickedAddress | null> {
  if (BROWSER_KEY) {
    try {
      return await requestPlaceAddress(BROWSER_KEY, placeId, sessionToken);
    } catch {
      // Fall through to the server route.
    }
  }
  const res = await authedFetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, sessionToken }),
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { address?: PickedAddress | null } | null;
  return body?.address ?? null;
}

export type PickedAddress = {
  line1: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  formatted: string;
};

type Suggestion = { placeId: string; main: string; secondary: string };

function newToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2);
}

/** Address line 1 with real address suggestions as you type (Google Places,
 *  through api.places.autocomplete). Picking one hands the whole address back
 *  through onPick to fill the rest of the form. Without a Places key on the
 *  server it's a plain input.
 *
 *  One session token per typing-then-picking run: Google bills the keystrokes
 *  and the final lookup as one session instead of call by call. */
export function AddressAutocomplete({
  value,
  onChange,
  onPick,
  regionCode,
  tone = "dark",
  className = "",
  ...input
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (address: PickedAddress) => void;
  /** ISO country code to keep suggestions in the chosen country. */
  regionCode?: string;
  tone?: "dark" | "dashboard";
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const token = useRef(newToken());
  // Set when a pick fills the input, so that change doesn't search again.
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const cacheKey = `${regionCode ?? ""}|${q.toLowerCase()}`;
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    // A newer keystroke aborts the request in flight, so a slow old answer
    // can never overwrite a newer one.
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetchSuggestions(q, token.current, regionCode, controller.signal)
        .then((found) => {
          suggestionCache.set(cacheKey, found);
          setSuggestions(found);
        })
        .catch(() => {});
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [value, regionCode]);

  async function pick(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    const address = await fetchAddress(s.placeId, token.current).catch(() => null);
    token.current = newToken();
    picked.current = true;
    if (address) onPick(address);
    else onChange(s.main);
  }

  const list =
    tone === "dark"
      ? "border-white/15 bg-[#161616] text-white"
      : "border-sd-line bg-sd-surface text-sd-ink";
  const muted = tone === "dark" ? "text-white/50" : "text-sd-ink-muted";
  const hover = tone === "dark" ? "active:bg-white/10" : "active:bg-sd-elevated";

  return (
    <div className="relative">
      <input
        {...input}
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Long enough for a tap on a suggestion to land first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        // The browser's own saved-address dropdown would sit on top of ours.
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className={`absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border shadow-xl ${list}`}
        >
          {suggestions.slice(0, 5).map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                // Keeps the input focused (and the keyboard up) through the tap.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => void pick(s)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left ${hover}`}
              >
                <MapPin size={16} className={`mt-0.5 shrink-0 ${muted}`} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{s.main}</span>
                  {s.secondary && (
                    <span className={`block truncate text-[13px] ${muted}`}>{s.secondary}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          <li className={`px-4 py-1.5 text-right text-[10px] ${muted}`}>Powered by Google</li>
        </ul>
      )}
    </div>
  );
}
