import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { unlockStaffDemo } from "@/lib/staff-api";

// Personal links into the staff dashboard's SAMPLE-DATA preview, e.g.
// /diadem/1212/admin. The name and code are checked on the server against
// STAFF_DEMO_LOGINS (api.staff-demo.$.ts); a match sets the preview cookie and
// lands on /staff in demo mode. Anything else is a plain "Page not found".
//
// This only ever opens sample data. The real /staff keeps its staff_members
// check and is not reachable through these links.
export const Route = createFileRoute("/$who/$code/admin")({
  head: () => ({
    meta: [{ title: "Oakmonte staff" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: StaffLink,
});

function StaffLink() {
  const { who, code } = Route.useParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    unlockStaffDemo({ who, code })
      .then((ok) => {
        if (cancelled) return;
        if (!ok) {
          setFailed(true);
          return;
        }
        try {
          sessionStorage.setItem("staff-demo", "1");
          navigate({ to: "/staff", replace: true });
        } catch {
          // No storage (some private modes): ?demo=1 turns the preview on.
          window.location.replace("/staff?demo=1");
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [who, code, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-6 text-center text-neutral-900">
      {failed ? (
        <div>
          <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
          <Link to="/" className="text-sm text-neutral-500 underline">
            Go home
          </Link>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Opening…</p>
      )}
    </div>
  );
}
