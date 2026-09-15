import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  MapPin,
  Music,
  Hash,
  AtSign,
  Link2,
  X,
  Check,
  Globe,
  Users,
  Lock,
  ImageIcon,
} from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useSession } from "@/hooks/use-session";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { startPostUpload } from "@/lib/post-upload";
import { discardVideoEditorSession } from "@/lib/video-editor-session";
import { discardPhotoEditorSession } from "@/lib/photo-carousel";
import { blockedContentMessage, findBlockedContent } from "@/lib/content-policy";
import CameraPanel from "@/components/camera/CameraPanel";

export const Route = createFileRoute("/create/after-shot/publish")({
  // Overrides root's #000000 theme-color, the same way store.tsx does for the
  // dashboard. Root declares black because nearly every screen in the app is
  // black — the camera, the editors, the feed, drafts. This one is the sole
  // white screen in the create flow, and a white page under a theme-color of
  // black is what put black bands above and below it: Safari paints its own
  // chrome with that colour, so the page ended up framed in a colour it
  // doesn't use anywhere.
  head: () => ({
    meta: [{ title: "New post — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
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
  const { media, setMedia } = useAfterShotContext();
  const { user } = useSession();
  const { storeId } = useActiveStoreId();

  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [taggedProducts, setTaggedProducts] = useState<ProductOption[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  // Only guards against a double-tap in the brief tick before navigate()
  // unmounts this page — the actual upload runs in the background via
  // post-upload.ts and isn't gated on this.
  const [submitting, setSubmitting] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  // The caption is the likeliest place in the whole app for "DM me on IG", so
  // the same rule the text tool enforces applies here.
  //
  // `allowHandles` is the one difference, and it is a real exception rather
  // than a loophole: `@` is Oakmonte's OWN mention affordance on this screen —
  // there is a button right under the caption that types one. Blocking a bare
  // @name here would break a shipped feature in the name of a rule about other
  // platforms. "@shop" beside "ig" is still refused, because the platform word
  // is caught on its own.
  const blockedCaption = useMemo(
    () => findBlockedContent(caption, { allowHandles: true }),
    [caption],
  );

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

  // Posting/saving used to await the whole upload before doing anything
  // else, so the seller was stuck on this screen — sometimes for a while, on
  // a big video — with nothing to do but watch a "Posting…" button. Now the
  // upload is fired in the background (post-upload.ts) and this navigates
  // away immediately; PostUploadToast (mounted globally in __root.tsx)
  // reports progress and errors wherever the seller ends up.
  const publish = useCallback(
    (status: "published" | "draft") => {
      if (!user || submitting) return;
      // Belt as well as braces. The button is already disabled, but this is
      // the last point before the caption becomes a row in the database, and
      // a disabled button is a UI state rather than a guarantee.
      if (blockedCaption.length > 0) return;
      setSubmitting(true);

      // Every carousel item, cover first. `files` is repeated and `mediaTypes`
      // is positional, so the two must be appended in lockstep.
      const items = [{ type: media.type, blob: media.blob }, ...(media.extra ?? [])];
      const fd = new FormData();
      for (const [i, item] of items.entries()) {
        fd.append("files", item.blob, `media-${i}.${item.type === "video" ? "mp4" : "jpg"}`);
      }
      fd.set("mediaTypes", JSON.stringify(items.map((i) => i.type)));
      if (media.origin) fd.set("createdWith", media.origin);
      // The post's sound. Usually it rides alongside the media rather than
      // inside it, and the feed plays it over muted media. The video editor is
      // the exception: it mixed the track into the MP4 during export, so it
      // sends no bytes at all and only the credit — a post with both would
      // play two things at once.
      if (media.audio) {
        if (media.audio.bakedIn) {
          fd.set("audioBakedIn", "1");
        } else if (media.audio.blob) {
          // The bytes branch is what a recorded voiceover would use. It
          // currently never runs, since nothing sets `blob` any more.
          fd.set("audio", media.audio.blob, "audio");
        } else {
          // A catalogue track travels as a URL and the server fetches it, so a
          // phone on mobile data never downloads several megabytes only to
          // upload them straight back.
          fd.set("audioSource", media.audio.url);
        }
        fd.set("audioName", media.audio.name);

        const credit = media.audio.credit;
        if (credit) {
          if (credit.attribution) fd.set("audioAttribution", credit.attribution);
          fd.set("audioLicence", credit.licence);
          fd.set("audioSourceUrl", credit.sourceUrl);
        }
      }
      if (media.poster) fd.set("thumbnail", media.poster.blob, "thumbnail.jpg");
      if (caption.trim()) fd.set("caption", caption.trim());
      if (location.trim()) fd.set("location", location.trim());
      fd.set("visibility", visibility);
      fd.set("status", status);
      if (taggedProducts.length > 0) {
        fd.set("productIds", JSON.stringify(taggedProducts.map((p) => p.id)));
      }

      startPostUpload(fd, status);

      // The post is on its way, so the video editor's parked timeline is
      // finished with. Left behind, the next "New video" would open onto this
      // edit instead of an empty one.
      discardVideoEditorSession();
      discardPhotoEditorSession();

      // FormData already holds the Blobs themselves (not the object URLs),
      // so it's safe to release ours now instead of waiting for the
      // now-backgrounded upload to finish.
      URL.revokeObjectURL(media.url);
      if (media.poster) URL.revokeObjectURL(media.poster.url);
      media.extra?.forEach((item) => URL.revokeObjectURL(item.url));
      // Safe here and only here. The photo editor's copy of this URL is freed
      // by the session discard just above, at the same moment; the after-shot
      // path has no session, so without this its track would leak. The back
      // button deliberately revokes nothing, which is what lets either editor
      // still play the sound you picked when you return to it.
      //
      // Guarded on `blob` because only a track we hold bytes for has a URL we
      // made. A catalogue track's URL belongs to the provider, and revoking
      // that is meaningless. Nothing sets `blob` today, so this never fires —
      // it stays correct for the voiceover path rather than being a no-op
      // someone has to re-derive later.
      if (media.audio?.blob) URL.revokeObjectURL(media.audio.url);

      navigate({ to: "/home", replace: true });
    },
    [
      user,
      submitting,
      media,
      caption,
      location,
      visibility,
      taggedProducts,
      navigate,
      blockedCaption,
    ],
  );

  const activeVisibility = VISIBILITY_OPTIONS.find((v) => v.id === visibility)!;

  return (
    <div
      className="fixed inset-0 bg-white text-black overflow-y-auto"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button
          // Back to the editor the post actually came FROM. This used to be
          // hardcoded to the after-shot screen, which a video-editor post
          // never passes through — you'd tap back and land in a different
          // editor holding your finished video.
          onClick={() =>
            navigate({
              to:
                media.origin === "video-editor"
                  ? "/create/video-editor"
                  : media.origin === "photo-editor"
                    ? "/create/photo-editor"
                    : "/create/after-shot",
            })
          }
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
          <div className="w-24 h-32 shrink-0 rounded-xl overflow-hidden bg-gray-100 relative">
            {media.type === "photo" ? (
              <img src={media.url} alt="" className="w-full h-full object-cover" />
            ) : media.poster ? (
              <img src={media.poster.url} alt="" className="w-full h-full object-cover" />
            ) : (
              <video
                src={media.url}
                muted
                playsInline
                disablePictureInPicture
                disableRemotePlayback
                className="w-full h-full object-cover"
              />
            )}
            {/* How many items are actually going. Without it a carousel looks
                identical to a single photo on the one screen where you commit
                to posting it. */}
            {media.extra && media.extra.length > 0 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                1/{media.extra.length + 1}
              </span>
            )}
            {/* The cover is the frame the whole feed judges this post by, and
                until now it was whatever the export happened to leave — with
                no way to change it from the screen where you can see it. */}
            {media.type === "video" && (
              <button
                type="button"
                onClick={() => setCoverOpen(true)}
                className="oak-motion-control absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-[11px] font-semibold text-white active:scale-95"
              >
                <ImageIcon size={11} /> Edit cover
              </button>
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
              className="flex-1 bg-transparent text-[15px] placeholder:text-gray-400 focus:outline-none resize-none"
            />
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => insertToken("#")}
                aria-label="Add hashtag"
                className="oak-motion-control flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 active:scale-90"
              >
                <Hash size={15} />
              </button>
              <button
                type="button"
                onClick={() => insertToken("@")}
                aria-label="Mention someone"
                className="oak-motion-control flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 active:scale-90"
              >
                <AtSign size={15} />
              </button>
              <span className="text-[11px] text-gray-400">{caption.length}/2200</span>
            </div>
          </div>
        </div>

        {blockedCaption.length > 0 && (
          <p className="oak-motion-fade mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] leading-snug text-amber-900">
            {blockedContentMessage(blockedCaption)}
          </p>
        )}

        {/* Location */}
        <div className="oak-motion-fade flex items-center gap-2.5 mt-5 rounded-xl border border-gray-200 px-3.5 py-3">
          <MapPin size={17} className="text-gray-400 shrink-0" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add location"
            className="flex-1 bg-transparent text-[14px] placeholder:text-gray-400 focus:outline-none min-w-0"
          />
          {location && (
            <button onClick={() => setLocation("")} aria-label="Clear location">
              <X size={15} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* The sound, when there is one. Read-only here — it is chosen and
            auditioned in the photo editor, and this screen's job is to show
            what is about to go out, not to become a second place to set it. */}
        {media.audio && (
          <div className="oak-motion-fade flex items-center gap-2.5 mt-3 rounded-xl border border-gray-200 px-3.5 py-3">
            <Music size={17} className="text-gray-400 shrink-0" />
            <span className="flex-1 truncate text-[14px]">{media.audio.name}</span>
            <span className="text-[11px] text-gray-400">Sound</span>
          </div>
        )}

        {/* What the licence obliges, shown before the post goes out rather
            than only after. A seller who can see the credit that will appear
            under their post is a seller who can change their mind about the
            track while changing it is still free. */}
        {media.audio?.credit?.attribution && (
          <p className="mt-1.5 px-1 text-[11px] leading-snug text-gray-400">
            Credited as “{media.audio.credit.attribution}”
          </p>
        )}

        {/* Linked products. "Link", not "tag": these are what a viewer finds
            in Listed items when they swipe on the post, which is a connection
            to something buyable rather than a label on a picture. */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setTagPickerOpen(true)}
            className="oak-motion-control flex items-center gap-2.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 text-left active:scale-[0.99]"
          >
            <Link2 size={17} className="text-gray-400 shrink-0" />
            <span className="flex-1 text-[14px]">
              {taggedProducts.length > 0
                ? `${taggedProducts.length} product${taggedProducts.length > 1 ? "s" : ""} linked`
                : "Link products"}
            </span>
            <span className="text-[12px] text-gray-400">Edit</span>
          </button>
          <p className="pl-1 pt-1.5 text-[11px] text-gray-400">
            So your customers can buy at a swipe.
          </p>

          {taggedProducts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-2.5" style={{ scrollbarWidth: "none" }}>
              {taggedProducts.map((p) => (
                <div
                  key={p.id}
                  className="oak-motion-pop shrink-0 flex items-center gap-2 rounded-full bg-gray-100 pl-1 pr-2.5 py-1"
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
                    <X size={12} className="text-gray-400" />
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
          className="oak-motion-control flex items-center gap-2.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 mt-3 text-left active:scale-[0.99]"
        >
          <activeVisibility.Icon size={17} className="text-gray-400 shrink-0" />
          <span className="flex-1 text-[14px]">{activeVisibility.description}</span>
          <span className="text-[12px] text-gray-400">Change</span>
        </button>
      </div>

      {/* Footer */}
      <div
        className="fixed left-0 right-0 bottom-0 flex gap-3 px-4 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          background: "linear-gradient(to top, #fff 60%, rgba(255,255,255,0))",
        }}
      >
        <button
          type="button"
          onClick={() => publish("draft")}
          disabled={submitting || blockedCaption.length > 0}
          className="oak-motion-control flex-1 rounded-full border border-gray-300 py-3.5 text-[14px] font-semibold disabled:opacity-50 active:scale-[0.98]"
        >
          Save to Drafts
        </button>
        <button
          type="button"
          onClick={() => publish("published")}
          disabled={submitting || blockedCaption.length > 0}
          className="oak-motion-control flex-[1.3] rounded-full py-3.5 text-[14px] font-bold disabled:opacity-50 active:scale-[0.98]"
          style={{ background: "#000", color: "#fff" }}
        >
          Post
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

      {coverOpen && media.type === "video" && (
        <CoverPickerSheet
          url={media.url}
          onClose={() => setCoverOpen(false)}
          onPick={(poster) => {
            setMedia({ ...media, poster });
            setCoverOpen(false);
          }}
        />
      )}

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

/** Pick which frame of the video represents the post.
 *
 *  A plain <video> seek rather than a decode through mediabunny: the source is
 *  a local blob the browser can already scrub, and one frame does not justify
 *  spinning up the full demuxer. Capturing is a canvas read, which is safe
 *  here for the same reason — the blob is same-origin, so the canvas never
 *  gets tainted. */
function CoverPickerSheet({
  url,
  onPick,
  onClose,
}: {
  url: string;
  onPick: (poster: { blob: Blob; url: string }) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [at, setAt] = useState(0);
  const [saving, setSaving] = useState(false);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || saving) return;
    setSaving(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return setSaving(false);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) onPick({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.92,
    );
  }, [onPick, saving]);

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-black text-white">
      <div className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <button onClick={onClose} type="button" className="-ml-1 text-sm text-white/70">
          Cancel
        </button>
        <span className="text-[15px] font-semibold">Choose cover</span>
        <button
          onClick={capture}
          type="button"
          disabled={saving}
          className="text-sm font-semibold disabled:opacity-40"
        >
          Done
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <video
          ref={videoRef}
          src={url}
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          preload="auto"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          className="max-h-full w-full rounded-xl object-contain"
        />
      </div>

      <div
        className="flex items-center gap-3 px-6 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <span className="text-[12px] tabular-nums text-white/60">{at.toFixed(1)}s</span>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.05}
          value={at}
          onChange={(e) => {
            const next = Number(e.target.value);
            setAt(next);
            if (videoRef.current) videoRef.current.currentTime = next;
          }}
          aria-label="Cover frame"
          className="oak-adjust-range flex-1"
        />
      </div>
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
    <CameraPanel open={open} onClose={onClose} title="Who can view this post" height={340} light>
      <div className="flex flex-col gap-1.5 pb-4">
        {VISIBILITY_OPTIONS.map(({ id, label, description, Icon }) => {
          const active = id === selected;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="oak-motion-control flex items-center gap-3 rounded-xl px-3 py-3 text-left text-black active:scale-[0.99]"
              style={{ background: active ? "#f3f4f6" : "transparent" }}
            >
              <Icon size={19} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold">{label}</p>
                <p className="text-[12px] text-gray-500 truncate">{description}</p>
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
    <CameraPanel open={open} onClose={onClose} title="Link products" height={520} light>
      <p className="pb-3 text-[12px] text-gray-500">So your customers can buy at a swipe.</p>
      {!storeId ? (
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <p className="text-[13px] text-gray-500 max-w-[220px]">
            List a product in your store before you can link it to a post.
          </p>
          <button
            onClick={() => {
              onClose();
              navigate({ to: "/store/products/new" });
            }}
            className="oak-motion-control rounded-full bg-black text-white text-[13px] font-semibold px-5 py-2.5 active:scale-95"
          >
            List a product
          </button>
        </div>
      ) : loading ? (
        <div className="text-center text-[13px] text-gray-400 py-10">Loading your products…</div>
      ) : products.length === 0 ? (
        <div className="text-center text-[13px] text-gray-400 py-10">
          No active products to link yet.
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
                className="oak-motion-control flex items-center gap-3 rounded-xl px-2 py-2 text-left text-black active:scale-[0.99]"
                style={{ background: active ? "#f3f4f6" : "transparent" }}
              >
                <img
                  src={p.image ?? "https://placehold.co/48x48"}
                  alt=""
                  className="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{p.title}</p>
                  <p className="text-[12px] text-gray-500">
                    {p.price != null ? `₦${p.price.toLocaleString()}` : "No price"}
                  </p>
                </div>
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full shrink-0"
                  style={{
                    background: active ? "#000" : "#f3f4f6",
                    color: active ? "#fff" : "transparent",
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
