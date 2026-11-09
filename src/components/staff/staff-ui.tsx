// Shared bits for the staff back-office (/staff/*). Plain neutral styling: the
// back-office sits on the fixed-white "marketing" surface (see surface.ts), not
// on the seller dashboard's --sd-* tokens.
import { useState, type ReactNode } from "react";
import { staffApi } from "@/lib/staff-api";

export function Card({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      {title ? <h2 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-xs text-neutral-500">{label}</dt>
      <dd className="break-all text-sm text-neutral-900">{children ?? "—"}</dd>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

export const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none sm:text-sm";

export const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40";

/** Mints a one-time sign-in link for a seller's account (audit-logged
 *  server-side) and shows it to copy into a PRIVATE window. Opening it in this
 *  window would sign the staff member out of their own account. */
export function OpenAsClient({ userId }: { userId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const mint = async () => {
    setBusy(true);
    setError(null);
    try {
      const { token_hash } = await staffApi<{ token_hash: string }>("/api/staff/open-as", {
        method: "POST",
        body: { user_id: userId },
      });
      // In the fragment, so it never reaches a server log or a Referer.
      setLink(`${window.location.origin}/staff-open#t=${encodeURIComponent(token_hash)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a link");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      {!link ? (
        <button type="button" onClick={mint} disabled={busy} className={secondaryButtonClass}>
          {busy ? "Creating link…" : "Open as client"}
        </button>
      ) : (
        <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            Copy this into a <strong>private / incognito window</strong> to work in the client's
            dashboard. It works once and expires within the hour. Don't open it here: it would sign
            you out of your staff account.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              className={inputClass}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" onClick={copy} className={buttonClass}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
