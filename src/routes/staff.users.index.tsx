import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { buttonClass, ErrorNote, inputClass } from "@/components/staff/staff-ui";
import { staffApi, when } from "@/lib/staff-api";

// Find an account by email, username, name, user id, or a store's link or name.
export const Route = createFileRoute("/staff/users/")({
  component: StaffLookup,
});

type UserHit = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  created_at: string | null;
  stores: { id: string; name: string; handle: string }[];
};

function StaffLookup() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const data = await staffApi<{ users: UserHit[] }>(
        `/api/staff/users?q=${encodeURIComponent(q.trim())}`,
      );
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Lookup</h1>
      <form onSubmit={search} className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Email, username, name, store link or user id"
          className={inputClass}
          autoFocus
        />
        <button type="submit" disabled={busy || q.trim().length < 2} className={buttonClass}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      <ErrorNote>{error}</ErrorNote>
      {users !== null && users.length === 0 ? (
        <p className="text-sm text-neutral-500">No matches.</p>
      ) : null}
      {users && users.length > 0 ? (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                to="/staff/users/$userId"
                params={{ userId: u.id }}
                className="block px-4 py-3 hover:bg-neutral-50"
              >
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">
                    {u.name || u.username || "No profile"}
                  </span>
                  {u.username ? (
                    <span className="text-xs text-neutral-500">@{u.username}</span>
                  ) : null}
                  <span className="ml-auto shrink-0 text-xs text-neutral-400">
                    {when(u.created_at)}
                  </span>
                </div>
                <p className="truncate text-sm text-neutral-600">{u.email ?? u.id}</p>
                {u.stores.length > 0 ? (
                  <p className="truncate text-xs text-neutral-500">
                    Store: {u.stores.map((s) => `${s.name} (/${s.handle})`).join(", ")}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
