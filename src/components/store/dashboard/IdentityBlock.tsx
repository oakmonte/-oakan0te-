import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Plus, Store as StoreIcon } from "lucide-react";
import { useActiveStore } from "@/hooks/use-own-store";
import { useFilePicker } from "@/hooks/use-file-picker";
import { startBackgroundUpload, onBackgroundUploadDone } from "@/lib/background-upload";
import { fetchStoreLogoUrl, saveStoreLogoUrl } from "@/lib/store-logo";
import { ShareProfileOverlay } from "@/components/profile/ShareProfileOverlay";

/** The top of the dashboard: who this store is, and the three things a seller
 *  most often wants to do with it.
 *
 *  The name block doubles as the store switcher. The store <select> that used to
 *  sit in the dashboard header is gone -- two switchers on one screen, looking
 *  completely different and doing the same thing, is worse than either alone. */
export function IdentityBlock() {
  const { store, stores, setActiveId } = useActiveStore();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { node: fileInput, pick } = useFilePicker("image/*");
  const switcherRef = useRef<HTMLDivElement>(null);
  const storeId = store?.id ?? null;

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void fetchStoreLogoUrl(storeId).then((url) => {
      if (!cancelled) setLogoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  // Close on an outside tap. Deliberately not on scroll -- a popover that
  // vanishes because the page moved a pixel under a thumb reads as a misfire
  // rather than a dismissal.
  useEffect(() => {
    if (!switcherOpen) return;
    function onDown(e: PointerEvent) {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [switcherOpen]);

  async function handlePickLogo() {
    const file = await pick();
    if (!file || !storeId) return;
    // The background uploader rather than local state: an upload owned by a
    // component that is about to unmount is exactly the orphaned-file bug that
    // module exists to prevent. It also hands back an object URL, so the avatar
    // updates the instant a file is chosen.
    const { id, previewUrl } = startBackgroundUpload(file, "store-theme-image", "store picture");
    setLogoUrl(previewUrl);
    onBackgroundUploadDone(id, (upload) => {
      // Only ever persist a real remote URL. A blob: URL written to the database
      // is dead the moment the tab closes and would look perfectly fine until
      // the next reload. A failure leaves the optimistic preview in place; the
      // shared upload toast owns the retry.
      if (upload.status !== "success" || !upload.url) return;
      const url = upload.url;
      setLogoUrl(url);
      void saveStoreLogoUrl(storeId, url).catch((err) =>
        console.error("IdentityBlock: could not save the store logo", err),
      );
    });
  }

  if (!store) return null;
  const canSwitch = stores.length > 1;

  return (
    <header className="flex flex-col gap-4">
      {fileInput}

      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-[72px] w-[72px] rounded-full bg-sd-soft object-cover ring-1 ring-sd-line"
            />
          ) : (
            <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-sd-soft ring-1 ring-sd-line">
              <StoreIcon size={26} className="text-sd-ink-faint" />
            </div>
          )}
          <button
            type="button"
            onClick={handlePickLogo}
            aria-label={logoUrl ? "Replace your store picture" : "Add a store picture"}
            className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-sd-accent text-sd-on-accent ring-[3px] ring-sd-bg oak-motion-control active:scale-90"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div ref={switcherRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => canSwitch && setSwitcherOpen((v) => !v)}
            // Disabled rather than merely inert when there is only one store. A
            // chevron and a press state on a control that cannot do anything is
            // a promise the screen does not keep.
            disabled={!canSwitch}
            aria-expanded={canSwitch ? switcherOpen : undefined}
            className="-m-1 flex w-full items-center gap-1.5 rounded-xl p-1 text-left oak-motion-control enabled:active:scale-[0.98] disabled:pointer-events-none"
          >
            <span className="min-w-0">
              <span className="sd-brandname block truncate text-[22px] leading-tight tracking-[-0.01em] text-sd-ink">
                {store.brand_name}
              </span>
              <span className="mt-0.5 block truncate text-[13px] font-medium text-sd-ink-muted">
                @{store.store_username}
              </span>
            </span>
            {canSwitch && (
              <ChevronDown
                size={16}
                className={`shrink-0 text-sd-ink-faint transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  switcherOpen ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {switcherOpen && (
            <div
              role="menu"
              // Scales out of the trigger rather than the middle of the screen,
              // so the panel reads as coming from the thing that was tapped.
              className="absolute inset-x-0 top-full z-30 mt-2 origin-top-left overflow-hidden rounded-2xl border border-sd-line bg-sd-surface shadow-[var(--sd-shadow-float)] oak-motion-pop"
            >
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveId(s.id);
                    setSwitcherOpen(false);
                  }}
                  className={`flex w-full flex-col items-start px-4 py-3 text-left oak-motion-control ${
                    s.id === store.id ? "bg-sd-accent-tint" : ""
                  }`}
                >
                  <span className="text-[14px] font-semibold text-sd-ink">{s.brand_name}</span>
                  <span className="text-[12px] text-sd-ink-muted">@{s.store_username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Three peers. Visit store carries the fill because it is the common
          path. bg-sd-ink rather than the accent: that is a black pill in light
          and a white one in dark, which is the landing page's button correctly
          inverted per scheme rather than a blue one fighting a black page.
          Labels only -- at 375px each pill is about 109px wide, and an icon
          beside an already unambiguous label is noise. */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          to="/store-profile/$storeUsername"
          params={{ storeUsername: store.store_username }}
          className="grid h-10 place-items-center rounded-full bg-sd-ink text-[13px] font-bold tracking-[0.01em] text-sd-bg oak-motion-control active:scale-[0.97]"
        >
          Visit store
        </Link>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="grid h-10 place-items-center rounded-full border border-sd-line bg-sd-surface text-[13px] font-bold tracking-[0.01em] text-sd-ink oak-motion-control active:scale-[0.97]"
        >
          Share link
        </button>
        <Link
          to="/store/theme"
          className="grid h-10 place-items-center rounded-full border border-sd-line bg-sd-surface text-[13px] font-bold tracking-[0.01em] text-sd-ink oak-motion-control active:scale-[0.97]"
        >
          Edit store
        </Link>
      </div>

      <ShareProfileOverlay
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        avatarUrl={logoUrl}
        shareUrl={
          typeof window !== "undefined"
            ? `${window.location.origin}/store-profile/${store.store_username}`
            : `/store-profile/${store.store_username}`
        }
      />
    </header>
  );
}
