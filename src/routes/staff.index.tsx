import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, ErrorNote } from "@/components/staff/staff-ui";
import { staffApi, when } from "@/lib/staff-api";

// The support inbox: every user-to-support thread, the ones waiting on a
// reply first.
export const Route = createFileRoute("/staff/")({
  component: StaffInbox,
});

type Thread = {
  user_id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  last_body: string;
  last_sender: string;
  last_at: string;
  awaiting: number;
};

function StaffInbox() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  useEffect(() => {
    staffApi<{ threads: Thread[] }>("/api/staff/inbox")
      .then((data) => setThreads(data.threads))
      .catch((err: Error) => setError(err.message));
  }, []);

  const open = (threads ?? []).filter((t) => t.awaiting > 0);
  const shown = filter === "open" ? open : (threads ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Support inbox</h1>
        <div className="ml-auto flex gap-1 text-sm">
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 ${filter === f ? "bg-neutral-900 text-white" : "text-neutral-600"}`}
            >
              {f === "open" ? `Needs reply (${open.length})` : `All (${threads?.length ?? 0})`}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {threads === null && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {threads !== null && shown.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            {filter === "open" ? "Nothing waiting on a reply." : "No support threads yet."}
          </p>
        </Card>
      ) : null}
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {shown.map((t) => (
          <li key={t.user_id}>
            <Link
              to="/staff/inbox/$userId"
              params={{ userId: t.user_id }}
              className="flex gap-3 px-4 py-3 hover:bg-neutral-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">
                    {t.name || t.username || t.email || t.user_id}
                  </span>
                  {t.username ? (
                    <span className="truncate text-xs text-neutral-500">@{t.username}</span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-neutral-600">
                  {t.last_sender === "support" ? "You: " : ""}
                  {t.last_body}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-neutral-500">{when(t.last_at)}</span>
                {t.awaiting > 0 ? (
                  <span className="rounded-full bg-red-600 px-2 text-xs font-medium text-white">
                    {t.awaiting}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
