// Client half of the staff back-office: calls /api/staff/* with the session.
import { authedFetch } from "@/lib/authed-fetch";

export class StaffApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

/** Sample-data preview: `/staff?demo=1`, remembered for the tab. On localhost
 *  the data comes from staff-demo.ts directly; on a deploy it comes from
 *  /api/staff-demo/*, behind STAFF_DEMO_PASSWORD (set on the test deploy only).
 *  Either way it is sample data and never reaches the real /api/staff/*. */
export function isStaffDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("demo")) {
      sessionStorage.setItem("staff-demo", "1");
    }
    return sessionStorage.getItem("staff-demo") === "1";
  } catch {
    return false;
  }
}

/** Trades the demo password for the preview's HttpOnly cookie. */
export async function unlockStaffDemo(password: string): Promise<boolean> {
  const res = await fetch("/api/staff-demo/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

/** Calls an /api/staff/* route with the session attached. Throws
 *  StaffApiError with the server's message on any non-2xx. */
export async function staffApi<T>(path: string, init?: { method?: string; body?: unknown }) {
  // DEV checked here, at the import, so a production build removes the whole
  // branch -- and with it the demo chunk.
  if (import.meta.env.DEV && isStaffDemo()) {
    const { demoResponse } = await import("@/lib/staff-demo");
    return demoResponse(path, init) as T;
  }
  const request: RequestInit = {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  };
  // The demo rides its own cookie; the session token isn't sent there.
  const res = isStaffDemo()
    ? await fetch(path.replace(/^\/api\/staff\//, "/api/staff-demo/"), request)
    : await authedFetch(path, request);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new StaffApiError(
      typeof json?.error === "string" ? json.error : `Request failed (${res.status})`,
      res.status,
      json,
    );
  }
  return json as T;
}

export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
