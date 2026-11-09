import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { staffApi } from "@/lib/staff-api";

// The staff back-office shell. Whether to show it is decided by
// /api/staff/me, which checks public.staff_members server-side -- but that
// answer only decides what this layout RENDERS. The real gate is that every
// /api/staff/* handler runs requireStaff() itself; nothing here is trusted.
export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [{ title: "Staff — Oakmonte" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: StaffLayout,
});

type Me = { email: string | null; role: "admin" | "support" };

const TABS = [
  { to: "/staff", label: "Inbox", exact: true },
  { to: "/staff/users", label: "Lookup", exact: false },
  { to: "/staff/new-store", label: "New store", exact: false },
] as const;

function StaffLayout() {
  const { session, loading } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setState("denied");
      return;
    }
    let cancelled = false;
    staffApi<Me>("/api/staff/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setState("ok");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [loading, session]);

  if (state === "checking") {
    return <div className="min-h-dvh bg-neutral-50" aria-busy="true" />;
  }

  if (state === "denied") {
    // Same page whether signed out or not staff: don't advertise the back-office.
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white px-6 text-center text-neutral-900">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
          <Link to="/" className="text-sm text-neutral-500 underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <span className="text-sm font-semibold">Oakmonte staff</span>
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                activeOptions={{ exact: tab.exact }}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-neutral-600"
                activeProps={{ className: "bg-neutral-900 text-white" }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto hidden truncate text-xs text-neutral-500 sm:block">
            {me?.email} · {me?.role}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  );
}
