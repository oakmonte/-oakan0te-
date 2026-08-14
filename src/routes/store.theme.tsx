import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";

export const Route = createFileRoute("/store/theme")({
  component: StoreTheme,
});

const THEMES = [
  { id: "default", name: "Oakmonte Classic", preview: "https://placehold.co/300x400" },
];

function StoreTheme() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Choose a store theme</h1>
      <p className="text-sm text-gray-500 mb-6">
        More themes are coming before launch — for now, pick this one.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setSelected(theme.id)}
            className="relative text-left"
          >
            <img src={theme.preview} alt={theme.name} className="w-full rounded-xl object-cover" />
            {selected === theme.id && (
              <div className="absolute top-2 right-2 bg-black text-white rounded-full p-1">
                <Check size={14} />
              </div>
            )}
            <p className="text-sm font-medium mt-2">{theme.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
