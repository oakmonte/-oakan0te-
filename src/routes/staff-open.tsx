import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

// The landing page for a staff "Open as client" link (see api.staff.open-as).
// Exchanges the one-time token in the URL fragment for the client's session,
// then goes to their dashboard.
//
// Outside the /staff layout on purpose: it runs in a private window, where no
// one is signed in. It refuses to run where someone already is, because the
// exchange would replace that session -- a staff member pasting the link into
// their own window would be signed out of their staff account.
export const Route = createFileRoute("/staff-open")({
  head: () => ({
    meta: [{ title: "Opening store — Oakmonte" }, { name: "robots", content: "noindex" }],
  }),
  component: StaffOpen,
});

let tokenOnce: string | null | undefined;

function StaffOpen() {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Read once per page load and kept here: the fragment is cleared below,
    // and a dev-mode effect re-run must still find the token.
    if (tokenOnce === undefined) {
      tokenOnce = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t");
      // Drop the token from the address bar and history straight away.
      window.history.replaceState(null, "", window.location.pathname);
    }
    const tokenHash = tokenOnce;

    (async () => {
      if (!tokenHash) {
        setMessage("This link is incomplete. Create a new one from the staff dashboard.");
        return;
      }
      const { data: current } = await supabase.auth.getSession();
      if (cancelled) return;
      if (current.session) {
        setMessage(
          "Someone is already signed in in this window. Open the link in a private / incognito window instead.",
        );
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
      if (cancelled) return;
      if (error) {
        setMessage("This link has already been used or has expired. Create a new one.");
        return;
      }
      navigate({ to: "/store", replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-6 text-center text-neutral-900">
      <div className="max-w-sm">
        {message ? (
          <>
            <h1 className="mb-2 text-xl font-semibold">Couldn't open the store</h1>
            <p className="mb-4 text-sm text-neutral-600">{message}</p>
            <Link to="/" className="text-sm underline">
              Go home
            </Link>
          </>
        ) : (
          <p className="text-sm text-neutral-600">Opening the client's store…</p>
        )}
      </div>
    </div>
  );
}
