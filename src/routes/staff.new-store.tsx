import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  buttonClass,
  Card,
  ErrorNote,
  inputClass,
  OpenAsClient,
} from "@/components/staff/staff-ui";
import { StaffApiError, staffApi } from "@/lib/staff-api";

// Set up a store for a client who won't do it themselves. The account and the
// store belong to the client; staff then add products through "Open as
// client". The client signs in later with their email, as usual.
export const Route = createFileRoute("/staff/new-store")({
  component: StaffNewStore,
});

type Theme = { id: string; name: string; slug: string; preview_url: string };
type Created = { user_id: string; store_id: string; handle: string; created_account: boolean };

const STORE_TYPES = ["Brand", "Vendor", "Tailor", "Artist"];

function StaffNewStore() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [form, setForm] = useState({
    email: "",
    client_name: "",
    brand_name: "",
    handle: "",
    business_phone: "",
    store_type: "",
    theme_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingUser, setExistingUser] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    staffApi<{ themes: Theme[] }>("/api/staff/stores")
      .then((data) => setThemes(data.themes))
      .catch(() => setThemes([]));
  }, []);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setExistingUser(null);
    try {
      setCreated(await staffApi<Created>("/api/staff/stores", { method: "POST", body: form }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the store");
      if (err instanceof StaffApiError && typeof err.body?.user_id === "string") {
        setExistingUser(err.body.user_id);
      }
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Store created</h1>
        <Card>
          <div className="space-y-3 text-sm">
            <p>
              <strong>{form.brand_name}</strong> is live at{" "}
              <a
                href={`/shop/${created.handle}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                /shop/{created.handle}
              </a>
              , owned by <strong>{form.email}</strong>
              {created.created_account ? " (new account)" : " (their existing account)"}.
            </p>
            <p className="text-neutral-600">
              Next, add their products and finish the theme in their dashboard. Tell the client to
              sign in with this email: they'll get a code, then set their own password.
            </p>
            <OpenAsClient userId={created.user_id} />
            <div className="flex gap-4 pt-2">
              <Link
                to="/staff/users/$userId"
                params={{ userId: created.user_id }}
                className="underline"
              >
                View account
              </Link>
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setCreated(null);
                  setForm({
                    email: "",
                    client_name: "",
                    brand_name: "",
                    handle: "",
                    business_phone: "",
                    store_type: "",
                    theme_id: "",
                  });
                }}
              >
                Set up another
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Set up a store for a client</h1>
      <form onSubmit={submit} className="space-y-4">
        <Card title="Client">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Client's email *</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                className={inputClass}
                autoComplete="off"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Client's name</span>
              <input
                value={form.client_name}
                onChange={(e) => set("client_name")(e.target.value)}
                className={inputClass}
                autoComplete="off"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            If they already have an account with this email, the store is added to it.
          </p>
        </Card>

        <Card title="Store">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Store name *</span>
              <input
                required
                value={form.brand_name}
                onChange={(e) => set("brand_name")(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Store link (optional)</span>
              <input
                value={form.handle}
                onChange={(e) => set("handle")(e.target.value)}
                placeholder="made from the name if empty"
                className={inputClass}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Business phone</span>
              <input
                type="tel"
                value={form.business_phone}
                onChange={(e) => set("business_phone")(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-neutral-600">Seller type</span>
              <select
                value={form.store_type}
                onChange={(e) => set("store_type")(e.target.value)}
                className={inputClass}
              >
                <option value="">Not set</option>
                {STORE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <Card title="Theme">
          {themes.length === 0 ? (
            <p className="text-sm text-neutral-500">Loading themes…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ThemeOption
                selected={form.theme_id === ""}
                onSelect={() => set("theme_id")("")}
                name="Choose later"
              />
              {themes.map((t) => (
                <ThemeOption
                  key={t.id}
                  selected={form.theme_id === t.id}
                  onSelect={() => set("theme_id")(t.id)}
                  name={t.name}
                  preview={t.preview_url}
                />
              ))}
            </div>
          )}
        </Card>

        <ErrorNote>{error}</ErrorNote>
        {existingUser ? (
          <Link
            to="/staff/users/$userId"
            params={{ userId: existingUser }}
            className="text-sm underline"
          >
            Open that client's account
          </Link>
        ) : null}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating…" : "Create store"}
        </button>
      </form>
    </div>
  );
}

function ThemeOption({
  selected,
  onSelect,
  name,
  preview,
}: {
  selected: boolean;
  onSelect: () => void;
  name: string;
  preview?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`overflow-hidden rounded-lg border text-left text-xs ${
        selected ? "border-neutral-900 ring-2 ring-neutral-900" : "border-neutral-200"
      }`}
    >
      <div className="aspect-[3/4] bg-neutral-100">
        {preview ? (
          <img src={preview} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="truncate px-2 py-1.5">{name}</div>
    </button>
  );
}
