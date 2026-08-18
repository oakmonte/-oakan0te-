import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";

export const Route = createFileRoute("/store/theme")({
  component: StoreTheme,
});

type ThemeOption = {
  id: string;
  name: string;
  description: string;
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  font: string;
};

const THEMES: ThemeOption[] = [
  {
    id: "classic",
    name: "Oakmonte Classic",
    description: "Clean black & white, lets your products lead.",
    bg: "#ffffff",
    fg: "#111111",
    accent: "#111111",
    muted: "#e5e5e5",
    font: "ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Cream backdrop, serif headlines, magazine feel.",
    bg: "#f6f1ea",
    fg: "#1c1a17",
    accent: "#1c1a17",
    muted: "#e3d9c9",
    font: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "bazaar",
    name: "Bazaar",
    description: "Warm terracotta tones, friendly and bold.",
    bg: "#fbe9df",
    fg: "#4a2b1f",
    accent: "#c1522f",
    muted: "#f0c7ae",
    font: "ui-sans-serif, system-ui, sans-serif",
  },
];

function ThemePreview({ theme }: { theme: ThemeOption }) {
  return (
    <div
      className="w-full aspect-[3/4] rounded-xl overflow-hidden flex flex-col p-3 gap-2"
      style={{ backgroundColor: theme.bg, fontFamily: theme.font }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: theme.fg }}>
          STORE
        </span>
        <div className="flex gap-1">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.fg }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.fg }} />
        </div>
      </div>

      <div className="flex-1 rounded-lg" style={{ backgroundColor: theme.muted }} />

      <div className="grid grid-cols-2 gap-1.5">
        <div className="aspect-square rounded-md" style={{ backgroundColor: theme.muted }} />
        <div className="aspect-square rounded-md" style={{ backgroundColor: theme.accent }} />
      </div>

      <div
        className="self-start rounded-full px-2 py-0.5 text-[8px] font-medium"
        style={{ backgroundColor: theme.accent, color: theme.bg }}
      >
        Shop now
      </div>
    </div>
  );
}

function StoreTheme() {
  const [selected, setSelected] = useState<string>("classic");

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Pick a store theme</h1>
      <p className="text-sm text-gray-500 mb-6">
        This sets how your storefront looks. You can change it any time before launch.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setSelected(theme.id)}
            className={`relative text-left rounded-xl border-2 p-1.5 transition-colors ${
              selected === theme.id ? "border-black bg-gray-50" : "border-transparent"
            }`}
          >
            <div className="relative">
              <ThemePreview theme={theme} />
              {selected === theme.id && (
                <div className="absolute top-2 right-2 bg-black text-white rounded-full p-1">
                  <Check size={14} />
                </div>
              )}
            </div>
            <p className="text-sm font-medium mt-2">{theme.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{theme.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
