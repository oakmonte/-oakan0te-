import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BackButton } from "@/components/BackButton";
import { buttonClass, ErrorNote, inputClass } from "@/components/staff/staff-ui";
import { staffApi, when } from "@/lib/staff-api";

// One support thread, and a reply as Oakmonte Support. The user sees it in
// their Messages, in the support conversation, like any other support reply.
export const Route = createFileRoute("/staff/inbox/$userId")({
  component: StaffThread,
});

type Message = {
  id: string;
  body: string | null;
  sender: "user" | "support";
  created_at: string;
  media_url: string | null;
};

function StaffThread() {
  const { userId } = Route.useParams();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    staffApi<{ messages: Message[] }>(`/api/staff/support/${userId}`)
      .then((data) => setMessages(data.messages))
      .catch((err: Error) => setError(err.message));
  }, [userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const { message } = await staffApi<{ message: Message }>(`/api/staff/support/${userId}`, {
        method: "POST",
        body: { body: draft },
      });
      setMessages((prev) => [...(prev ?? []), message]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton to={{ to: "/staff" }} alwaysShow className="text-neutral-900" />
        <h1 className="text-xl font-semibold">Support thread</h1>
        <Link
          to="/staff/users/$userId"
          params={{ userId }}
          className="ml-auto text-sm text-neutral-600 underline"
        >
          Account, stores & orders
        </Link>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {messages === null && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "support" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                m.sender === "support" ? "bg-neutral-900 text-white" : "bg-neutral-100"
              }`}
            >
              {m.media_url ? (
                <a href={m.media_url} target="_blank" rel="noreferrer">
                  <img
                    src={m.media_url}
                    alt="Photo from the user"
                    className="mb-1 max-h-64 rounded-lg"
                    loading="lazy"
                  />
                </a>
              ) : null}
              {m.body}
            </div>
            <span className="mt-0.5 text-[11px] text-neutral-400">
              {m.sender === "support" ? "Support · " : ""}
              {when(m.created_at)}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Reply as Oakmonte Support…"
          className={inputClass}
        />
        <button type="submit" disabled={sending || !draft.trim()} className={buttonClass}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
