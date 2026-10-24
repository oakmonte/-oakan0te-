import { useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import type { PickedAddress } from "@/components/AddressAutocomplete";
import type { NearbyPlace } from "@/lib/current-location";
import { fetchAddress, newToken } from "@/lib/places-client";

/** After "use my current location": the named places around the pin, so the
 *  person says where they are instead of the app guessing (the campus or the
 *  hall inside it). Tapping one looks it up the way a typed suggestion does,
 *  postal code included, and hands the address to onPick. */
export function NearbyPlacesPicker({
  places,
  onPick,
  tone = "dark",
}: {
  places: NearbyPlace[];
  onPick: (address: PickedAddress, place: NearbyPlace) => void;
  tone?: "dark" | "dashboard";
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const token = useRef(newToken());
  if (places.length === 0) return null;

  const box = tone === "dark" ? "border-white/35" : "border-sd-line";
  const muted = tone === "dark" ? "text-white/50" : "text-sd-ink-muted";
  const row = tone === "dark" ? "active:bg-white/10" : "active:bg-sd-elevated";
  const divider = tone === "dark" ? "divide-white/30" : "divide-sd-line";

  async function choose(p: NearbyPlace) {
    if (loading) return;
    setLoading(p.placeId);
    const address = await fetchAddress(p.placeId, token.current).catch(() => null);
    token.current = newToken();
    setLoading(null);
    if (!address) return;
    setPicked(p.placeId);
    onPick(address, p);
  }

  return (
    <div>
      <p className={`text-[13px] mb-2 ${muted}`}>Not quite right? Pick where you are:</p>
      <ul className={`rounded-xl border ${box} divide-y ${divider} overflow-hidden`}>
        {places.map((p) => (
          <li key={p.placeId}>
            <button
              type="button"
              onClick={() => void choose(p)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-left ${row}`}
            >
              <MapPin size={16} className={`shrink-0 ${muted}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{p.name}</span>
                {p.secondary && (
                  <span className={`block text-xs truncate ${muted}`}>{p.secondary}</span>
                )}
              </span>
              {loading === p.placeId ? (
                <Loader2 size={16} className={`shrink-0 animate-spin ${muted}`} />
              ) : picked === p.placeId ? (
                <Check size={16} className="shrink-0" />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
