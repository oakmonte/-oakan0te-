import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, MapPin, Hash, AtSign, Tag, X, Check, Globe, Users, Lock } from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useSession } from "@/hooks/use-session";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { authedFetch } from "@/lib/authed-fetch";
import CameraPanel from "@/components/camera/CameraPanel";

export const Route = createFileRoute("/create/after-shot/publish")({
  head: () => ({ meta: [{ title: "New post — Oakmonte" }] }),
  component: PublishPage,
});

type Visibility = "public" | "followers" | "only_me";

const VISIBILITY_OPTIONS: {
  id: Visibility;
  label: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  { id: "public", label: "Everyone", description: "Anyone can view this post", Icon: Globe },
  {
    id: "followers",
    label: "Followers",
    description: "Only people who follow you can view this post",
    Icon: Users,
  },
  { id: "only_me", label: "Only me", description: "Only you can view this post", Icon: Lock },
];

type ProductOption = { id: string; title: string; price: number | null; image: string | null };

function PublishPage() {
  useLockedViewport();
  const navigate = useNavigate();
  const { media } = useAfterShotContext();
  const { user } = useSession();
  const { storeId } = useActiveStoreId();

  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [taggedProducts, setTaggedProducts] = useState<ProductOption[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [pending, setPending] = useState<"published" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const insertToken = (token: string) => {
    const el = captionRef.current;
    const start = el?.selectionStart ?? caption.length;
    const end = el?.selectionEnd ?? caption.length;
    const next = caption.slice(0, start) + token + caption.slice(end);
    setCaption(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const publish = useCallback(
    async (status: "published" | "draft") => {
      if (!user || pending) return;
      setPending(status);
      setError(null);
      try {
        const fd = new FormData();
        fd.set("file", media.blob, media.type === "video" ? "media.mp4" : "media.jpg");
        fd.set("mediaType", media.type);
        if (media.poster) fd.set("thumbnail", media.poster.blob, "thumbnail.jpg");
        if (caption.trim()) fd.set("caption", caption.trim());
        if (location.trim()) fd.set("location", location.trim());
        fd.set("visibility", visibility);
        fd.set("status", status);
        if (taggedProducts.length > 0) {
          fd.set("productIds", JSON.stringify(taggedProducts.map((p) => p.id)));
        }

        const res = await authedFetch("/api/posts", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}) as { error?: string });
          throw new Error(body.error || "Could not publish");
        }

        // The post is safely on Bunny + in the database now — release the
        // in-memory capture and its object URLs ourselves rather than through
        // discard(), which is written for the "back out" path and would
        // navigate to /create instead of the profile the post just landed on.
        URL.revokeObjectURL(media.url);
        if (media.poster) URL.revokeObjectURL(media.poster.url);

        const { data: profile } = await supabase
          .from("profiles")
          .select("personal_username")
          .eq("id", user.id)
          .single();

        navigate({
          to: "/profile/$username",
          params: { username: profile?.personal_username ?? user.id },
          replace: true,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not publish");
        setPending(null);
      }
    },
    [user, pending, media, caption, location, visibility, taggedProducts, navigate],
  );

  const activeVisibility = VISIBILITY_OPTIONS.find((v) => v.id === visibility)!;

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-y-auto"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button
          onClick={() => navigate({ to: "/create/after-shot" })}
          aria-label="Back to editor"
          className="oak-motion-control flex items-center justify-center w-9 h-9 -ml-1 active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold">New post</span>
        <span className="w-9" />
      </div>

      <div className="px-4 pb-40">
        {/* Cover + caption */}
        <div className="flex gap-3 pt-2">
          <div className="w-24 h-32 shrink-0 rounded-xl overflow-hidden bg-neutral-900 relative">
            {media.type === "photo" ? (
              <img src={media.url} alt="" className="w-full h-full object-cover" />
            ) : media.poster ? (
              <img src={media.poster.url} alt="" className="w-full h-full object-cover" />
            ) : (
              <video src={media.url} muted playsInline className="w-full h-full object-cover" />
            )}
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <textarea
              ref={captionRef}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption that gets people talking…"
              rows={4}
              maxLength={2200}
              className="flex-1 bg-transparent text-[15px] placeholder:text-white/40 focus:outline-none resize-none"
            />
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => insertToken("#")}
                aria-label="Add hashtag"
                className="oak-motion-control flex items-center justify-center w-8 h-8 rounded-full active:scale-90"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <Hash size={15} />
              </button>
              <button
                type="button"
                onClick={() => insertToken("@")}
                aria-label="Mention someone"
                className="oak-motion-control flex items-center justify-center w-8 h-8 rounded-full active:scale-90"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <AtSign size={15} />
              </button>
              <span className="text-[11px] text-white/35">{caption.length}/2200</span>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="oak-motion-fade flex items-center gap-2.5 mt-5 rounded-xl border border-white/10 px-3.5 py-3">
          <MapPin size={17} className="text-white/50 shrink-0" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add location"
            className="flex-1 bg-transparent text-[14px] placeholder:text-white/40 focus:outline-none min-w-0"
          />
          {location && (
            <button onClick={() => setLocation("")} aria-label="Clear location">
              <X size={15} className="text-white/40" />
            </button>
          )}
        </div>

        {/* Tagged products */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setTagPickerOpen(true)}
            className="oak-motion-control flex items-center gap-2.5 w-full rounded-xl border border-white/10 px-3.5 py-3 text-left active:scale-[0.99]"
          >
            <Tag size={17} className="text-white/50 shrink-0" />
            <span className="flex-1 text-[14px]">
              {taggedProducts.length > 0
                ? `${taggedProducts.length} product${taggedProducts.length > 1 ? "s" : ""} tagged`
                : "Tag products"}
            </span>
            <span className="text-[12px] text-white/40">Edit</span>
          </button>

          {taggedProducts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-2.5" style={{ scrollbarWidth: "none" }}>
              {taggedProducts.map((p) => (
                <div
                  key={p.id}
                  className="oak-motion-pop shrink-0 flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <img
                    src={p.image ?? "https://placehold.co/40x40"}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-[12px] max-w-[110px] truncate">{p.title}</span>
                  <button
                    onClick={() => setTaggedProducts((prev) => prev.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.title} tag`}
                  >
                    <X size={12} className="text-white/50" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visibility */}
        <button
          type="button"
          onClick={() => setVisibilityOpen(true)}
          className="oak-motion-control flex items-center gap-2.5 w-full rounded-xl border border-white/10 px-3.5 py-3 mt-3 text-left active:scale-[0.99]"
        >
          <activeVisibility.Icon size={17} className="text-white/50 shrink-0" />
          <span className="flex-1 text-[14px]">{activeVisibility.description}</span>
          <span className="text-[12px] text-white/40">Change</span>
        </button>

        {error && (
          <p className="oak-motion-enter text-[13px] text-red-400 mt-4 text-center">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div
        className="fixed left-0 right-0 bottom-0 flex gap-3 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          background: "linear-gradient(to top, #000 60%, rgba(0,0,0,0))",
        }}
      >
        <button
          type="button"
          onClick={() => publish("draft")}
          disabled={pending !== null}
          className="oak-motion-control flex-1 rounded-full border border-white/25 py-3.5 text-[14px] font-semibold disabled:opacity-50 active:scale-[0.98]"
        >
          {pending === "draft" ? "Saving…" : "Save to Drafts"}
        </button>
        <button
          type="button"
          onClick={() => publish("published")}
          disabled={pending !== null}
          className="oak-motion-control flex-[1.3] rounded-full py-3.5 text-[14px] font-bold disabled:opacity-50 active:scale-[0.98]"
          style={{ background: "#fff", color: "#000" }}
        >
          {pending === "published" ? "Posting…" : "Post"}
        </button>
      </div>

      <VisibilityPanel
        open={visibilityOpen}
        selected={visibility}
        onClose={() => setVisibilityOpen(false)}
        onSelect={(v) => {
          setVisibility(v);
          setVisibilityOpen(false);
        }}
      />

      <ProductTagPanel
        open={tagPickerOpen}
        storeId={storeId}
        selectedIds={new Set(taggedProducts.map((p) => p.id))}
        onClose={() => setTagPickerOpen(false)}
        onToggle={(product) =>
          setTaggedProducts((prev) =>
            prev.some((p) => p.id === product.id)
              ? prev.filter((p) => p.id !== product.id)
              : [...prev, product],
          )
        }
      />
    </div>
  );
}

function VisibilityPanel({
  open,
  selected,
  onClose,
  onSelect,
}: {
  open: boolean;
  selected: Visibility;
  onClose: () => void;
  onSelect: (v: Visibility) => void;
}) {
  return (
    <CameraPanel open={open} onClose={onClose} title="Who can view this post" height={340}>
      <div className="flex flex-col gap-1.5 pb-4">
        {VISIBILITY_OPTIONS.map(({ id, label, description, Icon }) => {
          const active = id === selected;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="oak-motion-control flex items-center gap-3 rounded-xl px-3 py-3 text-left active:scale-[0.99]"
              style={{ background: active ? "rgba(255,255,255,0.08)" : "transparent" }}
            >
              <Icon size={19} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold">{label}</p>
                <p className="text-[12px] text-white/45 truncate">{description}</p>
              </div>
              {active && <Check size={18} />}
            </button>
          );
        })}
      </div>
    </CameraPanel>
  );
}

function ProductTagPanel({
  open,
  storeId,
  selectedIds,
  onClose,
  onToggle,
}: {
  open: boolean;
  storeId: string | null;
  selectedIds: Set<string>;
  onClose: () => void;
  onToggle: (product: ProductOption) => void;
}) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !storeId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("products")
      .select("id, title, status, product_variants(price, main_image_url)")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setProducts(
            data.map((p) => ({
              id: p.id,
              title: p.title ?? "Untitled",
              price: p.product_variants[0]?.price ?? null,
              image: p.product_variants[0]?.main_image_url ?? null,
            })),
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storeId]);

  return (
    <CameraPanel open={open} onClose={onClose} title="Tag products" height={520}>
      {!storeId ? (
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <p className="text-[13px] text-white/50 max-w-[220px]">
            List a product in your store before you can tag it on a post.
          </p>
          <button
            onClick={() => {
              onClose();
              navigate({ to: "/store/products/new" });
            }}
            className="oak-motion-control rounded-full bg-white text-black text-[13px] font-semibold px-5 py-2.5 active:scale-95"
          >
            List a product
          </button>
        </div>
      ) : loading ? (
        <div className="text-center text-[13px] text-white/40 py-10">Loading your products…</div>
      ) : products.length === 0 ? (
        <div className="text-center text-[13px] text-white/40 py-10">
          No active products to tag yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-4">
          {products.map((p) => {
            const active = selectedIds.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p)}
                className="oak-motion-control flex items-center gap-3 rounded-xl px-2 py-2 text-left active:scale-[0.99]"
                style={{ background: active ? "rgba(255,255,255,0.08)" : "transparent" }}
              >
                <img
                  src={p.image ?? "https://placehold.co/48x48"}
                  alt=""
                  className="w-11 h-11 rounded-lg object-cover bg-neutral-800 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{p.title}</p>
                  <p className="text-[12px] text-white/45">
                    {p.price != null ? `₦${p.price.toLocaleString()}` : "No price"}
                  </p>
                </div>
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full shrink-0"
                  style={{
                    background: active ? "#fff" : "rgba(255,255,255,0.1)",
                    color: active ? "#000" : "transparent",
                  }}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </CameraPanel>
  );
}
