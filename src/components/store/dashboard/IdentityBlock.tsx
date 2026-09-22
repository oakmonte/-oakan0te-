import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, ChevronDown, Plus, Store as StoreIcon } from "lucide-react";
import { useActiveStore, type OwnedStoreSummary } from "@/hooks/use-own-store";
import { useFilePicker } from "@/hooks/use-file-picker";
import { startBackgroundUpload, onBackgroundUploadDone } from "@/lib/background-upload";
import { saveStoreLogoUrl, type StoreLogo } from "@/lib/store-logo";

/** The top of the dashboard: who this store is, and the three things a seller
 *  most often wants to do with it.
 *
 *  The name doubles as the store switcher. The native <select> that used to sit
 *  in the dashboard header is gone -- two switchers on one screen, looking
 *  completely different and doing the same thing, is worse than either alone.
 *
 *  `logo` is owned by the dashboard rather than fetched here, so the share sheet
 *  shows the same picture as this avatar. `undefined` means still loading, and
 *  is drawn as a plain disc: showing "Add a store picture" to a seller who
 *  already has one, for the length of a round trip, is a small lie. */
export function IdentityBlock({
  store,
  logo,
  onLogoChange,
  onShare,
}: {
  store: OwnedStoreSummary;
  logo: StoreLogo | undefined;
  onLogoChange: (url: string | null) => void;
  onShare: () => void;
}) {
  const { stores, setActiveId } = useActiveStore();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [logoNote, setLogoNote] = useState<string | null>(null);
  const { node: fileInput, pick } = useFilePicker("image/*");
  const switcherRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const canSwitch = stores.length > 1;
  const logoUrl = logo?.url ?? null;

  // Outside tap and Escape both close. Not scroll -- a panel that vanishes
  // because the page moved a pixel under a thumb reads as a misfire. Escape
  // hands focus back to the trigger, so keyboard and switch-control users are
  // not dropped at the top of the document.
  useEffect(() => {
    if (!switcherOpen) return;
    function onDown(e: PointerEvent) {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setSwitcherOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [switcherOpen]);

  async function handlePickLogo() {
    // Until the stores.logo_url migration is applied there is nowhere to keep a
    // store's own picture. Say so up front rather than uploading a file that
    // would show for this session and be gone on the next visit.
    if (logo && !logo.canSaveOwnLogo) {
      setLogoNote("Store pictures aren’t switched on yet.");
      return;
    }
    const file = await pick();
    if (!file) return;
    setLogoNote(null);
    const previous = logoUrl;
    // The background uploader rather than local state: an upload owned by a
    // component that might unmount mid-flight is exactly the orphaned-file bug
    // that module exists to prevent. It also returns an object URL, so the
    // avatar changes the instant a file is chosen.
    const { id, previewUrl } = startBackgroundUpload(file, "store-theme-image", "store picture");
    onLogoChange(previewUrl);
    onBackgroundUploadDone(id, (upload) => {
      // Only ever persist a real remote URL. A blob: URL written to the database
      // is dead the moment the tab closes and would look fine until reload. A
      // failed upload keeps the preview; the shared upload toast owns retry.
      if (upload.status !== "success" || !upload.url) return;
      const url = upload.url;
      onLogoChange(url);
      saveStoreLogoUrl(store.id, url).catch((err) => {
        console.error("IdentityBlock: could not save the store logo", err);
        onLogoChange(previous);
        setLogoNote("Couldn’t save your picture. Try again in a moment.");
      });
    });
  }

  const name = (
    <span className="sd-brandname line-clamp-2 text-[22px] leading-tight tracking-[-0.01em] text-sd-ink">
      {store.brand_name}
    </span>
  );

  return (
    <header className="flex flex-col gap-4">
      {fileInput}

      <div className="flex items-center gap-3.5">
        {/* The whole 72px avatar is the button. The badge is decoration: a 28px
            target on the edge of a 72px circle was the smallest control on the
            screen for one of its most personal actions. */}
        <button
          type="button"
          onClick={handlePickLogo}
          aria-label={logoUrl ? "Change your store picture" : "Add a store picture"}
          className="relative shrink-0 rounded-full oak-motion-control active:scale-[0.96]"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-[72px] w-[72px] rounded-full bg-sd-soft object-cover ring-1 ring-sd-line"
            />
          ) : (
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-sd-soft ring-1 ring-sd-line">
              {logo !== undefined && <StoreIcon size={26} className="text-sd-ink-muted" />}
            </span>
          )}
          {logo !== undefined && (
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-sd-accent text-sd-on-accent ring-[3px] ring-sd-bg"
            >
              {/* The glyph matches the action: + to add, a camera to change. */}
              {logoUrl ? (
                <Camera size={13} strokeWidth={2.25} />
              ) : (
                <Plus size={14} strokeWidth={2.5} />
              )}
            </span>
          )}
        </button>

        <div ref={switcherRef} className="relative min-w-0 flex-1">
          <h1>
            {canSwitch ? (
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setSwitcherOpen((v) => !v)}
                aria-expanded={switcherOpen}
                aria-controls={listId}
                aria-label={`${store.brand_name}, switch store`}
                className="-m-1 flex w-full items-center gap-1.5 rounded-xl p-1 text-left oak-motion-control active:scale-[0.98]"
              >
                {name}
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-sd-ink-muted transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    switcherOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            ) : (
              // One store: a heading, not a disabled button. A screen reader
              // announcing the seller's own name as a dimmed, unavailable
              // button is a strange thing to be told about yourself.
              name
            )}
          </h1>
          <p className="mt-0.5 truncate text-[13px] font-medium text-sd-ink-muted">
            @{store.store_username}
          </p>

          {switcherOpen && (
            // Deliberately not role="menu". That role promises arrow-key
            // navigation and focus management a native list of buttons already
            // does better on its own; claiming it without implementing it is
            // worse than claiming nothing.
            <div
              id={listId}
              className="sd-dropdown-in absolute inset-x-0 top-full z-30 mt-2 origin-top overflow-hidden rounded-2xl border border-sd-line bg-sd-surface shadow-[var(--sd-shadow-float)]"
            >
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-current={s.id === store.id ? "true" : undefined}
                  onClick={() => {
                    setActiveId(s.id);
                    setSwitcherOpen(false);
                  }}
                  className={`flex w-full flex-col items-start px-4 py-3 text-left oak-motion-control focus-visible:outline-offset-[-3px] ${
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

      {logoNote && (
        <p role="status" className="-mt-1 text-[13px] text-sd-ink-muted">
          {logoNote}
        </p>
      )}

      {/* Three peers, all outlined. The hero's "Share your store link" is the
          one filled button on the page for a seller with no orders -- a black
          Visit store up here competed with it as a second primary. 44px tall,
          and no-wrap so a larger text size shrinks the gap before it breaks a
          label across two lines inside a pill. */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          to="/store-profile/$storeUsername"
          params={{ storeUsername: store.store_username }}
          className="oak-tap grid h-11 place-items-center whitespace-nowrap rounded-full border border-sd-line bg-sd-surface px-2 text-[13px] font-semibold text-sd-ink oak-motion-control active:scale-[0.97]"
        >
          Visit store
        </Link>
        <button
          type="button"
          onClick={onShare}
          className="grid h-11 place-items-center whitespace-nowrap rounded-full border border-sd-line bg-sd-surface px-2 text-[13px] font-semibold text-sd-ink oak-motion-control active:scale-[0.97]"
        >
          Share link
        </button>
        <Link
          to="/store/theme"
          className="oak-tap grid h-11 place-items-center whitespace-nowrap rounded-full border border-sd-line bg-sd-surface px-2 text-[13px] font-semibold text-sd-ink oak-motion-control active:scale-[0.97]"
        >
          Edit store
        </Link>
      </div>
    </header>
  );
}
