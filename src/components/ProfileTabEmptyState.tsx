// src/components/ProfileTabEmptyState.tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Image as ImageIcon, Instagram } from "lucide-react";
import type { TabKey } from "@/routes/profile.$username";

const EMPTY_COPY: Record<Exclude<TabKey, "posts">, { title: string; subtitle: string }> = {
  store: { title: "Nothing listed yet", subtitle: "Products you list for sale will show up here." },
  wardrobe: { title: "Build your wardrobe", subtitle: "Pieces you own or want to show off live here." },
  reposts: { title: "No reposts yet", subtitle: "Content you repost from others will appear here." },
  wishlist: { title: "Nothing saved yet", subtitle: "Pieces you're eyeing go here for later." },
  likedVideos: { title: "No liked videos yet", subtitle: "Videos you like will collect here." },
  drafts: { title: "No drafts yet", subtitle: "Unfinished content and unpublished listings live here." },
};

export function ProfileTabEmptyState({ tab }: { tab: TabKey }) {
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);

  if (tab === "posts") {
    return (
      <div className="flex flex-col items-center text-center px-8 pt-12">
        <h3 className="text-[16px] font-bold mb-6">Share creative content</h3>

        <div className="flex flex-col items-center gap-2 w-full max-w-[220px]">
          <button
            onClick={() => navigate({ to: "/create" })}
            className="w-full rounded-full bg-white text-black py-3 text-[14px] font-semibold"
          >
            Create
          </button>

          <button
            onClick={() => setUploadOpen((v) => !v)}
            className="w-full rounded-full border border-white/25 py-3 text-[14px] font-semibold"
          >
            Upload
          </button>

          <div
            className={`grid transition-[grid-template-rows] duration-250 ease-out w-full ${
              uploadOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => navigate({ to: "/create", search: { source: "gallery" } })}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-white/[0.06] py-2.5 text-[13px] font-medium"
                >
                  <ImageIcon size={15} /> Upload from gallery
                </button>
                <button
                  onClick={() => navigate({ to: "/create", search: { source: "instagram" } })}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-white/[0.06] py-2.5 text-[13px] font-medium"
                >
                  <Instagram size={15} /> Upload from Instagram
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { title, subtitle } = EMPTY_COPY[tab];
  return (
    <div className="flex flex-col items-center text-center px-8 pt-16 gap-1.5">
      <h3 className="text-[16px] font-bold">{title}</h3>
      <p className="text-[13px] text-white/50 max-w-[220px]">{subtitle}</p>
    </div>
  );
}