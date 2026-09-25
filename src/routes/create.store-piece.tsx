import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { uploadStorePieceImage } from "@/lib/upload-store-piece-image";
import { blockedContentMessage, findBlockedContent } from "@/lib/content-policy";

// Deliberately NOT a detour through the camera/photo-editor/video-editor
// pipeline (create.after-shot.publish.tsx and friends) -- that exists for
// filters/text/stickers/crop/sound/product-tagging/carousels, none of which
// apply to "one photo plus a caption". Threading a new destination through
// capture-handoff.ts's in-memory contract for no UX benefit isn't worth the
// risk to the existing posts flow. See storeTabsFor in profile-tabs.tsx for
// why this feature exists at all.
export const Route = createFileRoute("/create/store-piece")({
  // Same theme-color override as create.after-shot.publish.tsx, and for the
  // same reason: root declares black for the camera/editor screens, and a
  // white page under that theme-color gets framed in a color it doesn't use.
  head: () => ({
    meta: [{ title: "Add a piece — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { storeId: string; storeUsername: string } => ({
    storeId: typeof search.storeId === "string" ? search.storeId : "",
    storeUsername: typeof search.storeUsername === "string" ? search.storeUsername : "",
  }),
  component: StorePiecePage,
});

function StorePiecePage() {
  const navigate = useNavigate();
  const { storeId, storeUsername } = Route.useSearch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => {
    if (storeUsername) {
      navigate({ to: "/store-profile/$storeUsername", params: { storeUsername } });
    } else {
      navigate({ to: "/home" });
    }
  };

  const pickFile = (f: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  async function handleSubmit(status: "published" | "draft") {
    if (!file || !storeId || submitting) return;
    const blocked = findBlockedContent(caption);
    if (blocked.length > 0) {
      setError(blockedContentMessage(blocked));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const url = await uploadStorePieceImage(file, storeId);
      const { error: insertError } = await supabase.from("store_pieces").insert({
        store_id: storeId,
        media_url: url,
        caption: caption.trim() || null,
        status,
      });
      if (insertError) throw insertError;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (storeUsername) {
        navigate({
          to: "/store-profile/$storeUsername",
          params: { storeUsername },
          replace: true,
        });
      } else {
        navigate({ to: "/home", replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that piece. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-white text-black overflow-y-auto"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="oak-motion-control flex items-center justify-center w-9 h-9 -ml-1 active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold">Add a piece</span>
        <span className="w-9" />
      </div>

      <div className="px-4 pb-40">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
          }}
        />

        {previewUrl ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="block w-full aspect-square rounded-2xl overflow-hidden bg-gray-100"
          >
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="oak-motion-control flex flex-col items-center justify-center gap-2 w-full aspect-square rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 active:scale-[0.99]"
          >
            <ImagePlus size={28} />
            <span className="text-[13px] font-medium">Choose a photo</span>
          </button>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Say something about this piece (optional)"
          rows={4}
          maxLength={2200}
          className="w-full mt-4 bg-transparent text-[15px] placeholder:text-gray-400 focus:outline-none resize-none"
        />

        {error && <p className="text-[13px] text-red-600 mt-1">{error}</p>}
      </div>

      <div
        className="fixed left-0 right-0 bottom-0 flex gap-3 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          background: "linear-gradient(to top, #fff 60%, rgba(255,255,255,0))",
        }}
      >
        <button
          type="button"
          onClick={() => handleSubmit("draft")}
          disabled={!file || submitting}
          className="oak-motion-control flex-1 rounded-full border border-gray-300 py-3.5 text-[14px] font-semibold disabled:opacity-50 active:scale-[0.98]"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("published")}
          disabled={!file || submitting}
          className="oak-motion-control flex-[1.3] rounded-full py-3.5 text-[14px] font-bold disabled:opacity-50 active:scale-[0.98]"
          style={{ background: "#000", color: "#fff" }}
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}
