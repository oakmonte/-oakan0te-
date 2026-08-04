import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { X, Type, Pencil, Sticker, Volume2, Blend, Link2, Crop, Scissors, ChevronDown, ChevronUp } from "lucide-react";
import { useAfterShotContext } from "./create.after-shot";

export const Route = createFileRoute("/create/after-shot/")({
  head: () => ({ meta: [{ title: "Edit — Oakmonte" }] }),
  component: AfterShotIndexPage,
});

const EDIT_TOOLS = [
  { id: "text", label: "Text", icon: Type },
  { id: "annotate", label: "Draw", icon: Pencil },
  { id: "sticker", label: "Stickers", icon: Sticker },
  { id: "sound", label: "Sound", icon: Volume2 },
  { id: "filter", label: "Filters", icon: Blend },
  { id: "link", label: "Link", icon: Link2 },
] as const;

const COLLAPSED_TOOLS = [{ id: "crop", label: "Crop", icon: Crop }] as const;

function AfterShotIndexPage() {
  const navigate = useNavigate();
  const { media, discard } = useAfterShotContext();
  const [toolsExpanded, setToolsExpanded] = useState(false);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      {media.type === "photo" ? (
        <img src={media.url} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <video src={media.url} autoPlay loop playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}

      <div className="absolute top-0 left-0 right-0 flex items-center px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
        <button
          onClick={discard}
          aria-label="Discard and retake"
          className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="absolute right-4 flex flex-col items-end gap-5 z-20" style={{ top: "calc(env(safe-area-inset-top) + 76px)" }}>
        {media.type === "video" && (
          <button onClick={() => navigate({ to: "/create/after-shot/edit" })} aria-label="Trim video" className="flex items-center gap-2 opacity-90">
            <Scissors size={24} />
          </button>
        )}

        {EDIT_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button key={tool.id} aria-label={tool.label} className="flex items-center gap-2 opacity-90">
              <Icon size={24} />
            </button>
          );
        })}

        {toolsExpanded &&
          COLLAPSED_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button key={tool.id} aria-label={tool.label} className="flex items-center gap-2 opacity-90">
                <Icon size={24} />
              </button>
            );
          })}

        <button onClick={() => setToolsExpanded((v) => !v)} aria-label={toolsExpanded ? "Hide more tools" : "More tools"} className="flex items-center justify-center w-8 h-8 mt-1">
          {toolsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Next leads to the Content/Listing toggle screen — not built yet */}
      <div className="absolute left-0 right-0 flex items-center justify-end px-5 z-20" style={{ bottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        <button className="px-6 py-2.5 rounded-full font-bold text-sm uppercase tracking-wide" style={{ background: "#fff", color: "#000" }}>
          Next
        </button>
      </div>
    </div>
  );
}